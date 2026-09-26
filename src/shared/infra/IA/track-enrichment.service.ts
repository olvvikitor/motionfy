import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Track } from '@prisma/client';

export type TrackEnrichment = {
    artistGenres: string[];
    bpm: number | null;
    // Volume médio da faixa em dB (ReplayGain do Deezer): mais perto de 0 = mais alta/comprimida.
    loudnessDb: number | null;
    durationSec: number | null;
    // Trecho da letra (LRCLIB). Não é guardado em lugar nenhum: só vai para o Jev.
    lyricsExcerpt: string | null;
    instrumental: boolean | null;
    // Tags dos ouvintes no Last.fm (da música; sem elas, do artista): gênero e humor ("sad", "chill"…).
    listenerTags: string[];
    // "ao vivo", "acústico", "remix"… lido do título.
    version: string | null;
};

type EnrichableTrack = Pick<Track, 'title' | 'artist' | 'isrc'>;

const MUSICBRAINZ_URL = 'https://musicbrainz.org/ws/2';
const DEEZER_URL = 'https://api.deezer.com';
const LRCLIB_URL = 'https://lrclib.net/api';
const LASTFM_URL = 'https://ws.audioscrobbler.com/2.0/';
// MusicBrainz exige User-Agent identificável e no máximo 1 requisição por segundo.
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT ?? 'Mofy/1.0';
const MUSICBRAINZ_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_GENRES = 8;
const LYRICS_MAX_CHARS = 1000; // o começo basta para o tom; letra inteira pesa no prompt
const MAX_TAGS = 8;
const MIN_TAG_COUNT = 10; // o Last.fm dá peso 0–100 relativo à tag mais usada
const MIN_TRACK_TAGS = 3; // com menos que isso, completa com as tags do artista
// Tags que não dizem nada sobre a música.
const JUNK_TAGS = new Set([
    'seen live', 'favorites', 'favourite', 'favorite', 'favourites', 'favorite songs', 'my favorite', 'love',
    'awesome', 'beautiful', 'amazing', 'best', 'cool', 'good', 'great', 'spotify', 'albums i own', 'under 2000 listeners',
]);

const VERSION_MARKERS: [RegExp, string][] = [
    [/\bao vivo\b|\blive\b/i, 'ao vivo'],
    [/\bac[uú]stic[oa]\b|\bacoustic\b|\bunplugged\b/i, 'acústico'],
    [/\bsped up\b/i, 'acelerada (sped up)'],
    [/\bslowed\b/i, 'desacelerada (slowed)'],
    [/\bremix\b/i, 'remix'],
    [/\binstrumental\b/i, 'instrumental'],
];

// ---------------------------------------------------------------------------
// Enriquecimento das faixas com dados que o Spotify não entrega mais para apps
// novos: gêneros do artista (MusicBrainz), BPM/volume/duração (Deezer), letra
// (LRCLIB) e tags dos ouvintes (Last.fm). Tudo best-effort: qualquer falha vira
// dado vazio e a classificação segue sem ele.
// ---------------------------------------------------------------------------
@Injectable()
export class TrackEnrichmentService {
    private musicBrainzQueue: Promise<unknown> = Promise.resolve();
    private readonly artistIdByIsrc = new Map<string, Promise<string | null>>();
    private readonly artistIdByName = new Map<string, Promise<string | null>>();
    private readonly genresByArtistId = new Map<string, Promise<string[]>>();
    private readonly tagsByArtist = new Map<string, Promise<string[]>>();

