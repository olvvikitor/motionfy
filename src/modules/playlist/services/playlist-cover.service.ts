import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { CreditService } from "src/modules/credits/credit.service";
import { AiImageService, type ReferenceImage } from "src/shared/infra/IA/AiImage.service";
import type { CoverReference } from "src/shared/infra/IA/ImagePrompt.service";
import { EMOTION_CLUSTERS, EmotionAnalysisService, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { SpotifyMofyAccountService } from "src/shared/infra/music/spotify/spotify-mofy-account.service";
import { FILE_STORAGE } from "src/shared/infra/storage/interfaces/file-storage.interface";
import type { FileStorageService, UploadFile } from "src/shared/infra/storage/interfaces/file-storage.interface";
import { PlaylistRepository } from "../repository/playlist.repository";

const COVER_SIZE = 640;
// O Spotify aceita até 256 KB de base64 na capa; folga para não bater no limite.
const MAX_BASE64_LENGTH = 250 * 1024;
const JPEG_QUALITIES = [85, 75, 65, 55, 45, 35];
// Arte do card do perfil: quadrada, como a capa do Spotify.
const ART_SIZE = 1024;
// Foto de referência: o lado maior; basta para o modelo de imagem, e o envio fica leve.
const REFERENCE_SIZE = 1024;

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

// Arte do card do perfil: o mesmo quadrado da capa do Spotify, em tamanho maior.
export async function toProfileArt(image: Buffer): Promise<Buffer> {
    return sharp(image).rotate()
        .resize(ART_SIZE, ART_SIZE, { fit: 'cover', position: sharp.strategy.attention })
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
// Uma imagem só, quadrada: vai para o Spotify (640, JPEG ≤ 256 KB) e para o card do perfil (1024).
@Injectable()
export class PlaylistCoverService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly account: SpotifyMofyAccountService,
        private readonly aiImage: AiImageService,
        private readonly emotionAnalysis: EmotionAnalysisService,
        private readonly credits: CreditService,
        @Inject(FILE_STORAGE) private readonly storage: FileStorageService,
    ) { }

    async upload(userId: string, playlistId: string, file: UploadFile): Promise<CoverResponse> {
        await this.ensureOwner(userId, playlistId);
        const cover = await toSpotifyCover(file.buffer).catch((err) => {
            if (err instanceof HttpException) throw err;
            throw new BadRequestException('Não deu para ler essa imagem. Use JPEG, PNG ou WEBP.');
        });
        await this.account.setCover(playlistId, cover);
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
        await this.ensureOwner(userId, playlistId);
        const source = await this.repository.findUserMofyPlaylist(userId, fromId);
        if (!source?.coverUrl) throw new NotFoundException('Capa não encontrada.');
        const image = await fetchCover(source.coverUrl).catch(() => {
            throw new BadRequestException('Não deu para abrir essa capa agora. Tente de novo.');
        });
        const cover = await toSpotifyCover(image);
        await this.account.setCover(playlistId, cover);
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
        const music = await this.musicContext(owned.trackIds);

        const { remaining } = await this.credits.consumeCredit(userId, `Capa de playlist ${sentiment}`);
        try {
            const reference = await this.reference(userId, source, photo);
            const mood = this.emotionAnalysis.classifyEmotion(getClusterVector(sentiment)!);
            const prompt = await this.aiImage.buildHybridImagePrompt({
                ativacao: mood.coreAxes.ativacao,
                sentiment,
                reference: reference?.kind ?? null,
                title: owned.title,
                ...music,
            });
            // Uma chamada só, já quadrada: a mesma imagem vai para o Spotify e para o card.
            const image = await this.aiImage.generateImage(prompt, reference?.image);
            const cover = await toSpotifyCover(image);
            await this.account.setCover(playlistId, cover);
            await this.saveProfileArt(userId, playlistId, image);
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

    // O que a playlist tem de concreto, para a arte não depender só do humor:
    // subgêneros mais comuns e algumas músicas (primeiro artista — título).
    private async musicContext(trackIds: unknown): Promise<{ subgenres: string[]; songs: string[] }> {
        const ids = Array.isArray(trackIds) ? trackIds.filter((id): id is string => typeof id === 'string') : [];
        if (!ids.length) return { subgenres: [], songs: [] };
        const { analyses, tracks } = await this.repository.getTracksForShowcase(ids);

        const counts = new Map<string, number>();
        for (const { subgenre } of analyses) {
            if (subgenre && subgenre !== 'Unknown') counts.set(subgenre, (counts.get(subgenre) ?? 0) + 1);
        }
        const subgenres = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

        const byId = new Map(tracks.map(t => [t.spotifyId, t]));
        const songs = ids.flatMap(id => {
            const track = byId.get(id);
            return track ? [`${track.artist.split(', ')[0]} — ${track.title}`] : [];
        });
        return { subgenres, songs };
    }

    // Guarda a arte quadrada para o card do perfil. Se falhar, a capa já está no Spotify: só registra.
    private async saveProfileArt(userId: string, playlistId: string, image: Buffer): Promise<void> {
        try {
            const art = await toProfileArt(image);
            const url = await this.storage.uploadPlaylistCover({ buffer: art, originalname: 'cover.jpg', mimetype: 'image/jpeg' }, userId);
            await this.repository.setMofyPlaylistCover(userId, playlistId, url);
        } catch (error) {
            console.error('[PlaylistCover] capa aplicada no Spotify, mas a arte do perfil não foi salva:', error?.message ?? error);
        }
    }

    private async ensureOwner(userId: string, playlistId: string) {
        const owned = await this.repository.findOwnedMofyPlaylist(userId, playlistId);
        if (!owned) throw new NotFoundException('Playlist não encontrada.');
        return owned;
    }
}
