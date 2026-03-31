import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Track } from "@prisma/client";
import { UserRepository } from "../repository/user.repository";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiService, ResponseAi } from "src/shared/infra/IA/Ai.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { ImagePromptService, StudioStyleOption } from "src/shared/infra/IA/ImagePrompt.service";
import { EMOTIONAL_DIMENSIONS, EmotionAnalysisService, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";
import { TrackAnalysisReadItem } from "src/modules/tracks/repository/TrackRepository";
import path from "path";
import { FILE_STORAGE, UploadFile, type FileStorageService } from "src/shared/infra/storage/interfaces/file-storage.interface";

export type ListeningNowResponse =
    | ({ isPlaying: true } & ResponseAi)
    | { isPlaying: false };

@Injectable()
export class UserService {
    constructor(
        private userRepository: UserRepository,
        private providerMusic: MusicProviderFactory,
        private saveTrackService: SaveTracks,
        private trackRepository: TrackRepository,
        private aiService: AiService,
        private prompt_imageService: ImagePromptService,
        private emotionAnalysis: EmotionAnalysisService,
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorageService,

    ) { }

    private toEmotionalVector(value: unknown): EmotionalVector | null {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        const candidate = value as Record<string, unknown>;
        const vector: Partial<EmotionalVector> = {};
        for (const dimension of EMOTIONAL_DIMENSIONS) {
            const num = candidate[dimension];
            if (typeof num !== "number" || !Number.isFinite(num)) return null;
            vector[dimension] = num;
        }
        return vector as EmotionalVector;
    }

    private buildMoodFromStoredAnalyses(
        tracks: Track[],
        analyses: TrackAnalysisReadItem[],
    ): ResponseAi | null {
        if (!tracks.length || !analyses.length) return null;
        const analysisBySpotifyId = new Map(analyses.map((a) => [a.spotifyid, a]));
        const mergedTracks = tracks
            .map((track) => {
                if (!track.spotifyId) return null;
                const analysis = analysisBySpotifyId.get(track.spotifyId);
                if (!analysis) return null;
                const vector = this.toEmotionalVector(analysis.emotionalVector);
                if (!vector) return null;
                const coreAxes = analysis.coreAxes;
                if (!coreAxes || typeof coreAxes !== "object" || Array.isArray(coreAxes)) return null;
                return {
                    id: track.id,
                    music: track.title,
                    artist: track.artist,
                    img_url: track.img_url ?? "",
                    emotionalVector: vector,
                    dominantSentiment: analysis.dominantSentiment,
                    reasoning: analysis.reasoning,
                    moodScore: analysis.moodScore,
                    coreAxes: coreAxes as any,
                };
            })
            .filter((item) => item !== null);

        if (!mergedTracks.length) return null;

        const sums = Object.fromEntries(EMOTIONAL_DIMENSIONS.map((d) => [d, 0])) as Record<string, number>;
        for (const track of mergedTracks) {
            for (const dimension of EMOTIONAL_DIMENSIONS) sums[dimension] += track.emotionalVector[dimension];
        }
        const avgVector = Object.fromEntries(
            EMOTIONAL_DIMENSIONS.map((d) => [d, sums[d] / mergedTracks.length]),
        ) as EmotionalVector;
        const classification = this.emotionAnalysis.classifyEmotion(avgVector);

        return {
            moodScore: classification.moodScore,
            dominantSentiment: classification.dominantSentiment,
            emotionalVector: avgVector,
            reasoning: `Baseado em ${mergedTracks.length} faixas analisadas`,
            coreAxes: classification.coreAxes,
            image_mood: "",
            tracks: mergedTracks,
        };
    }

    async getInfo(id: string): Promise<UserResponseDto> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');
        setImmediate(() => {
            this.lastTracks(id).catch(err => console.error('Erro ao atualizar lastTracks:', err));
        });
        return {
            country: user.country,
            display_name: user.display_name,
            email: user.email!,
            id: user.id,
            img_profile: user.img_profile,
            face_photo_path: user.face_photo_path,
            provider: user.provider,
        };
    }

    async lastTracks(id: string): Promise<void> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');
        const providerMusic = this.providerMusic.getProvider(user.provider);
        const tracks = await providerMusic.getLastRecentlyPlayed(user.refreshToken!);
        await this.saveTrackService.saveMusicsHistoryLine(tracks, user.id);
    }

    async getRefreshMoodStudios(): Promise<StudioStyleOption[]> {
        return this.prompt_imageService.getAvailableStudios();
    }

    async RefreshMoodUserToday(id: string, studioId?: string): Promise<ResponseAi> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');

        await this.lastTracks(id);

        const historyMusic = await this.trackRepository.getLastListened(id, 10);
        const uniqueBySpotifyId = new Map<string, Track>();
        for (const item of historyMusic) {
            const spotifyId = item.track?.spotifyId;
            if (!spotifyId || uniqueBySpotifyId.has(spotifyId)) continue;
            uniqueBySpotifyId.set(spotifyId, item.track);
        }

        const tracks = Array.from(uniqueBySpotifyId.values());
        const spotifyIds = tracks
            .map((t) => t.spotifyId)
            .filter((id): id is string => Boolean(id));

        let trackAnalyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
        let response = this.buildMoodFromStoredAnalyses(tracks, trackAnalyses);

        if (!response && tracks.length) {
            await this.saveTrackService.ensureTrackAnalysesUpToDate(id, 100);
            trackAnalyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
            response = this.buildMoodFromStoredAnalyses(tracks, trackAnalyses);
        }

        if (!response) {
            const fallbackVector = this.emotionAnalysis.buildFallbackVector();
            const fallbackClassification = this.emotionAnalysis.classifyEmotion(fallbackVector);
            response = {
                moodScore: fallbackClassification.moodScore,
                dominantSentiment: fallbackClassification.dominantSentiment,
                emotionalVector: fallbackVector,
                reasoning: "Sem análises suficientes para compor o mood agora",
                coreAxes: fallbackClassification.coreAxes,
                image_mood: "",
                tracks: [],
            };
        }

        const image_mood = this.prompt_imageService.build({
            ativacao: response.coreAxes.ativacao,
            moodScore: response.moodScore,
            coreAxes:response.coreAxes,
            sentiment: response.dominantSentiment,
            emotions: response.emotionalVector,
            faceReferencePath: user.face_photo_path,
            studioId,
        });
        const image_charged = await this.aiService.genereateImage(image_mood, user.face_photo_path ?? undefined);
        const cleanBase64 = image_charged.replace(/^data:image\/png;base64,/, '');

        const buffer = Buffer.from(cleanBase64, 'base64');

        const file: UploadFile = {
            buffer,
            originalname: 'mood.png',
            mimetype: 'image/png',
        };
        const img_url = await this.fileStorage.uploadMoodPhoto(file, user.id)

        const mood = {
            moodScore: response.moodScore,
            sentiment: response.dominantSentiment,
            image_mood: img_url,
            emotions: response.emotionalVector,
            coreAxes: response.coreAxes,
            tracks: response.tracks,
        };

        setImmediate(() => {
            this.userRepository.SaveMood(id, mood).catch(err => console.error('Erro ao salvar mood:', err));
        });
        response.image_mood = image_charged;

        return response;
    }

    async getMoodUserToday(id: string): Promise<any> {
        return this.userRepository.getMoodUser(id);
    }

    async getValidToken(id: string): Promise<string> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuário não encontrado');
        return user.accessToken!;
    }

    async listeningNow(id: string): Promise<ListeningNowResponse> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');
        const providerMusic = this.providerMusic.getProvider(user.provider);
        const currentTrack = await providerMusic.getListeningNow(user.refreshToken!);
        if (!currentTrack) return { isPlaying: false };
        const trackToAnalyze: Track = {
            id: currentTrack.spotifyId,
            spotifyId: currentTrack.spotifyId,
            title: currentTrack.title,
            artist: currentTrack.artist,
            album: currentTrack.album,
            img_url: currentTrack.img_url,
            createdAt: currentTrack.createdAt ?? new Date(),
        };
        const analysis = await this.aiService.analyzeMusicMoodByHistoryToday([trackToAnalyze]);
        return { isPlaying: true, ...analysis };
    }

    // ─── Novos endpoints de perfil ────────────────────────────────────────────

    async getMoodHistory(id: string, limit = 20) {
        return this.userRepository.getMoodHistory(id, limit);
    }

    async getMoodWeek(id: string) {
        return this.userRepository.getMoodWeek(id);
    }

    async getUserStats(id: string) {
        return this.userRepository.getUserStats(id);
    }
}
