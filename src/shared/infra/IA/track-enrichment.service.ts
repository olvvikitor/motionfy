import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Track } from '@prisma/client';

export type TrackEnrichment = {
    artistGenres: string[];
    bpm: number | null;
};

type EnrichableTrack = Pick<Track, 'title' | 'artist' | 'isrc'>;

const MUSICBRAINZ_URL = 'https://musicbrainz.org/ws/2';
const DEEZER_URL = 'https://api.deezer.com';
// MusicBrainz exige User-Agent identificável e no máximo 1 requisição por segundo.
const MUSICBRAINZ_USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT ?? 'Motionfy/1.0';
const MUSICBRAINZ_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_GENRES = 8;

// ---------------------------------------------------------------------------
// Enriquecimento das faixas com dados que o Spotify não entrega mais para apps
// novos: gêneros do artista (MusicBrainz) e BPM (Deezer). Tudo best-effort:
// qualquer falha vira dado vazio e a classificação segue sem ele.
// ---------------------------------------------------------------------------
@Injectable()
export class TrackEnrichmentService {
    private musicBrainzQueue: Promise<unknown> = Promise.resolve();
    private readonly artistIdByIsrc = new Map<string, Promise<string | null>>();
    private readonly artistIdByName = new Map<string, Promise<string | null>>();
    private readonly genresByArtistId = new Map<string, Promise<string[]>>();

    // skipMusicBrainz: para fluxos síncronos (ex.: playlist), onde o limite de 1 req/s do MusicBrainz pesa demais.
    async enrich(track: EnrichableTrack, options: { skipMusicBrainz?: boolean } = {}): Promise<TrackEnrichment> {
        const [artistGenres, bpm] = await Promise.all([
            options.skipMusicBrainz ? Promise.resolve([]) : this.getArtistGenres(track).catch(() => []),
            this.getBpm(track).catch(() => null),
        ]);
        return { artistGenres, bpm };
    }

    // ----------------------------- MusicBrainz ------------------------------

    private musicBrainz<T>(path: string): Promise<T> {
        const request = this.musicBrainzQueue.then(async () => {
            try {
                const { data } = await axios.get<T>(`${MUSICBRAINZ_URL}${path}`, {
                    headers: { 'User-Agent': MUSICBRAINZ_USER_AGENT, Accept: 'application/json' },
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

    // -------------------------------- Deezer --------------------------------

    private async getBpm(track: EnrichableTrack): Promise<number | null> {
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

        // O Deezer devolve 0 quando não conhece o BPM.
        return typeof data?.bpm === 'number' && data.bpm > 0 ? Math.round(data.bpm) : null;
    }
}
