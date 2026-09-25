import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";
import { createHash } from "crypto";
import { TrackInput } from "src/shared/types/TrackInput";
import { LibrarySources, MusicProviderInterface, ProviderUserProfile } from "../music.provider.interface";
import { SongRef, SpotifyCatalogService } from "../spotify/spotify-catalog.service";

const API_URL = 'https://ws.audioscrobbler.com/2.0/';
const RECENT_LIMIT = 50;
const PAGE_SIZE = 50;
// Cada música vira uma busca no catálogo do Spotify: limite menor que o do Spotify (500).
const SOURCE_MAX = 200;

// Origens da biblioteca com as mais ouvidas (os ids passam pelo SOURCE_PATTERN do library.dto).
export const TOP_PERIODS = [
    { id: 'top-7day', period: '7day', name: 'Mais ouvidas · 7 dias' },
    { id: 'top-1month', period: '1month', name: 'Mais ouvidas · 1 mês' },
    { id: 'top-12month', period: '12month', name: 'Mais ouvidas · 1 ano' },
    { id: 'top-overall', period: 'overall', name: 'Mais ouvidas · sempre' },
] as const;
const PRIVATE_HISTORY_ERROR = 17; // "Login: User required to be logged in" (histórico oculto)

type LastFmScrobble = {
    name: string;
    artist: { '#text'?: string; name?: string };
    date?: { uts: string };
    '@attr'?: { nowplaying?: string };
};

// ---------------------------------------------------------------------------
// Last.fm: histórico do que a pessoa ouve em qualquer app (Spotify incluso),
// sem o limite de usuários do Spotify. Ele só dá artista e título; a faixa
// (id, capa, duração) vem do catálogo do Spotify com o token do app.
//
// Credencial: a session key do Last.fm não expira. Fica em accessToken e
// refreshToken do usuário; refreshToken() a troca pelo nome de usuário, que é
// o que as leituras usam.
// ---------------------------------------------------------------------------
@Injectable()
export class LastFmProvider implements MusicProviderInterface {
    private readonly usernames = new Map<string, string>();

    constructor(private readonly catalog: SpotifyCatalogService) { }

    authUrl(): string {
        const callback = process.env.LASTFM_CALLBACK_URL ?? 'http://127.0.0.1:3000/auth/lastfm/callback';
        return `https://www.last.fm/api/auth/?api_key=${this.apiKey()}&cb=${encodeURIComponent(callback)}`;
    }

    // Token de uso único da volta do login → session key permanente.
    async getSessionKey(token: string): Promise<string> {
        const data = await this.call('auth.getSession', { token }, true);
        return data.session.key;
    }

    async getProfile(sessionKey: string): Promise<ProviderUserProfile> {
        const { user } = await this.call('user.getInfo', { sk: sessionKey }, true);
        this.usernames.set(sessionKey, user.name);
        const images: { '#text': string }[] = user.image ?? [];
        return {
            // Prefixo evita colidir com ids do Spotify.
            id: lastFmUserId(user.name),
            email: null,
            displayName: user.realname || user.name,
            country: user.country && user.country !== 'None' ? user.country : '',
            imageUrl: images[images.length - 1]?.['#text'] || undefined,
        };
    }

    async refreshToken(sessionKey: string): Promise<string> {
        const cached = this.usernames.get(sessionKey);
        if (cached) return cached;
        const { user } = await this.call('user.getInfo', { sk: sessionKey }, true);
        this.usernames.set(sessionKey, user.name);
        return user.name;
    }

    async getTopTracks(): Promise<TrackInput[]> {
        throw new HttpException('getTopTracks não é suportado pelo Last.fm neste momento', HttpStatus.NOT_IMPLEMENTED);
    }

    async getLastRecentlyPlayed(sessionKey: string): Promise<TrackInput[]> {
        const scrobbles = (await this.recentScrobbles(sessionKey, RECENT_LIMIT)).filter(s => !s['@attr']?.nowplaying && s.date);
        return this.toTracks(scrobbles, s => new Date(Number(s.date!.uts) * 1000));
    }

    async getListeningNow(sessionKey: string): Promise<TrackInput | null> {
        const [latest] = await this.recentScrobbles(sessionKey, 1);
        if (!latest?.['@attr']?.nowplaying) return null;
        const [track] = await this.toTracks([latest], () => new Date());
        return track ?? null;
    }

    // Último scrobble (tocando agora conta como agora). Não busca no Spotify: só a data importa.
    async getLastActivity(sessionKey: string): Promise<Date | null> {
        const [latest] = await this.recentScrobbles(sessionKey, 1);
        if (!latest) return null;
        if (latest['@attr']?.nowplaying) return new Date();
        return latest.date ? new Date(Number(latest.date.uts) * 1000) : null;
    }

    // Busca no catálogo do Spotify (o access token do usuário não é usado).
    async searchTracks(_accessToken: string, query: string, offset = 0): Promise<TrackInput[]> {
        return this.catalog.searchTracks(query, offset);
    }

    // Recebem o nome de usuário (saída de refreshToken).
    // O Last.fm não tem playlists: no lugar delas entram as mais ouvidas de cada período.
    async getLibrarySources(username: string): Promise<LibrarySources> {
        const [loved, ...tops] = await Promise.all([
            this.call('user.getLovedTracks', { user: username, limit: 1 }),
            ...TOP_PERIODS.map(p => this.call('user.getTopTracks', { user: username, period: p.period, limit: 1 })),
        ]);

        const playlists = TOP_PERIODS.map((p, i) => ({
            id: p.id,
            name: p.name,
            imageUrl: '',
            // A lista para em SOURCE_MAX; mostra o que dá para abrir.
            total: Math.min(Number(tops[i].toptracks?.['@attr']?.total ?? 0), SOURCE_MAX),
        })).filter(p => p.total > 0);

        return { likedTotal: Number(loved.lovedtracks?.['@attr']?.total ?? 0), playlists, hiddenPlaylists: 0 };
    }