    // skipMusicBrainz: para fluxos síncronos (ex.: playlist), onde o limite de 1 req/s do MusicBrainz pesa demais.
    async enrich(track: EnrichableTrack, options: { skipMusicBrainz?: boolean } = {}): Promise<TrackEnrichment> {
        const [artistGenres, deezer, lyrics, listenerTags] = await Promise.all([
            options.skipMusicBrainz ? Promise.resolve([]) : this.getArtistGenres(track).catch(() => []),
            this.getDeezerTrack(track).catch(() => null),
            this.getLyrics(track).catch(() => null),
            this.getListenerTags(track).catch(() => []),
        ]);
        return {
            artistGenres,
            bpm: deezer?.bpm ?? null,
            loudnessDb: deezer?.gain ?? null,
            durationSec: deezer?.duration ?? null,
            lyricsExcerpt: lyrics?.excerpt ?? null,
            instrumental: lyrics?.instrumental ?? null,
            listenerTags,
            version: VERSION_MARKERS.find(([pattern]) => pattern.test(track.title))?.[1] ?? null,
        };
    }

    // ----------------------------- MusicBrainz ------------------------------

    private musicBrainz<T>(path: string): Promise<T> {
        const request = this.musicBrainzQueue.then(async () => {
            try {
                const { data } = await axios.get<T>(`${MUSICBRAINZ_URL}${path}`, {
                    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
                    timeout: REQUEST_TIMEOUT_MS,
                });
                return data;
            } finally {
                await new Promise(resolve => setTimeout(resolve, MUSICBRAINZ_INTERVAL_MS));
            }
        });
        this.musicBrainzQueue = request.catch(() => undefined);
        return request;
    }

    private cached<K, V>(cache: Map<K, Promise<V>>, key: K, load: () => Promise<V>): Promise<V> {
        let value = cache.get(key);
        if (!value) {
            value = load();
            cache.set(key, value);
            // Não guarda falhas de rede no cache, para tentar de novo depois.
            value.catch(() => cache.delete(key));
        }
        return value;
    }

    private async getArtistGenres(track: EnrichableTrack): Promise<string[]> {
        const artistId = track.isrc
            ? await this.cached(this.artistIdByIsrc, track.isrc, () => this.findArtistIdByIsrc(track.isrc!))
            : null;

        const resolvedId = artistId ?? await this.cached(
            this.artistIdByName,
            this.primaryArtist(track.artist).toLowerCase(),
            () => this.findArtistIdByName(this.primaryArtist(track.artist)),
        );

        if (!resolvedId) return [];
        return this.cached(this.genresByArtistId, resolvedId, () => this.loadArtistGenres(resolvedId));
    }

    private async findArtistIdByIsrc(isrc: string): Promise<string | null> {
        try {
            const data = await this.musicBrainz<any>(`/isrc/${encodeURIComponent(isrc)}?inc=artist-credits&fmt=json`);
            return data.recordings?.[0]?.['artist-credit']?.[0]?.artist?.id ?? null;
        } catch (error: any) {
            if (error.response?.status === 404) return null; // ISRC desconhecido no MusicBrainz
            throw error;
        }
    }

    private async findArtistIdByName(name: string): Promise<string | null> {
        if (!name) return null;
        const query = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
        const data = await this.musicBrainz<any>(`/artist?query=${query}&limit=1&fmt=json`);
        const artist = data.artists?.[0];
        return artist && artist.score >= 90 ? artist.id : null;
    }

