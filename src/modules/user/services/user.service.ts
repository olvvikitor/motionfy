import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Track } from "@prisma/client";
import { UserRepository } from "../repository/user.repository";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiTextService, ResponseAi, SUBGENRE_TO_GENRE } from "src/shared/infra/IA/AiText.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { EMOTIONAL_DIMENSIONS, EmotionAnalysisService, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";
import { TrackAnalysisReadItem } from "src/modules/tracks/repository/TrackRepository";

// O humor é recalculado a cada música nova, com as músicas das últimas 3h. Sem nenhuma nesse
// período, fica "sem sentimento definido" (idle) e nenhum humor é criado.
const MOOD_WINDOW_HOURS = 3;
const MOOD_WINDOW_MS = MOOD_WINDOW_HOURS * 60 * 60 * 1000;
// Histórico sincronizado há menos que isso é reaproveitado (a tela abre várias consultas juntas
// e o app confere a cada minuto).
const HISTORY_SYNC_TTL_MS = 45 * 1000;

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
    ): { vector: EmotionalVector; sentiment: string | null } {
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

        const vector = Object.fromEntries(
            EMOTIONAL_DIMENSIONS.map((d) => [d, sums[d] / totalWeight]),
        ) as EmotionalVector;
        // O humor é o rótulo que o Jev deu ao grupo que venceu (só quando ele tem 2+ músicas).
        // Reclassificar a média pelos perfis à mão trocava o humor: 20 de 22 "Confianca" viravam "Energia".
        const sentiment = finalSet === selected ? selected[0].track.dominantSentiment : null;
        return { vector, sentiment };
    }

    private computeMostListened(tracks: any[]): { mostListenedGenre?: string, mostListenedSubgenre?: string, mostListenedSong?: { name: string, artist: string, img_url: string } } {
        if (!tracks || !tracks.length) return {};
        const trackCounts = new Map<string, number>();
        const subgenreCounts = new Map<string, number>();
        const genreCounts = new Map<string, number>();

        tracks.forEach(t => {
            const songKey = t.id || t.spotifyId;
            if (songKey) trackCounts.set(songKey, (trackCounts.get(songKey) || 0) + 1);

            const sg = t.subgenre || t.subGenre || t.sub_genero;
            if (sg) subgenreCounts.set(sg, (subgenreCounts.get(sg) || 0) + 1);
            // Gênero contado à parte (3 Indie Rock + 2 Hard Rock ganham de 4 Pop): é o que veste o bichinho.
            const genre = t.genre || (sg ? SUBGENRE_TO_GENRE[sg] : undefined);
            if (genre && genre !== "Unknown") genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        });

        let mostListenedGenre: string | undefined;
        let maxGenreCount = 0;
        for (const [genre, count] of genreCounts.entries()) {
            if (count > maxGenreCount) { maxGenreCount = count; mostListenedGenre = genre; }
        }

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

        return { mostListenedGenre, mostListenedSubgenre, mostListenedSong };
    }

    private toAnalyzedTrack(track: Track, analysis: TrackAnalysisReadItem | undefined) {
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
    }

    private buildMoodFromStoredAnalyses(tracks: Track[], analyses: TrackAnalysisReadItem[]): ResponseAi | null {
        if (!tracks.length || !analyses.length) return null;
        const analysisBySpotifyId = new Map(analyses.map((a) => [a.spotifyid, a]));
        const mergedTracks = tracks
            .map((track) => this.toAnalyzedTrack(track, track.spotifyId ? analysisBySpotifyId.get(track.spotifyId) : undefined))
            .filter((item) => item !== null);

        if (!mergedTracks.length) return null;

        const { vector: avgVector, sentiment } = this.aggregateMoodVector(mergedTracks);
        const classification = this.emotionAnalysis.classifyEmotion(avgVector);

        const mostListened = this.computeMostListened(mergedTracks);

        return {
            moodScore: classification.moodScore,
            dominantSentiment: sentiment ?? classification.dominantSentiment,
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
            email: user.email,
            id: user.id,
            img_profile: user.img_profile,
            face_photo_path: user.face_photo_path,
            provider: user.provider,
        };
    }

    // Sincroniza o histórico e espera as análises (o cálculo do humor precisa delas).
    async lastTracks(id: string): Promise<void> {
        await this.syncHistory(id);
        await this.analyzeHistory(id);
    }

    // Uma sincronização por usuário: quem chega enquanto uma roda espera a mesma, e a de menos de
    // HISTORY_SYNC_TTL_MS é reaproveitada. Antes, a lista de faixas e o auto-refresh do humor
    // buscavam o mesmo histórico em paralelo (trabalho e chamadas ao Spotify em dobro).
    private readonly historySyncs = new Map<string, { at: number; run: Promise<void> }>();
    private readonly analysisRuns = new Map<string, Promise<void>>();

    private syncHistory(id: string): Promise<void> {
        const current = this.historySyncs.get(id);
        if (current && Date.now() - current.at < HISTORY_SYNC_TTL_MS) return current.run;

        const run = (async () => {
            const user = await this.userRepository.getUserById(id);
            if (!user) throw new NotFoundException('Usuario não encontrado');
            const providerMusic = this.providerMusic.getProvider(user.provider);
            const tracks = await providerMusic.getLastRecentlyPlayed(user.refreshToken!);
            await this.saveTrackService.saveMusicsHistoryLine(tracks, user.id);
        })();
        this.historySyncs.set(id, { at: Date.now(), run });
        run.catch(() => this.historySyncs.delete(id)); // falhou: a próxima tenta de novo
        return run;
    }

    // Análise (Jev) das faixas recentes sem análise: uma por usuário por vez.
    private analyzeHistory(id: string): Promise<void> {
        const running = this.analysisRuns.get(id);
        if (running) return running;
        const run = this.saveTrackService.ensureTrackAnalysesUpToDate(id, 100)
            .catch((error) => console.error(`[TrackAnalysis] user=${id} análise falhou:`, error?.message ?? error))
            .finally(() => this.analysisRuns.delete(id));
        this.analysisRuns.set(id, run);
        return run;
    }

    // Recalcula o humor agora (cadastro). null = nenhuma música nas últimas 3h (sem sentimento definido).
    async RefreshMoodUserToday(id: string): Promise<ResponseAi | null> {
        await this.lastTracks(id);
        return this.recomputeMood(id);
    }

    // O que entrou no último cálculo de cada usuário (quantas escutas na janela + a mais nova).
    // Igual = nada mudou e não recalcula. Some no reinício: aí recalcula uma vez, sem efeito
    // visível (o mesmo humor só atualiza a linha).
    private readonly moodInputs = new Map<string, string>();

    // Chamado pelo app a cada minuto com o dashboard aberto: recalcula a cada música nova (ou quando
    // uma sai da janela de 3h). Sem nenhuma na janela, o humor fica indefinido e nada é salvo.
    async autoRefreshMood(id: string): Promise<{ updated: boolean }> {
        await this.lastTracks(id);
        const history = await this.trackRepository.getListenedLastHours(id, MOOD_WINDOW_HOURS);
        const newest = history.reduce((max, h) => Math.max(max, new Date(h.playedAt).getTime()), 0);
        const inputs = `${history.length}:${newest}`;
        if (this.moodInputs.get(id) === inputs) return { updated: false };

        const mood = await this.recomputeMood(id, history);
        // Sem análise ainda (Jev falhou): não guarda, para tentar de novo no próximo ciclo.
        if (mood || !history.length) this.moodInputs.set(id, inputs);
        return { updated: true };
    }

    // Espera o histórico já sincronizado com o provedor (lastTracks). Mesmo humor ainda em curso
    // (último dentro da janela) atualiza a linha; humor diferente ou depois de uma pausa cria outra.
    private async recomputeMood(
        id: string,
        history?: Awaited<ReturnType<TrackRepository["getListenedLastHours"]>>,
    ): Promise<ResponseAi | null> {
        const historyMusic = history ?? await this.trackRepository.getListenedLastHours(id, MOOD_WINDOW_HOURS);

        const tracks = historyMusic
            .map((entry) => entry.track)
            .filter((track): track is Track => Boolean(track?.spotifyId));
        if (!tracks.length) return null;

        const spotifyIds = tracks.map((t) => t.spotifyId).filter((sid): sid is string => Boolean(sid));

        const trackAnalyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
        const response = this.buildMoodFromStoredAnalyses(tracks, trackAnalyses);
        if (!response) return null; // músicas ainda sem análise: o próximo ciclo tenta de novo

        const moodDataStore = {
            moodScore: response.moodScore,
            emotions: response.emotionalVector,
            coreAxes: response.coreAxes,
            tracks: response.tracks,
        };

        // O humor não tem imagem (as artes são as capas das playlists).
        response.image_mood = "";
        const lastMood = await this.userRepository.getMoodUser(id);
        const ongoing = lastMood
            && lastMood.sentiment === response.dominantSentiment
            && Date.now() - new Date(lastMood.analyzedAt).getTime() < MOOD_WINDOW_MS;
        if (ongoing) await this.userRepository.updateMood(lastMood.id, moodDataStore);
        else await this.userRepository.SaveMood(id, { ...moodDataStore, sentiment: response.dominantSentiment, image_mood: null });

        return response;
    }

    // `idle`: nenhuma música nas últimas 3h. O app mostra "sem sentimento definido" no lugar do humor.
    async getMoodUserToday(id: string): Promise<any> {
        const mood = await this.userRepository.getMoodUser(id);
        if (!mood) return mood;
        const since = new Date(Date.now() - MOOD_WINDOW_MS);
        const idle = !(await this.trackRepository.hasListenedSince(id, since));
        if (mood.tracksAnalyzeds) {
            const parsedTracks = typeof mood.tracksAnalyzeds === 'string' ? JSON.parse(mood.tracksAnalyzeds as string) : mood.tracksAnalyzeds;

            const mostListened = this.computeMostListened(Array.isArray(parsedTracks) ? parsedTracks : []);
            return {
                ...mood,
                ...mostListened,
                idle,
            };
        }
        return { ...mood, idle };
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

    // Últimas faixas: sincroniza o histórico e responde logo — não espera a IA. As que ainda não
    // têm análise vão com pending: true (a tela mostra "analisando…" e busca de novo em seguida).
    async getTodayTracksAnalyzed(id: string): Promise<any[]> {
        await this.syncHistory(id);
        void this.analyzeHistory(id);

        const historyMusic = await this.trackRepository.getListenedLast24Hours(id);
        const tracks = historyMusic
            .map((entry) => entry.track)
            .filter((track): track is Track => Boolean(track?.spotifyId));

        const spotifyIds = tracks.map((t) => t.spotifyId).filter((sid): sid is string => Boolean(sid));
        const analyses = await this.trackRepository.getTrackAnalysesByMusicIds(spotifyIds);
        const bySpotifyId = new Map(analyses.map((a) => [a.spotifyid, a]));

        return tracks.map((track) => this.toAnalyzedTrack(track, bySpotifyId.get(track.spotifyId!))
            ?? { id: track.id, music: track.title, artist: track.artist, img_url: track.img_url ?? "", pending: true });
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
