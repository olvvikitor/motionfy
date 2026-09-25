import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";
import { PrismaService } from "src/config/prisma.service";
import { TrackInput } from "src/shared/types/TrackInput";

// O limite de chamadas do Development Mode é baixo e compartilhado por toda a conta de
// desenvolvedor: poucas buscas ao mesmo tempo e nunca insistir depois de um 429.
const RESOLVE_CONCURRENCY = 2;
const CACHE_MAX = 10_000;
const DEFAULT_BLOCK_S = 60; // 429 sem Retry-After

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
    // Disjuntor: depois de um 429, nenhuma chamada até o horário que o Spotify mandou esperar.
    // Insistir durante o bloqueio só o estende.
    private blockedUntil = 0;

    constructor(private readonly prisma: PrismaService) { }

    isBlocked(): boolean {
        return Date.now() < this.blockedUntil;
    }

    async searchTracks(query: string, offset = 0, limit = 10): Promise<TrackInput[]> {
        const response = await this.get('https://api.spotify.com/v1/search', { q: query, type: 'track', limit, offset });
        return (response.data.tracks?.items ?? [])
            .filter((track: any) => track?.id)
            .map((track: any) => toTrackInput(track));
    }

    // Acha a faixa do Spotify de cada música (mesma ordem; null quando não encontra).
    // Com o Spotify bloqueado, só resolve pelo banco (as já conhecidas) e deixa o resto de fora.
    async resolveSongs(songs: SongRef[]): Promise<(TrackInput | null)[]> {
        const results: (TrackInput | null)[] = new Array(songs.length).fill(null);
        // Uma consulta ao banco para o lote todo (o banco fica longe: ~230 ms por consulta).
        const known = await this.findKnownMany(songs.filter((song) => !this.resolved.has(songKey(song))));
        let blockedSkips = 0;
        for (let i = 0; i < songs.length; i += RESOLVE_CONCURRENCY) {
            await Promise.all(songs.slice(i, i + RESOLVE_CONCURRENCY).map(async (song, j) => {
                results[i + j] = await this.resolveSong(song, known).catch((err) => {
                    if (err instanceof CatalogBlockedError) { blockedSkips++; return null; }
                    console.error(`[SpotifyCatalog] falha ao buscar "${song.title}" de ${song.artist}:`, err?.message ?? err);
                    return null;
                });
            }));
        }
        if (blockedSkips) {
            console.warn(`[SpotifyCatalog] Spotify em espera (limite de chamadas) até ${new Date(this.blockedUntil).toLocaleTimeString('pt-BR')}: ${blockedSkips} música(s) ficaram para depois.`);
        }
        return results;
    }

    private async resolveSong(song: SongRef, known: Map<string, TrackInput>): Promise<TrackInput | null> {
        const key = songKey(song);
        if (this.resolved.has(key)) return this.resolved.get(key)!;

        // 1) Banco: faixas já resolvidas antes (sobrevive a reinício da API, sem chamar o Spotify).
        const fromDb = known.get(key);
        if (fromDb) { this.remember(key, fromDb); return fromDb; }

        // 2) Spotify: busca exata; a solta só se a exata não trouxer nada.
        const title = song.title.replace(/"/g, '');
        const artist = song.artist.replace(/"/g, '');
        const strict = await this.searchTracks(`track:${title} artist:${artist}`, 0, 5);
        let match = strict.find(track => sameSong(song, track)) ?? null;
        if (!match && strict.length === 0) {
            const loose = await this.searchTracks(`${title} ${artist}`, 0, 5);
            match = loose.find(track => sameSong(song, track)) ?? null;
        }

        this.remember(key, match);
        return match;
    }

    private remember(key: string, value: TrackInput | null) {
        if (this.resolved.size >= CACHE_MAX) this.resolved.delete(this.resolved.keys().next().value!);
        this.resolved.set(key, value);
    }

    // Músicas já salvas, do lote todo numa consulta: título igual (sem diferenciar maiúsculas),
    // artista conferido por sameSong. Chave = songKey da música pedida.
    private async findKnownMany(songs: SongRef[]): Promise<Map<string, TrackInput>> {
        const found = new Map<string, TrackInput>();
        const titles = [...new Set(songs.map((song) => song.title.trim()).filter(Boolean))];
        if (!titles.length) return found;

        const rows = await this.prisma.track.findMany({
            where: { spotifyId: { not: null }, OR: titles.map((title) => ({ title: { equals: title, mode: 'insensitive' as const } })) },
            select: { spotifyId: true, title: true, artist: true, album: true, img_url: true, isrc: true, explicit: true, releaseDate: true, durationMs: true },
        });

        for (const song of songs) {
            const row = rows.find((r) => r.title.trim().toLowerCase() === song.title.trim().toLowerCase() && sameSong(song, r));
            if (!row?.spotifyId) continue;
            found.set(songKey(song), {
                spotifyId: row.spotifyId,
                title: row.title,
                artist: row.artist,
                album: row.album ?? '',
                img_url: row.img_url ?? '',
                isrc: row.isrc,
                explicit: row.explicit,
                releaseDate: row.releaseDate,
                durationMs: row.durationMs,
                createdAt: new Date(),
            });
        }
        return found;
    }

    private async get(url: string, params: Record<string, unknown>, retried = false): Promise<any> {
        if (this.isBlocked()) throw new CatalogBlockedError(this.blockedUntil);
        try {
            return await axios.get(url, { headers: { Authorization: `Bearer ${await this.appToken()}` }, params });
        } catch (err) {
            if (err instanceof AxiosError) {
                const status = err.response?.status;
                if (status === 401 && !retried) { this.token = null; return this.get(url, params, true); }
                if (status === 429) {
                    // Respeita o Retry-After inteiro (pode ser horas) e não tenta de novo.
                    const seconds = Number(err.response?.headers['retry-after']) || DEFAULT_BLOCK_S;
                    this.blockedUntil = Date.now() + seconds * 1000;
                    console.warn(`[SpotifyCatalog] 429: Spotify pediu para esperar ${Math.round(seconds / 60)} min. Buscas pausadas até ${new Date(this.blockedUntil).toLocaleTimeString('pt-BR')}.`);
                    throw new CatalogBlockedError(this.blockedUntil);
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

// Spotify pediu para esperar (429): nenhuma chamada foi feita.
export class CatalogBlockedError extends HttpException {
    constructor(readonly until: number) {
        super('O Spotify pediu uma pausa nas buscas. Tente de novo mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
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

const songKey = (song: SongRef) => `${normalize(song.artist)}|${normalize(song.title)}`;

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
