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
type MusicBrainzArtist = { genres: string[]; country: string | null };

// Tags do artista no Last.fm que dizem que ele é brasileiro (quando o MusicBrainz não tem o país).
const BRAZILIAN_TAGS = new Set([
    'brazilian', 'brazil', 'brasil', 'brasileiro', 'brasileira', 'musica brasileira', 'música brasileira', 'mpb',
    'sertanejo', 'funk carioca', 'funk brasileiro', 'pagode', 'forro', 'forró', 'axe', 'axé', 'rap nacional',
    'rock nacional', 'brazilian rock', 'brazilian pop', 'brazilian hip hop', 'bossa nova', 'samba', 'piseiro', 'arrocha',
]);

const MUSICBRAINZ_URL = 'https://musicbrainz.org/ws/2';
const DEEZER_URL = 'https://api.deezer.com';
const LRCLIB_URL = 'https://lrclib.net/api';
const LASTFM_URL = 'https://ws.audioscrobbler.com/2.0/';
// MusicBrainz exige User-Agent identificável e no máximo 1 requisição por segundo.
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT ?? 'Mofy/1.0';
const MUSICBRAINZ_INTERVAL_MS = 1100;
const MUSICBRAINZ_RETRIES = 3; // depois de um 503: espera 2 s, 4 s, 8 s
const MUSICBRAINZ_BACKOFF_MS = 2000;
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

// ISRC no formato que MusicBrainz e Deezer aceitam: 12 letras/números em maiúsculas. Algumas faixas vêm do
// Spotify com hífens ou em minúsculas ("GB-SMU-40-44956", "usl4q0842696"). Inválido: null (busca pelo nome).
export function normalizeIsrc(isrc: string | null | undefined): string | null {
    const clean = (isrc ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(clean) ? clean : null;
}

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
    private readonly artistById = new Map<string, Promise<MusicBrainzArtist>>();
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

    // 503 = o MusicBrainz pedindo para ir mais devagar (limite ou servidor cheio): espera cada vez mais e tenta
    // de novo, ainda dentro da fila (as outras chamadas esperam junto).
    private musicBrainz<T>(path: string): Promise<T> {
        const request = this.musicBrainzQueue.then(async () => {
            for (let attempt = 0; ; attempt++) {
                try {
                    const { data } = await axios.get<T>(`${MUSICBRAINZ_URL}${path}`, {
                        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
                        timeout: REQUEST_TIMEOUT_MS,
                    });
                    return data;
                } catch (error: any) {
                    if (error.response?.status !== 503 || attempt >= MUSICBRAINZ_RETRIES) throw error;
                    await new Promise(resolve => setTimeout(resolve, MUSICBRAINZ_BACKOFF_MS * 2 ** attempt));
                } finally {
                    await new Promise(resolve => setTimeout(resolve, MUSICBRAINZ_INTERVAL_MS));
                }
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
        return (await this.getArtist(track))?.genres ?? [];
    }

    // País do artista principal (música nacional × internacional). MusicBrainz primeiro; sem país lá,
    // tags do artista no Last.fm (só dizem se é brasileiro). Sem resposta: country null, source "none".
    // Falha de rede sobe (quem chama tenta de novo depois, sem gravar "none").
    async getArtistCountry(track: EnrichableTrack): Promise<{ country: string | null; source: 'musicbrainz' | 'lastfm' | 'none' }> {
        const artist = await this.getArtist(track);
        if (artist?.country) return { country: artist.country, source: 'musicbrainz' };

        if (process.env.LASTFM_API_KEY) {
            const name = this.primaryArtist(track.artist);
            const tags = await this.cached(this.tagsByArtist, name.toLowerCase(),
                () => this.lastFmTags({ method: 'artist.gettoptags', artist: name }, name));
            if (tags.some(tag => BRAZILIAN_TAGS.has(tag))) return { country: 'BR', source: 'lastfm' };
        }
        return { country: null, source: 'none' };
    }

    // Artista principal no MusicBrainz: pelo ISRC da gravação ou, sem ele, pelo nome (só com nota ≥ 90).
    private async getArtist(track: EnrichableTrack): Promise<MusicBrainzArtist | null> {
        const isrc = normalizeIsrc(track.isrc);
        const artistId = isrc
            ? await this.cached(this.artistIdByIsrc, isrc, () => this.findArtistIdByIsrc(isrc))
            : null;

        const resolvedId = artistId ?? await this.cached(
            this.artistIdByName,
            this.primaryArtist(track.artist).toLowerCase(),
            () => this.findArtistIdByName(this.primaryArtist(track.artist)),
        );

        if (!resolvedId) return null;
        return this.cached(this.artistById, resolvedId, () => this.loadArtist(resolvedId));
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

    // Uma chamada traz gêneros e país do artista.
    private async loadArtist(artistId: string): Promise<MusicBrainzArtist> {
        const data = await this.musicBrainz<any>(`/artist/${artistId}?inc=genres+tags&fmt=json`);
        // "genres" é a lista curada; "tags" (livre, votada pela comunidade) só entra se não houver gêneros.
        const source: { name: string; count: number }[] = data.genres?.length ? data.genres : (data.tags ?? []);
        const genres = [...source]
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_GENRES)
            .map(g => g.name);
        // "country" é o país do artista; sem ele, o da área (cidade/estado também tem o código do país).
        const country: string | null = data.country ?? data.area?.['iso-3166-1-codes']?.[0] ?? null;
        return { genres, country: country ? country.toUpperCase() : null };
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

    // Só o BPM (preencher análises antigas sem chamar o Jev: scripts/backfill-bpm.ts).
    async getBpm(track: EnrichableTrack): Promise<number | null> {
        return (await this.getDeezerTrack(track).catch(() => null))?.bpm ?? null;
    }

    private async getDeezerTrack(track: EnrichableTrack): Promise<{ bpm: number | null; gain: number | null; duration: number | null } | null> {
        let data: any = null;
        const isrc = normalizeIsrc(track.isrc);

        if (isrc) {
            ({ data } = await axios.get(`${DEEZER_URL}/track/isrc:${isrc}`, { timeout: REQUEST_TIMEOUT_MS }));
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

    // Poucas linhas da letra, sem repetir (capa gerada): o clima de uma música só, não a letra inteira.
    async lyricLines(track: Pick<Track, 'title' | 'artist'>, count = 4): Promise<string[]> {
        const lyrics = await this.getLyrics(track).catch(() => null);
        const lines = (lyrics?.excerpt ?? '').split('\n').map(l => l.trim()).filter(Boolean);
        return [...new Set(lines)].slice(0, count);
    }

    private async getLyrics(track: Pick<Track, 'title' | 'artist'>): Promise<{ excerpt: string | null; instrumental: boolean } | null> {
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