    private async loadArtistGenres(artistId: string): Promise<string[]> {
        const data = await this.musicBrainz<any>(`/artist/${artistId}?inc=genres+tags&fmt=json`);
        // "genres" é a lista curada; "tags" (livre, votada pela comunidade) só entra se não houver gêneros.
        const source: { name: string; count: number }[] = data.genres?.length ? data.genres : (data.tags ?? []);
        return [...source]
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_GENRES)
            .map(g => g.name);
    }

    // Artistas vêm unidos por ", " no Track; o primeiro é o principal.
    private primaryArtist(artist: string): string {
        return artist.split(', ')[0]?.trim() ?? '';
    }

    // Título sem o que atrapalha a busca por nome: "(Remastered 2011)", "- Ao Vivo", "(feat. X)".
    private baseTitle(title: string): string {
        return title.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').trim() || title;
    }

    // -------------------------------- Deezer --------------------------------

    private async getDeezerTrack(track: EnrichableTrack): Promise<{ bpm: number | null; gain: number | null; duration: number | null } | null> {
        let data: any = null;

        if (track.isrc) {
            ({ data } = await axios.get(`${DEEZER_URL}/track/isrc:${encodeURIComponent(track.isrc)}`, { timeout: REQUEST_TIMEOUT_MS }));
        }

        if (!data?.id) {
            const artist = this.primaryArtist(track.artist);
            const q = encodeURIComponent(`${track.title} ${artist}`);
            const search = await axios.get(`${DEEZER_URL}/search?q=${q}&limit=5`, { timeout: REQUEST_TIMEOUT_MS });
            // Confere o artista para não pegar cover/remix de outro canal.
            const id = search.data?.data?.find((item: any) => item.artist?.name?.toLowerCase() === artist.toLowerCase())?.id;
            if (!id) return null;
            ({ data } = await axios.get(`${DEEZER_URL}/track/${id}`, { timeout: REQUEST_TIMEOUT_MS }));
        }

        const positive = (value: unknown) => (typeof value === 'number' && value > 0 ? value : null);
        return {
            bpm: positive(data?.bpm) ? Math.round(data.bpm) : null, // o Deezer devolve 0 quando não conhece
            gain: typeof data?.gain === 'number' && data.gain !== 0 ? data.gain : null,
            duration: positive(data?.duration),
        };
    }

    // -------------------------------- LRCLIB --------------------------------

    private async getLyrics(track: EnrichableTrack): Promise<{ excerpt: string | null; instrumental: boolean } | null> {
        try {
            const { data } = await axios.get(`${LRCLIB_URL}/get`, {
                params: { artist_name: this.primaryArtist(track.artist), track_name: this.baseTitle(track.title) },
                headers: { 'User-Agent': USER_AGENT },
                timeout: REQUEST_TIMEOUT_MS,
            });
            if (data?.instrumental) return { excerpt: null, instrumental: true };
            const lyrics = typeof data?.plainLyrics === 'string' ? data.plainLyrics.replace(/\n{2,}/g, '\n').trim() : '';
            return lyrics ? { excerpt: lyrics.slice(0, LYRICS_MAX_CHARS), instrumental: false } : null;
        } catch (error: any) {
            if (error.response?.status === 404) return null; // letra desconhecida
            throw error;
        }
    }

    // -------------------------------- Last.fm -------------------------------

    private async getListenerTags(track: EnrichableTrack): Promise<string[]> {
        if (!process.env.LASTFM_API_KEY) return [];
        const artist = this.primaryArtist(track.artist);
        const trackTags = await this.lastFmTags({ method: 'track.gettoptags', artist, track: this.baseTitle(track.title) }, artist);
        if (trackTags.length >= MIN_TRACK_TAGS) return trackTags;

        const artistTags = await this.cached(this.tagsByArtist, artist.toLowerCase(),
            () => this.lastFmTags({ method: 'artist.gettoptags', artist }, artist));
        return [...new Set([...trackTags, ...artistTags])].slice(0, MAX_TAGS);
    }

    private async lastFmTags(params: Record<string, string>, artist: string): Promise<string[]> {
        const { data } = await axios.get(LASTFM_URL, {
            params: { ...params, autocorrect: 1, api_key: process.env.LASTFM_API_KEY, format: 'json' },
            timeout: REQUEST_TIMEOUT_MS,
        });
        const tags: { name: string; count: number }[] = data?.toptags?.tag ?? [];
        const artistName = artist.toLowerCase();
        return tags
            .filter(t => t.count >= MIN_TAG_COUNT)
            .map(t => t.name.toLowerCase().trim())
            .filter(name => name && name !== artistName && !JUNK_TAGS.has(name))
            .slice(0, MAX_TAGS);
    }
}
