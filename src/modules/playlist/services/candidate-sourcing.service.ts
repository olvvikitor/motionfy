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
const REQUEST_PAGES = 3; // páginas de 10 por termo buscado a partir do pedido
const MAX_REQUEST_RESULTS = 60;
const RANDOM_PAGE_SPREAD = 3; // a busca começa numa página sorteada entre as 3 primeiras
export const REQUEST_MATCH_THRESHOLD = 0.5;

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function randomPage(): number {
    return Math.floor(Math.random() * RANDOM_PAGE_SPREAD);
}

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

    // Modo "Eu escolho" com estilo: só busca no Spotify (o acervo do usuário não é
    // consultado), o Jev confere quais músicas são do estilo pedido e uma amostra
    // aleatória delas vira candidata. Músicas já analisadas reaproveitam a análise.
    async fromRequest(
        request: string,
        ctx: Pick<SourcingContext, 'provider' | 'accessToken'>,
        analyzed: JourneyCandidate[],
        genre: string | null = null,
    ): Promise<{ candidates: JourneyCandidate[]; checked: number }> {
        const analyzedById = new Map(analyzed.map(c => [c.spotifyId, c]));
        const found = new Map<string, TrackInput>();

        for (const query of shuffle(this.requestQueries(request, genre))) {
            if (found.size >= MAX_REQUEST_RESULTS) break;
            for (const track of await this.searchPages(query, ctx)) found.set(track.spotifyId, track);
        }

        const toCheck = [...found.values()].map(t => ({ id: t.spotifyId, title: t.title, artist: t.artist }));
        if (!toCheck.length) return { candidates: [], checked: 0 };

        const scores = await this.aiText.matchSongsToRequest(request, toCheck);
        const matching = shuffle([...found.values()].filter(t => (scores.get(t.spotifyId) ?? 0) >= REQUEST_MATCH_THRESHOLD));

        const reused = matching.filter(t => analyzedById.has(t.spotifyId)).map(t => analyzedById.get(t.spotifyId)!);
        const toClassify = matching.filter(t => !analyzedById.has(t.spotifyId)).slice(0, MAX_NEW_CANDIDATES);

        const classified = await this.classifyAndSave(toClassify);
        return { candidates: [...reused, ...classified], checked: toCheck.length };
    }

    // Modo "Eu escolho" sem estilo ("to com raiva e quero me acalmar"): busca no
    // Spotify por gêneros ligados ao sentimento de CADA parada, em ordem e página
    // aleatórias. Não usa artistas nem gêneros do usuário.
    async searchForJourney(
        stops: Vector[],
        ctx: Pick<SourcingContext, 'provider' | 'accessToken'>,
        analyzed: JourneyCandidate[],
    ): Promise<JourneyCandidate[]> {
        const analyzedById = new Map(analyzed.map(c => [c.spotifyId, c]));
        const found = new Map<string, JourneyCandidate>();
        let classifiedCount = 0;

        for (const stop of stops) {
            if ([...found.values()].some(c => distance(stop, c.vector) <= NEAR_RADIUS)) continue;

            for (const query of shuffle(SENTIMENT_SEARCH_TERMS[this.nearestSentiment(stop)] ?? [])) {
                const results = shuffle(await this.searchPages(query, ctx, 1)).filter(t => !found.has(t.spotifyId));

                results.filter(t => analyzedById.has(t.spotifyId)).forEach(t => found.set(t.spotifyId, analyzedById.get(t.spotifyId)!));

                const budget = Math.min(PER_QUERY, MAX_NEW_CANDIDATES - classifiedCount);
                const toClassify = results.filter(t => !analyzedById.has(t.spotifyId)).slice(0, Math.max(0, budget));
                const classified = await this.classifyAndSave(toClassify);
                classifiedCount += toClassify.length;
                classified.forEach(c => found.set(c.spotifyId, c));

                if ([...found.values()].some(c => distance(stop, c.vector) <= NEAR_RADIUS)) break;
                if (classifiedCount >= MAX_NEW_CANDIDATES) break;
            }
        }

        return [...found.values()];
    }

    // Busca `pages` páginas a partir de uma página sorteada; se ela vier vazia
    // (poucos resultados para o termo), recomeça da primeira.
    private async searchPages(
        query: string,
        ctx: Pick<SourcingContext, 'provider' | 'accessToken'>,
        pages = REQUEST_PAGES,
        start = randomPage(),
    ): Promise<TrackInput[]> {
        const tracks: TrackInput[] = [];

        for (let page = start; page < start + pages; page++) {
            const results = await ctx.provider.searchTracks!(ctx.accessToken, query, page * 10).catch((): TrackInput[] => []);
            if (!results.length && page === start && start > 0) return this.searchPages(query, ctx, pages, 0);
            tracks.push(...results);
            if (results.length < 10) break;
        }
        return tracks;
    }

    // O gênero reconhecido pelo Jev (se houver), o pedido inteiro e, se tiver
    // várias partes ("bossa nova e mpb", "rock, blues"), cada parte.
    private requestQueries(request: string, genre: string | null): string[] {
        const parts = request
            .split(/,|;|\+|\s+e\s+|\s+and\s+/i)
            .map(p => p.trim())
            .filter(p => p.length > 1);
        const genreQueries = genre ? [`genre:"${this.plain(genre)}"`, this.plain(genre)] : [];
        return [...new Set([...genreQueries, request.trim(), ...(parts.length > 1 ? parts : [])])];
    }

    private plain(text: string): string {
        return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