    // "Músicas amadas" do Last.fm, da mais recente para a mais antiga.
    async getSavedTracks(username: string, max: number): Promise<TrackInput[]> {
        const loved = await this.listPaged('user.getLovedTracks', 'lovedtracks', { user: username }, Math.min(max, SOURCE_MAX));
        return this.toTracks(loved, s => (s.date ? new Date(Number(s.date.uts) * 1000) : new Date()));
    }

    // Mais ouvidas de um período (id "top-1month" etc.), da mais tocada para a menos.
    async getPlaylistTracks(username: string, sourceId: string, max: number): Promise<TrackInput[]> {
        const period = TOP_PERIODS.find(p => p.id === sourceId);
        if (!period) throw new BadRequestException('O Last.fm não tem playlists. Use as mais ouvidas ou as músicas amadas.');

        const top = await this.listPaged('user.getTopTracks', 'toptracks', { user: username, period: period.period }, Math.min(max, SOURCE_MAX));
        return this.toTracks(top, () => new Date());
    }

    private async listPaged(method: string, root: string, params: Record<string, string>, limit: number): Promise<LastFmScrobble[]> {
        const items: LastFmScrobble[] = [];
        for (let page = 1; items.length < limit; page++) {
            const data = await this.call(method, { ...params, limit: PAGE_SIZE, page });
            const pageItems = asArray<LastFmScrobble>(data[root]?.track);
            items.push(...pageItems);
            if (pageItems.length < PAGE_SIZE || page >= Number(data[root]?.['@attr']?.totalPages ?? 1)) break;
        }
        return items.slice(0, limit);
    }

    private async recentScrobbles(sessionKey: string, limit: number): Promise<LastFmScrobble[]> {
        const username = await this.refreshToken(sessionKey);
        try {
            const data = await this.call('user.getRecentTracks', { user: username, limit });
            return asArray<LastFmScrobble>(data.recenttracks?.track);
        } catch (err) {
            if (err instanceof HttpException && (err.getResponse() as any)?.lastfmError === PRIVATE_HISTORY_ERROR) {
                throw new BadRequestException('Seu histórico está oculto no Last.fm. Desative "Ocultar scrobbles recentes" nas configurações de privacidade.');
            }
            throw err;
        }
    }

    // Cada scrobble vira a faixa do Spotify correspondente; o que não for achado fica de fora.
    private async toTracks(scrobbles: LastFmScrobble[], dateOf: (s: LastFmScrobble) => Date): Promise<TrackInput[]> {
        const refs: SongRef[] = scrobbles.map(s => ({ title: s.name, artist: s.artist['#text'] ?? s.artist.name ?? '' }));
        const unique = [...new Map(refs.map(r => [`${r.artist}|${r.title}`.toLowerCase(), r])).values()];
        const found = await this.catalog.resolveSongs(unique);
        const byKey = new Map(unique.map((r, i) => [`${r.artist}|${r.title}`.toLowerCase(), found[i]]));

        return scrobbles.flatMap((s, i) => {
            const track = byKey.get(`${refs[i].artist}|${refs[i].title}`.toLowerCase());
            return track ? [{ ...track, createdAt: dateOf(s) }] : [];
        });
    }

    private async call(method: string, params: Record<string, string | number>, signed = false): Promise<any> {
        const query: Record<string, string> = { method, api_key: this.apiKey() };
        for (const [key, value] of Object.entries(params)) query[key] = String(value);
        if (signed) query.api_sig = this.sign(query);

        try {
            const response = await axios.get(API_URL, { params: { ...query, format: 'json' } });
            if (response.data?.error) throw this.lastFmError(response.data.error, response.data.message, HttpStatus.BAD_REQUEST);
            return response.data;
        } catch (err) {
            if (err instanceof AxiosError) {
                const data = err.response?.data;
                throw this.lastFmError(data?.error, data?.message ?? err.message, err.response?.status ?? HttpStatus.BAD_GATEWAY);
            }
            throw err;
        }
    }

    private lastFmError(code: number | undefined, message: string, status: number): HttpException {
        return new HttpException({ message: `Erro no Last.fm: ${message}`, lastfmError: code }, status);
    }

    // md5 dos parâmetros em ordem alfabética (nome+valor, sem format/callback) + segredo.
    private sign(params: Record<string, string>): string {
        const base = Object.keys(params).sort().map(key => key + params[key]).join('');
        return createHash('md5').update(base + this.secret(), 'utf8').digest('hex');
    }

    private apiKey(): string {
        const key = process.env.LASTFM_API_KEY;
        if (!key) throw new HttpException('LASTFM_API_KEY não configurada', HttpStatus.INTERNAL_SERVER_ERROR);
        return key;
    }

    private secret(): string {
        const secret = process.env.LASTFM_SHARED_SECRET;
        if (!secret) throw new HttpException('LASTFM_SHARED_SECRET não configurada', HttpStatus.INTERNAL_SERVER_ERROR);
        return secret;
    }
}

// Id do usuário no Mofy a partir do nome no Last.fm (que não diferencia maiúsculas).
// O login por senha usa o mesmo cálculo: o usuário digita o nome do Last.fm.
export function lastFmUserId(username: string): string {
    return `lastfm-${String(username).trim().toLowerCase()}`;
}

// O Last.fm devolve objeto (não lista) quando há um item só.
function asArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}
