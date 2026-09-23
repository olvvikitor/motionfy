import { Injectable } from "@nestjs/common";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiTextService } from "src/shared/infra/IA/AiText.service";
import { EMOTION_CLUSTERS, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { MusicProviderInterface } from "src/shared/infra/music/music.provider.interface";
import { TrackInput } from "src/shared/types/TrackInput";
import { SENTIMENT_SEARCH_TERMS } from "../sentiment-search-terms";
import { distance, JourneyCandidate, NEAR_RADIUS, Vector } from "./journey-path";

const MAX_NEW_CANDIDATES = 30; // teto de faixas classificadas pelo Jev por playlist
const PER_QUERY = 5; // novas por busca, para espalhar o orçamento entre as paradas
const JEV_CONCURRENCY = 5;
const ARTIST_QUERIES = 3;

export type SourcingContext = {
    provider: MusicProviderInterface;
    accessToken: string;
    knownIds: Set<string>;
    topArtists: string[];
    topSubgenres: string[];
};

// ---------------------------------------------------------------------------
// Preenche lacunas do caminho buscando faixas novas no Spotify, classificando
// com o Jev e salvando no acervo (ficam disponíveis para as próximas playlists).
// ---------------------------------------------------------------------------
@Injectable()
export class CandidateSourcingService {
    constructor(
        private readonly aiText: AiTextService,
        private readonly trackRepository: TrackRepository,
    ) { }

    async fillGaps(gapStops: Vector[], ctx: SourcingContext): Promise<JourneyCandidate[]> {
        const found: JourneyCandidate[] = [];
        const seen = new Set(ctx.knownIds);

        for (const stop of gapStops) {
            if (found.length >= MAX_NEW_CANDIDATES) break;
            if (found.some(c => distance(stop, c.vector) <= NEAR_RADIUS)) continue; // já coberta por outra busca

            for (const query of this.queriesFor(stop, ctx)) {
                const budget = Math.min(PER_QUERY, MAX_NEW_CANDIDATES - found.length);
                if (budget <= 0) break;

                const results = await ctx.provider.searchTracks!(ctx.accessToken, query).catch((): TrackInput[] => []);
                const fresh = results.filter(t => !seen.has(t.spotifyId)).slice(0, budget);
                fresh.forEach(t => seen.add(t.spotifyId));

                const classified = await this.classifyAndSave(fresh);
                found.push(...classified);

                if (classified.some(c => distance(stop, c.vector) <= NEAR_RADIUS)) break;
            }
        }

        return found;
    }

    // Primeiro artistas que o usuário ouve; depois gêneros ligados ao sentimento
    // da parada, com os subgêneros que ele mais ouve na frente.
    private queriesFor(stop: Vector, ctx: SourcingContext): string[] {
        const sentiment = this.nearestSentiment(stop);
        const userGenres = ctx.topSubgenres.map(sg => sg.toLowerCase());
        const terms = [...(SENTIMENT_SEARCH_TERMS[sentiment] ?? [])].sort((a, b) =>
            Number(userGenres.some(g => b.toLowerCase().includes(g))) - Number(userGenres.some(g => a.toLowerCase().includes(g))),
        );

        return [
            ...ctx.topArtists.slice(0, ARTIST_QUERIES).map(artist => `artist:"${artist.replace(/"/g, '')}"`),
            ...terms,
        ];
    }

    private nearestSentiment(point: Vector): string {
        return EMOTION_CLUSTERS
            .map(label => ({ label, d: distance(point, getClusterVector(label)!) }))
            .sort((a, b) => a.d - b.d)[0].label;
    }

    private async classifyAndSave(tracks: TrackInput[]): Promise<JourneyCandidate[]> {
        const results: JourneyCandidate[] = [];

        for (let i = 0; i < tracks.length; i += JEV_CONCURRENCY) {
            const chunk = tracks.slice(i, i + JEV_CONCURRENCY);
            const settled = await Promise.allSettled(chunk.map(async track => {
                const analysis = await this.aiText.analyzeTrack(
                    {
                        id: track.spotifyId,
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        img_url: track.img_url,
                        isrc: track.isrc ?? null,
                        explicit: track.explicit ?? null,
                        releaseDate: track.releaseDate ?? null,
                    },
                    { skipMusicBrainz: true },
                );

                await this.trackRepository.createNewTrack(track);
                await this.trackRepository.saveTrackAnalysesBulk([{
                    spotifyid: track.spotifyId,
                    moodScore: analysis.moodScore,
                    dominantSentiment: analysis.dominantSentiment,
                    coreAxes: analysis.coreAxes,
                    emotionalVector: analysis.emotionalVector,
                    reasoning: analysis.reasoning,
                    genre: analysis.genre,
                    subgenre: analysis.subgenre,
                }]);

                return {
                    spotifyId: track.spotifyId,
                    title: track.title,
                    artist: track.artist,
                    imgUrl: track.img_url,
                    durationMs: track.durationMs ?? null,
                    vector: analysis.emotionalVector,
                    dominantSentiment: analysis.dominantSentiment,
                    fromUserHistory: false,
                } satisfies JourneyCandidate;
            }));

            settled.forEach((result, idx) => {
                if (result.status === 'fulfilled') results.push(result.value);
                else console.error(`[Journey] falha ao classificar ${chunk[idx].title}:`, result.reason?.message ?? result.reason);
            });
        }

        return results;
    }
}
