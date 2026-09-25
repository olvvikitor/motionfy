import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { CreditService } from "src/modules/credits/credit.service";
import { AiImageService } from "src/shared/infra/IA/AiImage.service";
import { EMOTION_CLUSTERS, EmotionAnalysisService, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { SpotifyMofyAccountService } from "src/shared/infra/music/spotify/spotify-mofy-account.service";
import { FILE_STORAGE } from "src/shared/infra/storage/interfaces/file-storage.interface";
import type { FileStorageService, UploadFile } from "src/shared/infra/storage/interfaces/file-storage.interface";
import { PlaylistRepository } from "../repository/playlist.repository";

const COVER_SIZE = 640;
// O Spotify aceita até 256 KB de base64 na capa; folga para não bater no limite.
const MAX_BASE64_LENGTH = 250 * 1024;
const JPEG_QUALITIES = [85, 75, 65, 55, 45, 35];
// Arte do perfil (9:16): até 1080×1920, sem aumentar imagem pequena.
const ART_MAX = { width: 1080, height: 1920 };

export type CoverResponse = { preview: string; remainingCredits?: number };

// Quadrado 640×640 em JPEG para o Spotify, baixando a qualidade até caber no limite.
// O recorte "attention" procura a parte com mais detalhe (rosto, personagem) em vez do
// meio exato: a mesma arte 9:16 do perfil vira a capa 1:1 sem gerar outra imagem.
export async function toSpotifyCover(image: Buffer): Promise<string> {
    const square = sharp(image).rotate().resize(COVER_SIZE, COVER_SIZE, { fit: 'cover', position: sharp.strategy.attention });
    for (const quality of JPEG_QUALITIES) {
        const base64 = (await square.clone().jpeg({ quality, mozjpeg: true }).toBuffer()).toString('base64');
        if (base64.length <= MAX_BASE64_LENGTH) return base64;
    }
    throw new BadRequestException('Não deu para deixar a imagem pequena o bastante para o Spotify. Tente outra.');
}

// Arte inteira para o card do perfil (formato original, normalmente 9:16), em JPEG.
export async function toProfileArt(image: Buffer): Promise<Buffer> {
    return sharp(image).rotate()
        .resize(ART_MAX.width, ART_MAX.height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
}

// Capa das playlists criadas na conta do Mofy: imagem do usuário ou gerada pela IA
// (mesmo estilo e mesma regra de crédito da arte do humor no perfil).
// Uma imagem só, dois usos: a arte 9:16 vai para o card do perfil; o recorte 1:1, para o Spotify.
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

    // 1 crédito, devolvido se algo falhar. A arte usa só o humor FINAL da playlist (a chegada,
    // na jornada): o guardado na criação. O enviado pela tela só vale para playlists antigas, sem ele.
    async generate(userId: string, playlistId: string, requested: string): Promise<CoverResponse> {
        const owned = await this.ensureOwner(userId, playlistId);
        const sentiment = owned.sentiment ?? requested;
        if (!EMOTION_CLUSTERS.includes(sentiment)) throw new BadRequestException('Humor inválido para a capa.');
        const facePhoto = await this.repository.getFacePhotoPath(userId);

        const { remaining } = await this.credits.consumeCredit(userId, `Capa de playlist ${sentiment}`);
        try {
            const mood = this.emotionAnalysis.classifyEmotion(getClusterVector(sentiment)!);
            const prompt = await this.aiImage.buildHybridImagePrompt({
                ativacao: mood.coreAxes.ativacao,
                moodScore: mood.moodScore,
                coreAxes: mood.coreAxes,
                sentiment,
                faceReferencePath: facePhoto,
                format: 'cover',
            });
            // Uma chamada só, em 9:16; o quadrado sai do recorte.
            const image = await this.aiImage.generateImage(prompt, facePhoto ?? undefined, '1024x1536');
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

    // Guarda a arte inteira (9:16) para o card do perfil. Se falhar, a capa já está no Spotify: só registra.
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
