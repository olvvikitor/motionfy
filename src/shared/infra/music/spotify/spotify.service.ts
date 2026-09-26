import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { LibraryPlaylist, LibrarySources, MusicProviderInterface, ProviderUserProfile, QueueResult } from "../music.provider.interface";
import axios, { AxiosError } from "axios";
import { mapSpotifyHistoryToPrisma } from "src/modules/tracks/mappers/spotifyToPrisma";
import { TrackInput } from "src/shared/types/TrackInput";

@Injectable()
export class SpotifyProvider implements MusicProviderInterface {
    constructor() { }

    async getListeningNow(accessToken: string): Promise<TrackInput | null> {
        try {
            const token = await this.refreshToken(accessToken);

            const response = await axios.get(
                'https://api.spotify.com/v1/me/player/currently-playing',
                {
                    headers: { Authorization: `Bearer ${token}` },
                    // 204 = nada tocando — axios não lança erro, mas validateStatus
                    // garante que só 2xx passa sem exceção
                    validateStatus: (status) => status < 500,
                },
            );

            // 400 / 401 / 403 → problema de autenticação ou requisição inválida
            if (response.status >= 400) {
                throw new HttpException('Failed to fetch currently playing track', response.status);
            }

            // 204 No Content (ou anúncio/podcast sem item) → nada tocando; não é erro.
            if (response.status === 204 || !response.data || !response.data.item) {
                return null;
            }

            const track = response.data.item;

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
        } catch (err) {
            // Qualquer erro inesperado → trata como "nada tocando" para não derrubar o request
            if (err instanceof AxiosError) {
                const status = err.response?.status;
                // Erros de rede ou servidor → propaga
                if (!status || status >= 500) {
                    this.handleAxiosError(err, 'Erro ao buscar música atual do Spotify');
                }
                // 400/401/403/404 → silencia, nada tocando
                throw new HttpException('Failed to fetch currently playing track', HttpStatus.BAD_REQUEST);
            }
            throw err;
        }
    }

    async getProfile(accessToken: string): Promise<ProviderUserProfile> {
        try {
            const response = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            return {
                id: response.data.id,
                email: response.data.email,
                displayName: response.data.display_name,
                country: response.data.country,
                imageUrl: response.data.images?.[0]?.url,
            };
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar perfil do Spotify');
        }
    }

    async getTopTracks(): Promise<TrackInput[]> {
        throw new HttpException(
            'getTopTracks não é suportado pelo Spotify neste momento',
            HttpStatus.NOT_IMPLEMENTED,
        );
    }

    async getLastRecentlyPlayed(accessToken: string): Promise<TrackInput[]> {
        try {
            const token = await this.refreshToken(accessToken);

            const response = await axios.get(
                'https://api.spotify.com/v1/me/player/recently-played?limit=50',
                { headers: { Authorization: `Bearer ${token}` } },
            );

            return mapSpotifyHistoryToPrisma(response.data.items);
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar histórico do Spotify');
        }
    }

    async refreshToken(refreshToken: string): Promise<string> {
        try {
            const response = await axios.post(
                'https://accounts.spotify.com/api/token',
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization:
                            'Basic ' +
                            Buffer.from(
                                process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET,
                            ).toString('base64'),
                    },
                },
            );

