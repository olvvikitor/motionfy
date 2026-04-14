import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Track } from "@prisma/client";
import { UserRepository } from "../repository/user.repository";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiTextService, ResponseAi } from "src/shared/infra/IA/AiText.service";
import { AiImageService } from "src/shared/infra/IA/AiImage.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { ImagePromptService, StudioStyleOption } from "src/shared/infra/IA/ImagePrompt.service";
import { EMOTIONAL_DIMENSIONS, EmotionAnalysisService, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";
import { TrackAnalysisReadItem } from "src/modules/tracks/repository/TrackRepository";
import { FILE_STORAGE, UploadFile, type FileStorageService } from "src/shared/infra/storage/interfaces/file-storage.interface";
import { CreditService } from "src/modules/credits/credit.service";

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
        private aiTextService: AiTextService,
        private aiImageService: AiImageService,
        private prompt_imageService: ImagePromptService,
        private emotionAnalysis: EmotionAnalysisService,
        private creditService: CreditService,
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

    private normalizeSentimentLabel(label?: string): string {
        return label
            ?.trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\s_-]+/g, "") ?? "";
    }

    private getTrackAggregationWeight(track: {
        emotionalVector: EmotionalVector;
        coreAxes: { polaridade: number; ativacao: number };
        dominantSentiment: string;
    }, index: number, total: number): number {
        const recencyRank = total - index;
        const recencyBoost = total <= 3 ? 1.6 : 0.6;
        const recencyWeight = 1 + ((recencyRank - 1) / Math.max(total - 1, 1)) * recencyBoost;

        const axisIntensity = (Math.abs(track.coreAxes.polaridade) + Math.abs(track.coreAxes.ativacao)) / 2;
        const vectorIntensity = (
            Math.abs(track.emotionalVector.Valencia - 0.5) +
            Math.abs(track.emotionalVector.Energia - 0.5) +
            Math.abs(track.emotionalVector.Euforia - 0.5) +
            Math.abs(track.emotionalVector.Tensao - 0.5)
        ) / 2;

        const convictionWeight = 0.7 + (axisIntensity * 0.6) + (vectorIntensity * 0.4);
        const ambivalenciaPenalty = this.normalizeSentimentLabel(track.dominantSentiment) === "ambivalencia" ? 0.75 : 1;

        return recencyWeight * convictionWeight * ambivalenciaPenalty;
    }

    private aggregateMoodVector(
        tracks: Array<{
            emotionalVector: EmotionalVector;
            dominantSentiment: string;
            coreAxes: { polaridade: number; ativacao: number };
        }>
    ): EmotionalVector {
        const weightedTracks = tracks.map((track, index) => ({
            track,
            weight: this.getTrackAggregationWeight(track, index, tracks.length),
            sentimentKey: this.normalizeSentimentLabel(track.dominantSentiment),
        }));

        const sentimentScores = new Map<string, number>();
        for (const item of weightedTracks) {
            const prev = sentimentScores.get(item.sentimentKey) ?? 0;
            sentimentScores.set(item.sentimentKey, prev + item.weight);
        }

        const dominantGroup = Array.from(sentimentScores.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        const selected = dominantGroup
            ? weightedTracks.filter((item) => item.sentimentKey === dominantGroup)
            : weightedTracks;

        const finalSet = selected.length >= 2 ? selected : weightedTracks;
        const totalWeight = finalSet.reduce((acc, item) => acc + item.weight, 0) || 1;

        const sums = Object.fromEntries(EMOTIONAL_DIMENSIONS.map((d) => [d, 0])) as Record<string, number>;
        for (const item of finalSet) {
            for (const dimension of EMOTIONAL_DIMENSIONS) {
                sums[dimension] += item.track.emotionalVector[dimension] * item.weight;
            }
        }

        return Object.fromEntries(
            EMOTIONAL_DIMENSIONS.map((d) => [d, sums[d] / totalWeight]),
        ) as EmotionalVector;
    }

    private computeMostListened(tracks: any[]): { mostListenedGenre?: string, mostListenedSong?: { name: string, artist: string, img_url: string } } {
        if (!tracks || !tracks.length) return {};
        const trackCounts = new Map<string, number>();
        const genreCounts = new Map<string, number>();

        tracks.forEach(t => {
            const songKey = t.id || t.spotifyId;
            if (songKey) trackCounts.set(songKey, (trackCounts.get(songKey) || 0) + 1);
            
            let g = t.genre;
            if (g) genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        });

        let topSongId = "";
        let maxSongCount = 0;
        for (const [id, count] of trackCounts.entries()) {
            if (count > maxSongCount) { maxSongCount = count; topSongId = id; }
        }

        let topGenre = "";
        let maxGenreCount = 0;
        for (const [g, count] of genreCounts.entries()) {
            if (count > maxGenreCount) { maxGenreCount = count; topGenre = g; }
        }

        let mostListenedSong: { id: string, name: string, artist: string, img_url: string } | undefined;
        let mostListenedGenre: string | undefined;

        if (topGenre) mostListenedGenre = topGenre;
        
        if (topSongId) {
            const topTrack = tracks.find(t => (t.id === topSongId) || (t.spotifyId === topSongId));
            if (topTrack) {
                mostListenedSong = {
                    id: topTrack.id || topTrack.spotifyId || topSongId,
                    name: topTrack.music || topTrack.title || "",
                    artist: topTrack.artist || "",
                    img_url: topTrack.img_url || ""
                };
            }
        }

        console.log("DEBUG mostListened computed:", { mostListenedGenre, mostListenedSong: mostListenedSong?.name });
        return { mostListenedGenre, mostListenedSong };
    }

    private buildMoodFromStoredAnalyses(tracks: Track[], analyses: TrackAnalysisReadItem[]): ResponseAi | null {
        if (!tracks.length || !analyses.length) return null;
        const analysisBySpotifyId = new Map(analyses.map((a) => [a.spotifyid, a]));
        const mergedTracks = tracks.map((track) => {
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
                genre: analysis.genre,
                subgenre: analysis.subgenre,
                moodScore: analysis.moodScore,
                coreAxes: coreAxes as any,
            };
        }).filter((item) => item !== null);

        if (!mergedTracks.length) return null;

        const avgVector = this.aggregateMoodVector(mergedTracks);
        const classification = this.emotionAnalysis.classifyEmotion(avgVector);

        const mostListened = this.computeMostListened(mergedTracks);

        return {
            moodScore: classification.moodScore,
            dominantSentiment: classification.dominantSentiment,
            emotionalVector: avgVector,
            reasoning: `Baseado em ${mergedTracks.length} faixas analisadas`,
            coreAxes: classification.coreAxes,
            image_mood: "",
            tracks: mergedTracks,
            mostListenedGenre: mostListened.mostListenedGenre,
            mostListenedSong: mostListened.mostListenedSong,
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
            preferredStudioId: (user as any).preferredStudioId, // Handle TS delay for new Prisma schema
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
        const now = new Date();

        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');

        const resolvedStudioId = studioId ?? user.preferredStudioId ?? undefined;

        let useTodayOnly = false;

        const lastMood = await this.userRepository.getMoodUser(id);
        if (lastMood) {
            const moodDate = new Date(lastMood.analyzedAt);
            const msIn24h = 24 * 60 * 60 * 1000;
            const isWithin24h = (now.getTime() - moodDate.getTime()) <= msIn24h;

            if (isWithin24h) {
                const isNowPast19h = now.getHours() >= 19;

                const isMoodFromToday =
                    moodDate.getDate() === now.getDate() &&
                    moodDate.getMonth() === now.getMonth() &&
                    moodDate.getFullYear() === now.getFullYear();

                const isMoodBefore19hToday = isMoodFromToday && moodDate.getHours() < 19;

                if (isNowPast19h && isMoodBefore19hToday) {
                    // Update triggered by 19h rule: usa apenas tracks do dia atual
                    
                    useTodayOnly = true;
                } else if (isNowPast19h && !isMoodFromToday) {
                    // Update triggered by 19h rule (old mood foi ontem): usa apenas tracks do dia atual
                    useTodayOnly = true;
                } else {
                    throw new BadRequestException('Seu mood já foi gerado recentemente. Volte após as 19h ou aguarde 24h.');
                }
            } else {
                // Passou de 24h: usa o bloco móvel de ultimas 24h
                useTodayOnly = false;
            }
        }

        await this.lastTracks(id);

        const historyMusic = useTodayOnly
            ? await this.trackRepository.getListenedToday(id)
            : await this.trackRepository.getListenedLast24Hours(id);

        const tracks = historyMusic
            .map((entry) => entry.track)
            .filter((track): track is Track => Boolean(track?.spotifyId));

        const spotifyIds = tracks.map((t) => t.spotifyId).filter((sid): sid is string => Boolean(sid));

        const trackAnalyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
        let response = this.buildMoodFromStoredAnalyses(tracks, trackAnalyses);

        if (!response) {
            const fallbackVector = this.emotionAnalysis.buildFallbackVector();
            const fallbackClassification = this.emotionAnalysis.classifyEmotion(fallbackVector);
            response = {
                moodScore: fallbackClassification.moodScore,
                dominantSentiment: fallbackClassification.dominantSentiment,
                emotionalVector: fallbackVector,
                reasoning: 'Sem análises suficientes para compor o mood agora — nenhuma música ouvida hoje.',
                coreAxes: fallbackClassification.coreAxes,
                image_mood: "",
                tracks: [],
            };
        }

        const moodDataStore = {
            moodScore: response.moodScore,
            sentiment: response.dominantSentiment,
            emotions: response.emotionalVector,
            coreAxes: response.coreAxes,
            tracks: response.tracks,
        };

        const isSameSentimentAsLast = lastMood && lastMood.sentiment === response.dominantSentiment && lastMood.image_mood;

        if (isSameSentimentAsLast) {
            response.image_mood = lastMood.image_mood as string;
            const finalMood = {
                ...moodDataStore,
                image_mood: lastMood.image_mood as string,
            };
            await this.userRepository.SaveMood(id, finalMood);
            return response;
        }

        // ── Gera imagem ──
        const imagePrompt = await this.aiImageService.buildHybridImagePrompt({
            ativacao: response.coreAxes.ativacao,
            moodScore: response.moodScore,
            coreAxes: response.coreAxes,
            sentiment: response.dominantSentiment,
            emotions: response.emotionalVector,
            faceReferencePath: user.face_photo_path,
            studioId: resolvedStudioId,
        });

        const imageBuffer = await this.aiImageService.generateImage(
            imagePrompt,
            user.face_photo_path ?? undefined
        );

        // Upload em background
        setImmediate(async () => {
            try {
                const file: UploadFile = {
                    buffer: imageBuffer,
                    originalname: 'mood.png',
                    mimetype: 'image/png',
                };

                const imgUrl = await this.fileStorage.uploadMoodPhoto(file, user.id);

                const finalMood = {
                    ...moodDataStore,
                    image_mood: imgUrl,
                };

                await this.userRepository.SaveMood(id, finalMood);
            } catch (err) {
                console.error('Erro ao fazer upload e salvar mood no background:', err);
            }
        });

        // Se quiser retornar base64 pro front:
        const base64 = imageBuffer.toString('base64');
        response.image_mood = `data:image/png;base64,${base64}`;

        return response;
    }
    async getMoodUserToday(id: string): Promise<any> {
        const mood = await this.userRepository.getMoodUser(id);
        if (mood && mood.tracksAnalyzeds) {
            const parsedTracks = typeof mood.tracksAnalyzeds === 'string' ? JSON.parse(mood.tracksAnalyzeds as string) : mood.tracksAnalyzeds;
            
            const mostListened = this.computeMostListened(Array.isArray(parsedTracks) ? parsedTracks : []);
            return {
                ...mood,
                ...mostListened
            };
        }
        return mood;
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
        const analysis = await this.aiTextService.analyzeMusicMoodByHistoryToday([trackToAnalyze]);
        return { isPlaying: true, ...analysis };
    }

    async getMoodHistory(id: string, limit = 1) {
        return this.userRepository.getMoodHistory(id, limit);
    }

    async getMoodWeek(id: string) {
        return this.userRepository.getMoodWeek(id);
    }

    async getUserStats(id: string) {
        return this.userRepository.getUserStats(id);
    }

    async getUserInsights(id: string) {
        return this.userRepository.getUserInsights(id);
    }

    async testMoodAlgorithm(id: string, limit?: number): Promise<any> {
        await this.lastTracks(id);

        const historyMusic = limit
            ? await this.trackRepository.getLastListened(id, limit)
            : await this.trackRepository.getListenedLast24Hours(id);

        const tracks = historyMusic
            .map((entry) => entry.track)
            .filter((track): track is Track => Boolean(track?.spotifyId));

        const spotifyIds = tracks.map((t) => t.spotifyId).filter((sid): sid is string => Boolean(sid));

        const trackAnalyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
        let response = this.buildMoodFromStoredAnalyses(tracks, trackAnalyses);

        if (!response) {
            const fallbackVector = this.emotionAnalysis.buildFallbackVector();
            const fallbackClassification = this.emotionAnalysis.classifyEmotion(fallbackVector);
            response = {
                moodScore: fallbackClassification.moodScore,
                dominantSentiment: fallbackClassification.dominantSentiment,
                emotionalVector: fallbackVector,
                reasoning: 'Sem análises suficientes para compor o mood.',
                coreAxes: fallbackClassification.coreAxes,
                image_mood: "",
                tracks: [],
            };
        }

        // Inclui probabilidades de emoção para debug
        const classification = this.emotionAnalysis.classifyEmotion(response.emotionalVector);

        return {
            ...response,
            image_mood: undefined,
            emotionProbabilities: classification.emotionProbabilities,
            tracksCount: tracks.length,
            source: limit ? `últimas ${limit}` : 'hoje',
        };
    }

    async getTodayTracksAnalyzed(id: string): Promise<any[]> {
        await this.lastTracks(id);
        const historyMusic = await this.trackRepository.getListenedLast24Hours(id);
        const tracks = historyMusic
            .map((entry) => entry.track)
            .filter((track): track is Track => Boolean(track?.spotifyId));

        const spotifyIds = tracks.map((t) => t.spotifyId).filter((sid): sid is string => Boolean(sid));
        const trackAnalyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
        const response = this.buildMoodFromStoredAnalyses(tracks, trackAnalyses);

        return response?.tracks ?? [];
    }

    async updateStudioPreference(id: string, studioId: string) {
        await this.userRepository.updateStudioPreference(id, studioId);
        return { message: 'Preferência de estúdio atualizada com sucesso' };
    }

    async addTrackToQueue(id: string, trackId: string): Promise<void> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');
        if (user.provider !== 'spotify') throw new BadRequestException('Disponível apenas para usuários do Spotify');
        
        const providerMusic = this.providerMusic.getProvider(user.provider);
        if (!providerMusic.addToQueue) {
            throw new BadRequestException('Ação não suportada por este provedor');
        }

        await providerMusic.addToQueue(user.refreshToken!, trackId);
    }
}
