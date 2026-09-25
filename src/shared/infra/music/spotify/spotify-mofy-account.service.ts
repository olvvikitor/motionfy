import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";

const API = 'https://api.spotify.com/v1';
const ITEMS_PER_REQUEST = 100; // máximo do endpoint de adicionar itens
const PLAYLIST_SCOPES = ['playlist-modify-public', 'playlist-modify-private'];
const COVER_SCOPES = ['ugc-image-upload'];
// Tudo o que a conta do Mofy precisa (pedido de uma vez em GET auth/spotify/mofy-account).
export const MOFY_ACCOUNT_SCOPES = [...PLAYLIST_SCOPES, ...COVER_SCOPES];

export type CreatedPlaylist = { id: string; url: string };

// ---------------------------------------------------------------------------
// Conta do próprio Mofy no Spotify (a do dono do app, que está na allowlist do
// Development Mode). As playlists são criadas nela e o usuário recebe o link:
// ninguém precisa entrar com o Spotify, então não conta no limite de 5 usuários.
//
// Credencial: SPOTIFY_MOFY_REFRESH_TOKEN, obtido uma vez em GET auth/spotify/mofy-account.
// Cada operação confere só as permissões dela: um token antigo sem a de capa ainda cria playlists.
// ---------------------------------------------------------------------------
@Injectable()
export class SpotifyMofyAccountService {
    private token: { value: string; expiresAt: number; scopes: string[] } | null = null;
    // O Spotify pode devolver um refresh token novo ao renovar: guarda o mais recente.
    private refreshToken = process.env.SPOTIFY_MOFY_REFRESH_TOKEN ?? '';

    isConfigured(): boolean {
        return Boolean(this.refreshToken);
    }

    async createPlaylist(name: string, description: string, trackIds: string[]): Promise<CreatedPlaylist> {
        const playlist = await this.request('post', '/me/playlists', PLAYLIST_SCOPES, { name, description, public: true });
        const uris = trackIds.map(id => `spotify:track:${id}`);
        for (let i = 0; i < uris.length; i += ITEMS_PER_REQUEST) {
            await this.request('post', `/playlists/${playlist.id}/items`, PLAYLIST_SCOPES, { uris: uris.slice(i, i + ITEMS_PER_REQUEST) });
        }
        return { id: playlist.id, url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}` };
    }

    // Capa: JPEG em base64 (sem o prefixo data:), no máximo 256 KB. O Spotify processa em segundo plano.
    async setCover(playlistId: string, jpegBase64: string): Promise<void> {
        await this.request('put', `/playlists/${playlistId}/images`, [...PLAYLIST_SCOPES, ...COVER_SCOPES], jpegBase64, 'image/jpeg');
    }

    // "Apagar" playlist no Spotify = deixar de seguir. Quem salvou continua com ela.
    async removePlaylist(playlistId: string): Promise<void> {
        await this.request('delete', `/playlists/${playlistId}/followers`, PLAYLIST_SCOPES);
    }

    authorizeUrl(state: string, redirectUri: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID ?? '',
            scope: MOFY_ACCOUNT_SCOPES.join(' '),
            redirect_uri: redirectUri,
            state,
            // Sempre mostra a tela de permissão, para conferir que "criar playlists" e "capa" estão na lista.
            show_dialog: 'true',
        });
        return `https://accounts.spotify.com/authorize?${params}`;
    }

    // Troca o code da volta do login pelo refresh token (mostrado uma vez para ir ao .env).
    async exchangeCode(code: string, redirectUri: string): Promise<string> {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
            { headers: this.basicAuthHeaders() },
        );
        return response.data.refresh_token;
    }

    private async request(method: 'post' | 'put' | 'delete', path: string, scopes: string[], body?: unknown, contentType = 'application/json'): Promise<any> {
        // Fora do try: erro do token/permissão já vem com a mensagem certa.
        const token = await this.accessToken(scopes);
        try {
            const response = await axios.request({
                method,
                url: `${API}${path}`,
                data: body,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
            });
            return response.data;
        } catch (err) {
            const detail = err instanceof AxiosError ? err.response?.data?.error?.message ?? err.message : String(err);
            const status = err instanceof AxiosError && err.response?.status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY;
            throw new HttpException(`Erro ao montar a playlist no Spotify: ${detail}`, status);
        }
    }

    private async accessToken(required: string[]): Promise<string> {
        if (!this.token || Date.now() >= this.token.expiresAt) await this.renew();
        const token = this.token!;

        // Token do login normal do app não serve: ele não tem permissão de criar playlist nem de mudar capa.
        const missing = required.filter(scope => !token.scopes.includes(scope));
        if (missing.length) {
            const what = missing.some(s => COVER_SCOPES.includes(s)) && missing.every(s => COVER_SCOPES.includes(s))
                ? 'mudar a capa das playlists'
                : 'criar playlists';
            throw new HttpException(
                `O token da conta do Mofy não tem permissão para ${what} (${missing.join(', ')}). Gere outro em /auth/spotify/mofy-account.`,
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
        return token.value;
    }

    private async renew(): Promise<void> {
        if (!this.refreshToken) {
            throw new HttpException('Conta do Mofy no Spotify não configurada (SPOTIFY_MOFY_REFRESH_TOKEN).', HttpStatus.SERVICE_UNAVAILABLE);
        }
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.refreshToken }),
            { headers: this.basicAuthHeaders() },
        );
        if (response.data.refresh_token) this.refreshToken = response.data.refresh_token;
        this.token = {
            value: response.data.access_token,
            expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
            scopes: String(response.data.scope ?? '').split(' '),
        };
    }

    private basicAuthHeaders() {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        };
    }
}
