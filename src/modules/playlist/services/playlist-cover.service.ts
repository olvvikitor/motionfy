import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { CreditService } from "src/modules/credits/credit.service";
import { AiImageService, type ReferenceImage } from "src/shared/infra/IA/AiImage.service";
import type { CoverReference, HybridPromptInput } from "src/shared/infra/IA/ImagePrompt.service";
import { EMOTION_CLUSTERS, EmotionAnalysisService, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { TrackEnrichmentService } from "src/shared/infra/IA/track-enrichment.service";
import { SpotifyMofyAccountService } from "src/shared/infra/music/spotify/spotify-mofy-account.service";
import { FILE_STORAGE } from "src/shared/infra/storage/interfaces/file-storage.interface";
import type { FileStorageService, UploadFile } from "src/shared/infra/storage/interfaces/file-storage.interface";
import { PlaylistRepository } from "../repository/playlist.repository";
import { MoodCentroidsService } from "./mood-centroids.service";
import { showcaseStats, toVector, trackIdsOf } from "./playlist-showcase";

const COVER_SIZE = 640;
// O Spotify aceita até 256 KB de base64 na capa; folga para não bater no limite.
const MAX_BASE64_LENGTH = 250 * 1024;
const JPEG_QUALITIES = [85, 75, 65, 55, 45, 35];
// Arte do card do perfil: quadrada, como a capa do Spotify; no máximo 1024, sem ampliar (a gerada vem com 816).
const ART_SIZE = 1024;
// Foto de referência: o lado maior, do tamanho da capa gerada (816); a entrada também conta no custo.
const REFERENCE_SIZE = 816;

export type CoverResponse = { preview: string; remainingCredits?: number };
export type SavedCover = { id: string; coverUrl: string; title: string | null; sentiment: string | null };

const SAVED_COVERS_LIMIT = 24;

// Quadrado 640×640 em JPEG para o Spotify, baixando a qualidade até caber no limite. A capa gerada
// já é quadrada; só imagem enviada pelo usuário em outro formato é recortada ("attention" procura a
// parte com mais detalhe, como rosto ou personagem, em vez do meio exato).
export async function toSpotifyCover(image: Buffer): Promise<string> {
    const square = sharp(image).rotate().resize(COVER_SIZE, COVER_SIZE, { fit: 'cover', position: sharp.strategy.attention });
    for (const quality of JPEG_QUALITIES) {
        const base64 = (await square.clone().jpeg({ quality, mozjpeg: true }).toBuffer()).toString('base64');
        if (base64.length <= MAX_BASE64_LENGTH) return base64;
    }
    throw new BadRequestException('Não deu para deixar a imagem pequena o bastante para o Spotify. Tente outra.');
}

// Capa já guardada no storage (arte quadrada do perfil, JPEG).
export async function fetchCover(coverUrl: string): Promise<Buffer> {
    const response = await fetch(coverUrl);
    if (!response.ok) throw new Error(`capa indisponível (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
}

// Arte do card do perfil: o mesmo quadrado da capa do Spotify, em tamanho maior (nunca maior que a imagem).
export async function toProfileArt(image: Buffer): Promise<Buffer> {
    const { width = ART_SIZE, height = ART_SIZE } = await sharp(image).metadata();
    const side = Math.min(ART_SIZE, width, height);
    return sharp(image).rotate()
        .resize(side, side, { fit: 'cover', position: sharp.strategy.attention })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
}

// Foto de referência enviada agora (câmera ou galeria): endireitada pelo EXIF (foto de celular vem
// deitada), reduzida e em JPEG, para a leitura e a geração receberem a imagem certa e leve.
async function toReferencePhoto(image: Buffer): Promise<ReferenceImage> {
    const buffer = await sharp(image).rotate()
        .resize(REFERENCE_SIZE, REFERENCE_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer()
        .catch(() => { throw new BadRequestException('Não deu para ler essa foto. Use JPEG, PNG ou WEBP.'); });
    return { buffer, mimeType: 'image/jpeg' };
}

// Capa das playlists criadas na conta do Mofy: imagem do usuário ou gerada pela IA
// (mesmo estilo e mesma regra de crédito da arte do humor no perfil).
// Uma imagem só, quadrada: vai para o Spotify (640, JPEG ≤ 256 KB) e para o card do perfil (até 1024).
@Injectable()
export class PlaylistCoverService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly account: SpotifyMofyAccountService,
        private readonly aiImage: AiImageService,
        private readonly emotionAnalysis: EmotionAnalysisService,
        private readonly credits: CreditService,
        private readonly centroids: MoodCentroidsService,
        private readonly enrichment: TrackEnrichmentService,
        @Inject(FILE_STORAGE) private readonly storage: FileStorageService,
    ) { }

    async upload(userId: string, playlistId: string, file: UploadFile): Promise<CoverResponse> {
        const owned = await this.ensureOwner(userId, playlistId);
        const cover = await toSpotifyCover(file.buffer).catch((err) => {
            if (err instanceof HttpException) throw err;
            throw new BadRequestException('Não deu para ler essa imagem. Use JPEG, PNG ou WEBP.');
        });
        await this.applyOnSpotify(owned, playlistId, cover);
        await this.saveProfileArt(userId, playlistId, file.buffer);
        return { preview: `data:image/jpeg;base64,${cover}` };
    }

    // Capas que o usuário já criou (enviadas ou geradas), das mais novas, sem repetir a mesma imagem
    // (uma capa reaproveitada guarda a mesma URL).
    async saved(userId: string): Promise<{ covers: SavedCover[] }> {
        const rows = await this.repository.listUserCovers(userId, SAVED_COVERS_LIMIT * 3);
        const seen = new Set<string>();
        const covers: SavedCover[] = [];
        for (const row of rows) {
            if (!row.coverUrl || seen.has(row.coverUrl)) continue;
            seen.add(row.coverUrl);
            covers.push({ id: row.id, coverUrl: row.coverUrl, title: row.title, sentiment: row.sentiment });
            if (covers.length === SAVED_COVERS_LIMIT) break;
        }
        return { covers };
    }

    // Usa numa playlist nova a capa de outra playlist do usuário (grátis). A origem vem pelo id do Mofy,
    // nunca por URL: só capas dele, e a API não busca endereço qualquer. O card guarda a mesma URL.
    async reuse(userId: string, playlistId: string, fromId: string): Promise<CoverResponse> {
        const owned = await this.ensureOwner(userId, playlistId);
        const source = await this.repository.findUserMofyPlaylist(userId, fromId);
        if (!source?.coverUrl) throw new NotFoundException('Capa não encontrada.');
        const image = await fetchCover(source.coverUrl).catch(() => {
            throw new BadRequestException('Não deu para abrir essa capa agora. Tente de novo.');
        });
        const cover = await toSpotifyCover(image);
        await this.applyOnSpotify(owned, playlistId, cover);
        await this.repository.setMofyPlaylistCover(userId, playlistId, source.coverUrl);
        return { preview: `data:image/jpeg;base64,${cover}` };
    }

    // Arquivo da capa guardada, para baixar (o front não baixa direto do storage, que é de outro domínio).
    async download(userId: string, id: string): Promise<Buffer> {
        const row = await this.repository.findUserMofyPlaylist(userId, id);
        if (!row?.coverUrl) throw new NotFoundException('Essa playlist não tem capa.');
        return await fetchCover(row.coverUrl).catch(() => {
            throw new NotFoundException('Não deu para abrir essa capa agora. Tente de novo.');
        });
    }

    // 1 crédito, devolvido se algo falhar. A arte usa só o humor FINAL da playlist (a chegada,
    // na jornada): o guardado na criação. O enviado pela tela só vale para playlists antigas, sem ele.
    // Referência: a foto do rosto do perfil ('profile', segue sem foto se não houver), uma foto enviada
    // agora ({ photo }) ou nenhuma. Selfie vira a personagem; paisagem, lugar ou objeto vira o cenário.
    async generate(userId: string, playlistId: string, requested: string, source: 'profile' | 'none' | { photo: UploadFile }): Promise<CoverResponse> {
        const owned = await this.ensureOwner(userId, playlistId);
        const sentiment = owned.sentiment ?? requested;
        if (!EMOTION_CLUSTERS.includes(sentiment)) throw new BadRequestException('Humor inválido para a capa.');
        const photo = typeof source === 'object' ? await toReferencePhoto(source.photo.buffer) : null;
        const music = await this.musicContext(owned.trackIds, sentiment);

        const { remaining } = await this.credits.consumeCredit(userId, `Capa de playlist ${sentiment}`);
        try {
            const reference = await this.reference(userId, source, photo);
            const mood = this.emotionAnalysis.classifyEmotion(getClusterVector(sentiment)!);
            const prompt = await this.aiImage.buildHybridImagePrompt({
                ativacao: mood.coreAxes.ativacao,
                sentiment,
                reference: reference?.kind ?? null,
                ...music,
            });
            // Uma chamada só, já quadrada: a mesma imagem vai para o Spotify e para o card.
            const image = await this.aiImage.generateImage(prompt, reference?.image);
            const cover = await toSpotifyCover(image);
            await this.applyOnSpotify(owned, playlistId, cover);
            const imageUrl = await this.saveProfileArt(userId, playlistId, image);
            await this.repository.logCoverGeneration({
                userId, mofyPlaylistId: owned.id, title: owned.title, sentiment,
                reference: reference?.kind.kind ?? 'none', ...this.aiImage.settings, prompt, imageUrl,
            }).catch((err) => console.error('[PlaylistCover] capa gerada, mas o registro do prompt falhou:', err?.message ?? err));
            return { preview: `data:image/jpeg;base64,${cover}`, remainingCredits: remaining };
        } catch (error) {
            await this.credits.refundCredit(userId, 'Estorno: falha na capa de playlist').catch((refundError) =>
                console.error(`[Credits] falha ao estornar crédito do usuário ${userId}:`, refundError),
            );
            console.error('[PlaylistCover] falha ao gerar capa:', error?.message ?? error);
            // Falta de permissão da conta do Mofy: mostra a mensagem certa (o crédito já voltou).
            if (error instanceof HttpException && error.getStatus() === 503) throw error;
            throw new BadRequestException('Não foi possível gerar a capa agora. Seu crédito foi devolvido.');
        }
    }

    // A foto do perfil é sempre um rosto (sem leitura); a enviada agora é lida para saber o que ela é.
    private async reference(userId: string, source: 'profile' | 'none' | { photo: UploadFile }, photo: ReferenceImage | null)
        : Promise<{ image: ReferenceImage; kind: CoverReference } | null> {
        if (photo) return { image: photo, kind: await this.aiImage.describeReference(photo) };
        if (source !== 'profile') return null;
        const path = await this.repository.getFacePhotoPath(userId);
        const image = path ? await this.aiImage.loadReference(path) : null;
        return image ? { image, kind: { kind: 'person' } } : null;
    }

    // O que a playlist tem de concreto, para a arte não depender só do humor: o subgênero que mais aparece e
    // UMA música, a mais forte (a mais perto do humor), com poucas linhas da letra. Título da playlist e lista
    // de músicas ficam fora: o modelo de imagem pesava demais neles. Música explícita vai sem letra (a
    // moderação da imagem recusa o prompt).
    private async musicContext(trackIds: unknown, sentiment: string): Promise<Pick<HybridPromptInput, 'subgenre' | 'song'>> {
        const ids = trackIdsOf(trackIds);
        if (!ids.length) return {};
        const [{ analyses, tracks }, clusters] = await Promise.all([
            this.repository.getTracksForShowcase(ids),
            this.centroids.clusters(),
        ]);
        const analysisById = new Map(analyses.map(a => [a.spotifyid, a]));
        const trackById = new Map(tracks.map(t => [t.spotifyId, t]));
        const items = ids.flatMap(id => {
            const track = trackById.get(id);
            if (!track) return [];
            const analysis = analysisById.get(id);
            return [{
                spotifyId: id, title: track.title, artist: track.artist, imgUrl: track.img_url ?? '',
                vector: toVector(analysis?.emotionalVector), subgenre: analysis?.subgenre ?? null,
            }];
        });
        const { strongestTrack, subgenre } = showcaseStats(clusters[sentiment] ?? null, items);
        if (!strongestTrack) return { subgenre };

        const track = trackById.get(strongestTrack.spotifyId)!;
        const lyrics = track.explicit ? [] : await this.enrichment.lyricLines(track);
        return {
            subgenre,
            song: { title: track.title, artist: track.artist.split(', ')[0], lyrics },
        };
    }

    // Capas geradas (prompt, imagem, modelo), das mais novas, para a galeria do admin.
    async generationLog(page: number, perPage: number) {
        return await this.repository.listCoverGenerations((page - 1) * perPage, perPage);
    }

    // Guarda a arte quadrada para o card do perfil e devolve a URL. Se falhar, a capa já está no Spotify: só registra.
    private async saveProfileArt(userId: string, playlistId: string, image: Buffer): Promise<string | null> {
        try {
            const art = await toProfileArt(image);
            const url = await this.storage.uploadPlaylistCover({ buffer: art, originalname: 'cover.jpg', mimetype: 'image/jpeg' }, userId);
            await this.repository.setMofyPlaylistCover(userId, playlistId, url);
            return url;
        } catch (error) {
            console.error('[PlaylistCover] capa aplicada no Spotify, mas a arte do perfil não foi salva:', error?.message ?? error);
            return null;
        }
    }

    // Só a playlist da conta do Mofy recebe a capa no Spotify; a trazida pelo link é do usuário (o Mofy não
    // tem como mudar a capa dela): a capa fica no Mofy, para baixar.
    private async applyOnSpotify(owned: { imported: boolean }, playlistId: string, cover: string): Promise<void> {
        if (!owned.imported) await this.account.setCover(playlistId, cover);
    }

    private async ensureOwner(userId: string, playlistId: string) {
        const owned = await this.repository.findOwnedMofyPlaylist(userId, playlistId);
        if (!owned) throw new NotFoundException('Playlist não encontrada.');
        return owned;
    }
}
