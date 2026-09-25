import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Track } from "@prisma/client";
import { UserRepository } from "../repository/user.repository";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiTextService, ResponseAi } from "src/shared/infra/IA/AiText.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { EMOTIONAL_DIMENSIONS, EmotionAnalysisService, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";
import { TrackAnalysisReadItem } from "src/modules/tracks/repository/TrackRepository";

// O humor pode ser recalculado de hora em hora, com as músicas das últimas 3h.
const MOOD_REFRESH_MS = 60 * 60 * 1000;
const MOOD_WINDOW_HOURS = 3;

export function canRefreshMood(lastAnalyzedAt: Date | null, now: Date): boolean {
    return !lastAnalyzedAt || now.getTime() - lastAnalyzedAt.getTime() >= MOOD_REFRESH_MS;
}

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
        private emotionAnalysis: EmotionAnalysisService,
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

    private computeMostListened(tracks: any[]): { mostListenedSubgenre?: string, mostListenedSong?: { name: string, artist: string, img_url: string } } {
        if (!tracks || !tracks.length) return {};
        const trackCounts = new Map<string, number>();
        const subgenreCounts = new Map<string, number>();

        tracks.forEach(t => {
            const songKey = t.id || t.spotifyId;
            if (songKey) trackCounts.set(songKey, (trackCounts.get(songKey) || 0) + 1);

            const sg = t.subgenre || t.subGenre || t.sub_genero;
            if (sg) subgenreCounts.set(sg, (subgenreCounts.get(sg) || 0) + 1);
        });

        let topSongId = "";
        let maxSongCount = 0;
        for (const [id, count] of trackCounts.entries()) {
            if (count > maxSongCount) { maxSongCount = count; topSongId = id; }
        }

        let topSubgenre = "";
        let maxSubgenreCount = 0;
        for (const [sg, count] of subgenreCounts.entries()) {
            if (count > maxSubgenreCount) { maxSubgenreCount = count; topSubgenre = sg; }
        }

        let mostListenedSong: { id: string, name: string, artist: string, img_url: string } | undefined;
        let mostListenedSubgenre: string | undefined;

        if (topSubgenre) mostListenedSubgenre = topSubgenre;

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

        console.log("DEBUG mostListened computed:", { mostListenedSubgenre, mostListenedSong: mostListenedSong?.name });
        return { mostListenedSubgenre, mostListenedSong };
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
            mostListenedSubgenre: mostListened.mostListenedSubgenre,
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
        };
    }

    async lastTracks(id: string): Promise<void> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');
        const providerMusic = this.providerMusic.getProvider(user.provider);
        const tracks = await providerMusic.getLastRecentlyPlayed(user.refreshToken!);
        await this.saveTrackService.saveMusicsHistoryLine(tracks, user.id);
        // A biblioteca (curtidas/playlists) não é mais puxada aqui: o usuário escolhe o que
        // entra pela tela de biblioteca (módulo library).
    }

    // Recalcula o humor (sem imagem).
    async RefreshMoodUserToday(id: string): Promise<ResponseAi> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');

        const lastMood = await this.userRepository.getMoodUser(id);
        if (!canRefreshMood(lastMood ? new Date(lastMood.analyzedAt) : null, new Date())) {
            throw new BadRequestException('Seu mood já foi gerado há menos de 1 hora.');
        }
        await this.lastTracks(id);
        return this.recomputeMood(id, lastMood);
    }

    // Chamado sozinho pelo app (ao abrir e ao voltar para a aba). Recalcula se já passou
    // 1 hora e houve música nova desde o último humor; senão responde sem erro. Sem música
    // nova não cria outro humor igual (ele entraria na linha do tempo e nas contagens).
    async autoRefreshMood(id: string): Promise<{ updated: boolean }> {
        const lastMood = await this.userRepository.getMoodUser(id);
        const lastAt = lastMood ? new Date(lastMood.analyzedAt) : null;
        if (!canRefreshMood(lastAt, new Date())) return { updated: false };

        await this.lastTracks(id);
        if (lastAt && !(await this.trackRepository.hasListenedSince(id, lastAt))) return { updated: false };

        await this.recomputeMood(id, lastMood);
        return { updated: true };
    }

    // Espera o histórico já sincronizado com o Spotify (lastTracks).
    private async recomputeMood(
        id: string,
        lastMood: Awaited<ReturnType<UserRepository["getMoodUser"]>>,
    ): Promise<ResponseAi> {
        const historyMusic = await this.trackRepository.getListenedLastHours(id, MOOD_WINDOW_HOURS);

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
                reasoning: `Sem análises suficientes para compor o mood agora — nenhuma música ouvida nas últimas ${MOOD_WINDOW_HOURS}h.`,
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

        // O humor não tem imagem (as artes são as capas das playlists).
        response.image_mood = "";
        await this.userRepository.SaveMood(id, { ...moodDataStore, image_mood: null });

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

    // Se o Last.fm está recebendo músicas do app da pessoa. Só faz sentido para quem entrou
    // pelo Last.fm; os outros provedores leem direto do player (applicable: false).
    async scrobbleStatus(id: string): Promise<{ applicable: boolean; lastScrobbleAt: string | null }> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');
        const providerMusic = this.providerMusic.getProvider(user.provider);
        if (!providerMusic.getLastActivity) return { applicable: false, lastScrobbleAt: null };
        const last = await providerMusic.getLastActivity(user.refreshToken!);
        return { applicable: true, lastScrobbleAt: last?.toISOString() ?? null };
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
            isrc: currentTrack.isrc ?? null,
            explicit: currentTrack.explicit ?? null,
            releaseDate: currentTrack.releaseDate ?? null,
            durationMs: currentTrack.durationMs ?? null,
            createdAt: currentTrack.createdAt ?? new Date(),
        };
        try {
            const analysis = await this.aiTextService.analyzeMusicMoodByHistoryToday([trackToAnalyze]);
            return { isPlaying: true, ...analysis };
        } catch (error) {
            console.error("Erro ao analisar faixa atual:", error);
            const fallbackVector = this.emotionAnalysis.buildFallbackVector();
            const fallbackEmotion = this.emotionAnalysis.classifyEmotion(fallbackVector);
            return {
                isPlaying: true,
                moodScore: fallbackEmotion.moodScore,
                dominantSentiment: fallbackEmotion.dominantSentiment,
                emotionalVector: fallbackVector,
                coreAxes: fallbackEmotion.coreAxes,
                reasoning: '',
                image_mood: '',
                tracks: [],
            };
        }
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
