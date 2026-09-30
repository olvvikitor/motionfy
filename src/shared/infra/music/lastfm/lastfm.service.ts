import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";
import { createHash } from "crypto";
import { TrackInput } from "src/shared/types/TrackInput";
import { MusicProviderInterface, ProviderUserProfile } from "../music.provider.interface";
import { SongRef, SpotifyCatalogService } from "../spotify/spotify-catalog.service";

const API_URL = 'https://ws.audioscrobbler.com/2.0/';
const RECENT_LIMIT = 50;
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

    // Mais tocadas de um gênero (tag do Last.fm), das mais populares; `page` de `limit` itens.
    // Só a chave do app: vale para qualquer usuário (Spotify ou Last.fm).
    async popularByTag(tag: string, limit = 50, page = 1): Promise<SongRef[]> {
        const data = await this.call('tag.getTopTracks', { tag, limit, page });
        return asArray<LastFmScrobble>(data.tracks?.track).map(toSongRef);
    }

    // Mais tocadas de um artista (os sucessos dele).
    async popularByArtist(artist: string, limit = 10): Promise<SongRef[]> {
        const data = await this.call('artist.getTopTracks', { artist, limit, autocorrect: 1 });
        return asArray<LastFmScrobble>(data.toptracks?.track).map(toSongRef);
    }

    // Artistas parecidos com um artista (do mais parecido ao menos), pelo que os ouvintes do Last.fm escutam juntos.
    async similarArtists(artist: string, limit = 10): Promise<string[]> {
        const data = await this.call('artist.getSimilar', { artist, limit, autocorrect: 1 });
        return asArray<{ name: string }>(data.similarartists?.artist).map(a => a.name).filter(Boolean);
    }

    // Faixa do Spotify de cada música (as que não achar ficam de fora). `maxLookups` limita as buscas no
    // Spotify; as já salvas no banco não contam.
    async resolvePopular(songs: SongRef[], maxLookups: number): Promise<TrackInput[]> {
        return (await this.catalog.resolveSongs(songs, maxLookups)).filter((t): t is TrackInput => Boolean(t));
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
        const refs: SongRef[] = scrobbles.map(toSongRef);
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

function toSongRef(s: LastFmScrobble): SongRef {
    return { title: s.name, artist: s.artist['#text'] ?? s.artist.name ?? '' };
}

// O Last.fm devolve objeto (não lista) quando há um item só.
function asArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}