            return response.data.access_token;
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao renovar token do Spotify');
        }
    }

    private handleAxiosError(err: unknown, message: string): never {
        if (err instanceof AxiosError) {
            const status = err.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const detail = err.response?.data?.error?.message ?? err.message;
            throw new HttpException(`${message}: ${detail}`, status);
        }
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    async searchTracks(accessToken: string, query: string, offset = 0): Promise<TrackInput[]> {
        try {
            // Limite máximo aceito hoje pela busca é 10; market=from_token garante faixas tocáveis para o usuário.
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { q: query, type: 'track', limit: 10, offset, market: 'from_token' },
            });

            return (response.data.tracks?.items ?? [])
                .filter((track: any) => track?.id)
                .map((track: any) => this.toTrackInput(track, new Date()));
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar músicas no Spotify');
        }
    }

    // "Músicas Curtidas", da mais recente para a mais antiga. createdAt = data em que foi curtida.
    async getSavedTracks(accessToken: string, max: number): Promise<TrackInput[]> {
        const PAGE_SIZE = 50; // máximo por página no endpoint
        try {
            const tracks: TrackInput[] = [];

            for (let offset = 0; offset < max; offset += PAGE_SIZE) {
                const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: { limit: Math.min(PAGE_SIZE, max - offset), offset },
                });

                const items: any[] = response.data.items ?? [];
                for (const item of items) {
                    if (item.track?.id && !item.track.is_local) tracks.push(this.toTrackInput(item.track, new Date(item.added_at)));
                }
                if (!response.data.next) break;
            }

            return tracks;
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar músicas curtidas do Spotify');
        }
    }

    // Total de curtidas + playlists do usuário. Desde fev/2026 o Spotify só entrega as músicas
    // de playlists que o usuário criou ou colabora; as seguidas entram só na contagem.
    async getLibrarySources(accessToken: string): Promise<LibrarySources> {
        const PAGE_SIZE = 50;
        const MAX_PLAYLISTS = 200;
        const headers = { Authorization: `Bearer ${accessToken}` };
        try {
            const [me, liked] = await Promise.all([
                axios.get('https://api.spotify.com/v1/me', { headers }),
                axios.get('https://api.spotify.com/v1/me/tracks', { headers, params: { limit: 1 } }),
            ]);

            const playlists: LibraryPlaylist[] = [];
            let hiddenPlaylists = 0;
            for (let offset = 0; offset < MAX_PLAYLISTS; offset += PAGE_SIZE) {
                const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
                    headers,
                    params: { limit: PAGE_SIZE, offset },
                });

                for (const playlist of response.data.items ?? []) {
                    if (!playlist?.id) continue;
                    const readable = playlist.owner?.id === me.data.id || playlist.collaborative;
                    if (!readable) { hiddenPlaylists++; continue; }
                    playlists.push({
                        id: playlist.id,
                        name: playlist.name ?? '',
                        imageUrl: playlist.images?.[playlist.images.length - 1]?.url ?? playlist.images?.[0]?.url ?? '',
                        // `items` a partir de fev/2026; `tracks` nas respostas antigas.
                        total: playlist.items?.total ?? playlist.tracks?.total ?? 0,
                    });
                }
                if (!response.data.next) break;
            }

            return { likedTotal: liked.data.total ?? 0, playlists, hiddenPlaylists };
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar suas playlists no Spotify');
        }
    }

    // Músicas de uma playlist do usuário, na ordem da playlist. createdAt = data em que entrou nela.
    async getPlaylistTracks(accessToken: string, playlistId: string, max: number): Promise<TrackInput[]> {
        const PAGE_SIZE = 50;
        try {
            const tracks: TrackInput[] = [];

            for (let offset = 0; offset < max; offset += PAGE_SIZE) {
                const response = await axios.get(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: { limit: Math.min(PAGE_SIZE, max - offset), offset, additional_types: 'track' },
                });

                for (const entry of response.data.items ?? []) {
                    const track = entry.item ?? entry.track;
                    if (!track?.id || entry.is_local || (track.type && track.type !== 'track')) continue;
                    tracks.push(this.toTrackInput(track, entry.added_at ? new Date(entry.added_at) : new Date()));
                }
                if (!response.data.next) break;
            }

            return tracks;
        } catch (err) {
            if (err instanceof AxiosError && err.response?.status === 403) {
                throw new HttpException(
                    'O Spotify não liberou esta playlist. Use as curtidas ou outra playlist sua.',
                    HttpStatus.FORBIDDEN,
                );
            }
            this.handleAxiosError(err, 'Erro ao buscar músicas da playlist no Spotify');
        }
    }

    private toTrackInput(track: any, createdAt: Date): TrackInput {
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
            createdAt,
        };
    }

    async addTracksToQueue(accessToken: string, trackIds: string[]): Promise<QueueResult> {
        let queued = 0;
        // Em sequência: o Spotify só aceita uma faixa por chamada e a ordem da fila importa.
        for (const trackId of trackIds) {
            try {
                await axios.post('https://api.spotify.com/v1/me/player/queue', null, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: { uri: `spotify:track:${trackId}` },
                });
                queued++;
            } catch (err) {
                const status = err instanceof AxiosError ? err.response?.status : undefined;
                const detail = err instanceof AxiosError ? err.response?.data?.error?.message ?? err.message : String(err);
                return {
                    queued,
                    error: status === 404
                        ? 'Nenhum dispositivo do Spotify ativo. Abra o Spotify e dê play em algo para usar a fila.'
                        : `Falha ao adicionar à fila do Spotify: ${detail}`,
                };
            }
        }
        return { queued };
    }

    async addToQueue(accessToken: string, trackId: string): Promise<void> {
        try {
            const token = await this.refreshToken(accessToken);
            await axios.post(
                `https://api.spotify.com/v1/me/player/queue?uri=spotify:track:${trackId}`,
                null,
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao adicionar música à fila do Spotify');
        }
    }
}
