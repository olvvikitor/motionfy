import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { MusicProviderInterface, ProviderUserProfile } from "../music.provider.interface";
import axios, { AxiosError } from "axios";
import { mapSpotifyHistoryToPrisma } from "src/modules/tracks/mappers/spotifyToPrisma";
import { TrackInput } from "src/shared/types/TrackInput";

@Injectable()
export class SpotifyProvider implements MusicProviderInterface {
    constructor() { }

    async getListeningNow(accessToken: string): Promise<TrackInput> {
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

            // 204 No Content → usuário não está ouvindo nada agora
            if (response.status === 204 || !response.data || !response.data.item) {
                throw new HttpException('No track currently playing', HttpStatus.NOT_FOUND);
            }

            // 400 / 401 / 403 → problema de autenticação ou requisição inválida
            if (response.status >= 400) {
                throw new HttpException('Failed to fetch currently playing track', response.status);
            }

            const track = response.data.item;

            return {
                spotifyId: track.id,
                title: track.name,
                artist: track.artists?.map((artist: { name: string }) => artist.name).join(', ') ?? 'Unknown',
                album: track.album?.name ?? '',
                img_url: track.album?.images?.[0]?.url ?? '',
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
}
