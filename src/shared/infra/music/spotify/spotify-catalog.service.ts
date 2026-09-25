import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";
import { TrackInput } from "src/shared/types/TrackInput";

const RESOLVE_CONCURRENCY = 5;
const CACHE_MAX = 10_000;
const MAX_RETRY_WAIT_MS = 5_000;

export type SongRef = { title: string; artist: string };

// ---------------------------------------------------------------------------
// Catálogo do Spotify com token do app (client credentials): busca músicas sem
// login de usuário, então não conta no limite de usuários do Development Mode.
// Usado por quem entra pelo Last.fm, que só dá artista e título da música.
// ---------------------------------------------------------------------------
@Injectable()
export class SpotifyCatalogService {
    private token: { value: string; expiresAt: number } | null = null;
    // artista|título → faixa do Spotify (null = não achou; evita buscar de novo).
    private readonly resolved = new Map<string, TrackInput | null>();

    async searchTracks(query: string, offset = 0, limit = 10): Promise<TrackInput[]> {
        const response = await this.get('https://api.spotify.com/v1/search', { q: query, type: 'track', limit, offset });
        return (response.data.tracks?.items ?? [])
            .filter((track: any) => track?.id)
            .map((track: any) => toTrackInput(track));
    }

    // Acha a faixa do Spotify de cada música (mesma ordem; null quando não encontra).
    async resolveSongs(songs: SongRef[]): Promise<(TrackInput | null)[]> {
        const results: (TrackInput | null)[] = new Array(songs.length).fill(null);
        for (let i = 0; i < songs.length; i += RESOLVE_CONCURRENCY) {
            await Promise.all(songs.slice(i, i + RESOLVE_CONCURRENCY).map(async (song, j) => {
                results[i + j] = await this.resolveSong(song).catch((err) => {
                    console.error(`[SpotifyCatalog] falha ao buscar "${song.title}" de ${song.artist}:`, err?.message ?? err);
                    return null;
                });
            }));
        }
        return results;
    }

    private async resolveSong(song: SongRef): Promise<TrackInput | null> {
        const key = `${normalize(song.artist)}|${normalize(song.title)}`;
        if (this.resolved.has(key)) return this.resolved.get(key)!;

        const title = song.title.replace(/"/g, '');
        const artist = song.artist.replace(/"/g, '');
        let match: TrackInput | null = null;
        for (const query of [`track:${title} artist:${artist}`, `${title} ${artist}`]) {
            const found = await this.searchTracks(query, 0, 5);
            match = found.find(track => sameSong(song, track)) ?? null;
            if (match) break;
        }

        if (this.resolved.size >= CACHE_MAX) this.resolved.delete(this.resolved.keys().next().value!);
        this.resolved.set(key, match);
        return match;
    }

    private async get(url: string, params: Record<string, unknown>, retried = false): Promise<any> {
        try {
            return await axios.get(url, { headers: { Authorization: `Bearer ${await this.appToken()}` }, params });
        } catch (err) {
            if (err instanceof AxiosError && !retried) {
                const status = err.response?.status;
                if (status === 401) { this.token = null; return this.get(url, params, true); }
                if (status === 429) {
                    const waitMs = Math.min(Number(err.response?.headers['retry-after'] ?? 1) * 1000, MAX_RETRY_WAIT_MS);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    return this.get(url, params, true);
                }
            }
            const detail = err instanceof AxiosError ? err.response?.data?.error?.message ?? err.message : String(err);
            throw new HttpException(`Erro ao buscar no catálogo do Spotify: ${detail}`, HttpStatus.BAD_GATEWAY);
        }
    }

    private async appToken(): Promise<string> {
        if (this.token && Date.now() < this.token.expiresAt) return this.token.value;

        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
                },
            },
        );
        // Renova 1 min antes de expirar.
        this.token = { value: response.data.access_token, expiresAt: Date.now() + (response.data.expires_in - 60) * 1000 };
        return this.token.value;
    }
}

function toTrackInput(track: any): TrackInput {
    return {
        spotifyId: track.id,
        title: track.name,
        artist: track.artists?.map((artist: { name: string }) => artist.name).join(', ') ?? 'Unknown',
        album: track.album?.name ?? '',
        img_url: track.album?.images?.[0]?.url ?? '',
        isrc: track.external_ids?.isrc ?? null,
        explicit: track.explicit ?? null,
        releaseDate: track.album?.release_date ?? null,
        durationMs: track.duration_ms ?? null,
        createdAt: new Date(),
    };
}

// Minúsculas, sem acento e só letras/números.
export function normalize(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

// Título sem "(Remastered 2011)", "[Live]", "- Radio Edit"...
function baseTitle(title: string): string {
    return normalize(title.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, ''));
}

// Só aceita quando artista e título batem: trocar por outra música do mesmo artista
// daria um humor errado.
export function sameSong(song: SongRef, track: Pick<TrackInput, 'title' | 'artist'>): boolean {
    const wantedArtist = normalize(song.artist);
    // "contém" cobre "Anitta" x "Anitta & Pedro Sampaio"; nomes curtos precisam bater exato.
    const artistMatches = track.artist.split(', ').map(normalize).some(name =>
        name === wantedArtist || (name.length >= 3 && wantedArtist.length >= 3 && (wantedArtist.includes(name) || name.includes(wantedArtist))),
    ) && Boolean(wantedArtist);
    if (!artistMatches) return false;

    const a = baseTitle(song.title);
    const b = baseTitle(track.title);
    if (!a || !b) return false;
    return a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
}
