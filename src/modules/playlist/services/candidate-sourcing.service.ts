import { Injectable } from "@nestjs/common";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiTextService } from "src/shared/infra/IA/AiText.service";
import { EMOTION_CLUSTERS, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { LastFmProvider } from "src/shared/infra/music/lastfm/lastfm.service";
import { MusicProviderInterface } from "src/shared/infra/music/music.provider.interface";
import { SongRef } from "src/shared/infra/music/spotify/spotify-catalog.service";
import { TrackInput } from "src/shared/types/TrackInput";
import { PlaylistRepository } from "../repository/playlist.repository";
import { SENTIMENT_SEARCH_TERMS } from "../sentiment-search-terms";
import { distance, FIT_RADIUS, JourneyCandidate, shuffle, Vector } from "./journey-path";

const MAX_NEW_CANDIDATES = 30; // teto de faixas classificadas pelo Jev por playlist
const PER_QUERY = 5; // novas por busca, para espalhar o orçamento entre as paradas
const JEV_CONCURRENCY = 5;
// Populares ("Descobrir"): gêneros e artistas consultados no Last.fm, quantas de cada e o teto de buscas
// no catálogo do Spotify (as já salvas no banco não contam; o limite de chamadas é baixo e compartilhado).
const POPULAR_TAGS = 4;
const POPULAR_PER_TAG = 50;
const POPULAR_TAG_PAGES = 2; // página sorteada entre as 2 primeiras: variedade sem sair das mais tocadas
const POPULAR_ARTISTS = 5;
const POPULAR_PER_ARTIST = 10;
const MAX_CATALOG_LOOKUPS = 24;
// Classificações pelo Jev por música que falta (nem toda popular do gênero cai no humor pedido).
const CLASSIFY_PER_NEEDED = 3;
const REQUEST_PAGES = 3; // páginas de 10 por termo buscado a partir do pedido
const MAX_REQUEST_RESULTS = 60;
const RANDOM_PAGE_SPREAD = 5; // a busca começa numa página sorteada entre as 5 primeiras
export const REQUEST_MATCH_THRESHOLD = 0.5;

function randomPage(): number {
    return Math.floor(Math.random() * RANDOM_PAGE_SPREAD);
}

// Uma de cada lista por vez (todo gênero/artista contribui), sem repetir a mesma música.
function interleave(lists: SongRef[][]): SongRef[] {
    const seen = new Set<string>();
    const out: SongRef[] = [];
    for (let i = 0; i < Math.max(0, ...lists.map(l => l.length)); i++) {
        for (const list of lists) {
            const ref = list[i];
            const key = ref && `${ref.artist}|${ref.title}`.toLowerCase();
            if (ref && !seen.has(key)) { seen.add(key); out.push(ref); }
        }
    }
    return out;
}

type SearchContext = { provider: MusicProviderInterface; accessToken: string };

export type PopularContext = {
    // Gêneros/subgêneros (nomes do Jev) de onde vêm as populares: os escolhidos nos filtros ou, sem
    // filtro, os principais do usuário.
    genres: string[];
    // Artistas do usuário, os que combinam com o humor pedido primeiro: entram os sucessos deles.
    artists: string[];
    // Acervo já carregado (não busca de novo) e músicas do usuário.
    analyzed: Map<string, JourneyCandidate>;
    tasteIds: Set<string>;
    // A música serve para a playlist (humor da parada ou do quadrante) e está no gênero.
    fits: (candidate: JourneyCandidate) => boolean;
    inScope: (candidate: JourneyCandidate) => boolean;
    // Completa dados que o `inScope` usa (país do artista, no filtro de música nacional), antes do teste.
    annotate?: (candidates: JourneyCandidate[]) => Promise<void>;
    // Músicas novas que valem a análise do Jev (as outras sairiam no `inScope` de qualquer jeito).
    eligible?: (tracks: TrackInput[]) => Promise<TrackInput[]>;
    // Quantas músicas novas que sirvam ainda faltam. 0 = só as populares já analisadas (sem Spotify nem Jev).
    needed: number;
};

// Gêneros do Jev com tag diferente no Last.fm (o resto vai em minúsculas).
const LASTFM_TAGS: Record<string, string> = {
    'Rock Alternativo': 'alternative rock',
    'Rock Nacional': 'rock nacional',
    'Rap Nacional': 'rap nacional',
    'Trap BR': 'trap brasileiro',
    'Hip Hop': 'hip-hop',
    'Synth-pop': 'synthpop',
    'R&B/Soul': 'soul',
    'Eletrônica': 'electronic',
    'Funk': 'funk carioca',
    'Samba/Pagode': 'pagode',
    'Sertanejo Universitário': 'sertanejo universitario',
    'Sertanejo Raiz': 'sertanejo raiz',
    'Forró': 'forro',
    'Axé': 'axe',
    'Latina': 'latin',
    'Clássica': 'classical',
};

// ---------------------------------------------------------------------------
// Músicas de fora do acervo: populares do gênero (Descobrir) ou buscadas pelo pedido.
// As novas são classificadas pelo Jev e salvas no acervo (ficam para as próximas playlists).
// ---------------------------------------------------------------------------
@Injectable()
export class CandidateSourcingService {
    constructor(
        private readonly aiText: AiTextService,
        private readonly trackRepository: TrackRepository,
        private readonly playlistRepository: PlaylistRepository,
        private readonly lastfm: LastFmProvider,
    ) { }

    // "Descobrir": as mais tocadas dos gêneros (paradas do Last.fm por gênero) e os sucessos dos artistas do
    // usuário. As já analisadas entram de graça; as outras só quando falta música (`needed`), com teto de
    // buscas no Spotify e de classificações no Jev. Só volta o que está no gênero (`inScope`).
    async popular(ctx: PopularContext): Promise<{ candidates: JourneyCandidate[]; classified: number }> {
        const lists = await Promise.all([
            ...shuffle(this.tagsFor(ctx.genres)).slice(0, POPULAR_TAGS).map(tag =>
                this.lastfm.popularByTag(tag, POPULAR_PER_TAG, 1 + Math.floor(Math.random() * POPULAR_TAG_PAGES)).catch((): SongRef[] => [])),
            ...ctx.artists.slice(0, POPULAR_ARTISTS).map(artist =>
                this.lastfm.popularByArtist(artist, POPULAR_PER_ARTIST).catch((): SongRef[] => [])),
        ]);
        const refs = interleave(lists.map(shuffle));
        if (!refs.length) return { candidates: [], classified: 0 };

        const tracks = await this.lastfm.resolvePopular(refs, ctx.needed > 0 ? MAX_CATALOG_LOOKUPS : 0);
        const unique = [...new Map(tracks.map(t => [t.spotifyId, t])).values()];

        const inPool = unique.flatMap(t => ctx.analyzed.get(t.spotifyId) ?? []);
        const outside = unique.filter(t => !ctx.analyzed.has(t.spotifyId));
        const fromDb = await this.playlistRepository.getAnalyzedCandidates(outside.map(t => t.spotifyId), ctx.tasteIds);
        const known = [...inPool, ...fromDb];
        await ctx.annotate?.(known);
        const knownIds = new Set(known.map(c => c.spotifyId));

        // Novas: em lotes, até as populares que servem cobrirem o que falta ou acabar o orçamento do Jev.
        // O que já dá para descartar sem o Jev (artista sem país, com o filtro de música nacional) sai antes.
        const budget = Math.min(MAX_NEW_CANDIDATES, ctx.needed * CLASSIFY_PER_NEEDED);
        const unknown = outside.filter(t => !knownIds.has(t.spotifyId));
        const toClassify = (ctx.eligible ? await ctx.eligible(unknown) : unknown).slice(0, budget);
        const classified: JourneyCandidate[] = [];
        const fitting = () => [...known, ...classified].filter(c => ctx.inScope(c) && ctx.fits(c)).length;
        for (let i = 0; i < toClassify.length && fitting() < ctx.needed; i += JEV_CONCURRENCY) {
            const batch = await this.classifyAndSave(toClassify.slice(i, i + JEV_CONCURRENCY));
            await ctx.annotate?.(batch);
            classified.push(...batch);
        }

        return { candidates: [...known, ...classified].filter(ctx.inScope), classified: classified.length };
    }

    private tagsFor(genres: string[]): string[] {
        return [...new Set(genres.map(g => LASTFM_TAGS[g] ?? g.toLowerCase()))];
    }

    // Modo "Eu escolho" com estilo: só busca no Spotify (o acervo do usuário não é
    // consultado), o Jev confere quais músicas são do estilo pedido e uma amostra
    // aleatória delas vira candidata. Músicas já analisadas reaproveitam a análise.
    async fromRequest(
        request: string,
        ctx: SearchContext,
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
        ctx: SearchContext,
        analyzed: JourneyCandidate[],
    ): Promise<JourneyCandidate[]> {
        const analyzedById = new Map(analyzed.map(c => [c.spotifyId, c]));
        const found = new Map<string, JourneyCandidate>();
        let classifiedCount = 0;

        for (const stop of stops) {
            if ([...found.values()].some(c => distance(stop, c.vector) <= FIT_RADIUS)) continue;

            for (const query of shuffle(SENTIMENT_SEARCH_TERMS[this.nearestSentiment(stop)] ?? [])) {
                const results = shuffle(await this.searchPages(query, ctx, 1)).filter(t => !found.has(t.spotifyId));

                results.filter(t => analyzedById.has(t.spotifyId)).forEach(t => found.set(t.spotifyId, analyzedById.get(t.spotifyId)!));

                const budget = Math.min(PER_QUERY, MAX_NEW_CANDIDATES - classifiedCount);
                const toClassify = results.filter(t => !analyzedById.has(t.spotifyId)).slice(0, Math.max(0, budget));
                const classified = await this.classifyAndSave(toClassify);
                classifiedCount += toClassify.length;
                classified.forEach(c => found.set(c.spotifyId, c));

                if ([...found.values()].some(c => distance(stop, c.vector) <= FIT_RADIUS)) break;
                if (classifiedCount >= MAX_NEW_CANDIDATES) break;
            }
        }

        return [...found.values()];
    }

    // Busca `pages` páginas a partir de uma página sorteada; se ela vier vazia
    // (poucos resultados para o termo), recomeça da primeira.
    private async searchPages(
        query: string,
        ctx: SearchContext,
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
                    bpm: analysis.bpm,
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
                    genre: analysis.genre,
                    subgenre: analysis.subgenre,
                    bpm: analysis.bpm,
                    isrc: track.isrc ?? null,
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
