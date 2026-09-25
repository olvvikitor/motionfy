import { Injectable } from "@nestjs/common";
import { Track } from "@prisma/client";
import { TrackAnalysisWriteInput, TrackRepository } from "../repository/TrackRepository";
import { TrackInput } from "src/shared/types/TrackInput";
import { AiTextService } from "src/shared/infra/IA/AiText.service";

@Injectable()
export default class SaveTracks {
    constructor(
        private trackRepository: TrackRepository,
        private readonly aiTextService: AiTextService,
    ) { }

    private chunkArray<T>(items: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
        }
        return chunks;
    }

    private async syncTrackAnalysesFromMoodAnalyses(userId: string): Promise<void> {
        const moods = await this.trackRepository.getMoodAnalysisTracksByUser(userId);
        if (!moods.length) return;

        const snapshotRows: Array<{ analyzedAt: Date; snapshot: Record<string, unknown> }> = [];
        const referenceIds = new Set<string>();

        for (const mood of moods) {
            if (!Array.isArray(mood.tracksAnalyzeds)) continue;

            for (const rawTrack of mood.tracksAnalyzeds) {
                if (!rawTrack || typeof rawTrack !== "object" || Array.isArray(rawTrack)) continue;

                const snapshot = rawTrack as Record<string, unknown>;
                snapshotRows.push({ analyzedAt: mood.analyzedAt, snapshot });

                const possibleRefs = [
                    snapshot.id,
                    snapshot.spotifyId,
                    snapshot.spotifyid,
                ];

                for (const ref of possibleRefs) {
                    if (typeof ref === "string" && ref.trim()) {
                        referenceIds.add(ref.trim());
                    }
                }
            }
        }

        if (!snapshotRows.length) return;

        const references = await this.trackRepository.findTrackReferences(Array.from(referenceIds));
        const spotifyByReference = new Map<string, string>();

        for (const ref of references) {
            if (!ref.spotifyId) continue;
            spotifyByReference.set(ref.id, ref.spotifyId);
            spotifyByReference.set(ref.spotifyId, ref.spotifyId);
        }

        const analysesMap = new Map<string, TrackAnalysisWriteInput>();

        for (const row of snapshotRows) {
            const trackId = row.snapshot.id;
            const spotifyIdCandidate = row.snapshot.spotifyId ?? row.snapshot.spotifyid;

            const spotifyId =
                (typeof trackId === "string" && spotifyByReference.get(trackId)) ||
                (typeof spotifyIdCandidate === "string" && spotifyByReference.get(spotifyIdCandidate)) ||
                (typeof spotifyIdCandidate === "string" ? spotifyIdCandidate : undefined);

            if (!spotifyId) continue;

            const moodScore = row.snapshot.moodScore;
            const dominantSentiment = row.snapshot.dominantSentiment;
            const emotionalVector = row.snapshot.emotionalVector;
            const coreAxes = row.snapshot.coreAxes;
            const reasoning = row.snapshot.reasoning;
            const genre = row.snapshot.genre;
            const subgenre = row.snapshot.subgenre;

            if (typeof moodScore !== "number" || !Number.isFinite(moodScore)) continue;
            if (typeof dominantSentiment !== "string" || !dominantSentiment.trim()) continue;
            if (!emotionalVector || typeof emotionalVector !== "object" || Array.isArray(emotionalVector)) continue;
            if (!coreAxes || typeof coreAxes !== "object" || Array.isArray(coreAxes)) continue;

            analysesMap.set(spotifyId, {
                spotifyid: spotifyId,
                moodScore,
                dominantSentiment,
                emotionalVector,
                coreAxes,
                reasoning: typeof reasoning === "string" ? reasoning : "",
                genre: typeof genre === "string" ? genre : "Unknown",
                subgenre: typeof subgenre === "string" ? subgenre : "Unknown",
                analyzedAt: row.analyzedAt,
            });
        }

        if (!analysesMap.size) return;
        await this.trackRepository.saveTrackAnalysesBulk(Array.from(analysesMap.values()));
    }

    // Salva na biblioteca do usuário as músicas que ele escolheu (curtidas ou playlists).
    // Devolve as faixas salvas; a análise fica com analyzeLibraryTracks.
    async addLibraryTracks(idUser: string, tracks: TrackInput[]): Promise<Track[]> {
        const saved: Track[] = [];

        for (const chunk of this.chunkArray(tracks, 10)) {
            const results = await Promise.allSettled(chunk.map((trackData) => this.trackRepository.createNewTrack(trackData)));
            results.forEach((result, i) => {
                if (result.status === "fulfilled") saved.push(result.value);
                else console.error(`Erro ao salvar a faixa curtida ${chunk[i].title}:`, result.reason?.message);
            });
        }

        const addedAtById = new Map(tracks.map((t) => [t.spotifyId, t.createdAt]));
        await this.trackRepository.saveSavedTracks(
            idUser,
            saved.map((track) => ({ trackId: track.spotifyId!, addedAt: addedAtById.get(track.spotifyId!) ?? new Date() })),
        );

        return saved;
    }

    // Analisa com o Jev as faixas da biblioteca que ainda não têm análise.
    async analyzeLibraryTracks(idUser: string, tracks: Track[]): Promise<void> {
        await this.analyzeMissingTracks(idUser, tracks, "library");
    }

    // Só salva faixas e histórico. A análise roda à parte (UserService.analyzeHistory).
    async saveMusicsHistoryLine(tracks: TrackInput[], idUser: string): Promise<void> {

        await this.trackRepository.saveTracksAndHistory(idUser, tracks);
    }

    async ensureTrackAnalysesUpToDate(idUser: string, limit = 100): Promise<void> {
        // [REMOVIDO] Backfill pesado syncTrackAnalysesFromMoodAnalyses() comentado para prevenir lock/timeout da rota


        const recentHistory = await this.trackRepository.getLastListened(idUser, limit);

        // Dedup por spotifyId mantendo a ordem das músicas mais recentes.
        const uniqueBySpotifyId = new Map<string, Track>();
        for (const item of recentHistory) {
            const spotifyId = item.track?.spotifyId;
            if (!spotifyId || uniqueBySpotifyId.has(spotifyId)) continue;
            uniqueBySpotifyId.set(spotifyId, item.track);
        }

        await this.analyzeMissingTracks(idUser, Array.from(uniqueBySpotifyId.values()), "recent");
    }

    // Manda ao Jev, em lotes de 10, as faixas que ainda não têm análise salva.
    private async analyzeMissingTracks(idUser: string, uniqueTracks: Track[], source: string): Promise<void> {
        if (!uniqueTracks.length) return;

        const spotifyIds = uniqueTracks
            .map((track) => track.spotifyId)
            .filter((id): id is string => Boolean(id));

        const alreadyAnalyzed = await this.trackRepository.findAnalyzedByMusicId(spotifyIds);
        const analyzedSet = new Set(alreadyAnalyzed.map((track) => track.spotifyid));
        const missingTracks = uniqueTracks.filter((track) => {
            if (!track.spotifyId) return false;
            return !analyzedSet.has(track.spotifyId);
        });

        console.log(
            `[TrackAnalysis] user=${idUser} ${source}=${uniqueTracks.length} analyzed=${analyzedSet.size} missing=${missingTracks.length}`,
        );

        if (!missingTracks.length) return;

        const batches = this.chunkArray(missingTracks, 10);
        console.log(`[TrackAnalysis] user=${idUser} sending ${missingTracks.length} missing tracks in ${batches.length} batch(es)`);

        for (const [index, batch] of batches.entries()) {
            try {
                console.log(`[TrackAnalysis] user=${idUser} batch=${index + 1}/${batches.length} size=${batch.length}`);
                const analyzed = await this.aiTextService.analyzeMusicMoodByHistoryToday(batch);

                const dbIdToSpotifyId = new Map(
                    batch
                        .filter((track) => track.spotifyId)
                        .map((track) => [track.id, track.spotifyId as string]),
                );

                const analysesToSave: TrackAnalysisWriteInput[] = [];
                for (const resultTrack of analyzed.tracks) {
                    const spotifyId = dbIdToSpotifyId.get(resultTrack.id);
                    if (!spotifyId) continue;

                    analysesToSave.push({
                        spotifyid: spotifyId,
                        moodScore: resultTrack.moodScore,
                        dominantSentiment: resultTrack.dominantSentiment,
                        coreAxes: resultTrack.coreAxes,
                        emotionalVector: resultTrack.emotionalVector,
                        reasoning: resultTrack.reasoning ?? "",
                        genre: resultTrack.genre ?? "Unknown",
                        subgenre: resultTrack.subgenre ?? "Unknown",
                        analyzedAt: new Date(),
                    });
                }

                await this.trackRepository.saveTrackAnalysesBulk(analysesToSave);
            } catch (error) {
                console.error("Erro ao analisar lote de faixas não analisadas:", error.message);
                continue;
            }
        }
    }

}