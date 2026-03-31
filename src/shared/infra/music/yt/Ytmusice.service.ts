import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MusicProviderInterface, ProviderUserProfile } from '../music.provider.interface';
import { TrackInput } from 'src/shared/types/TrackInput';
import axios, { AxiosError } from 'axios';

@Injectable()
export class YtMusicService implements MusicProviderInterface {
    getListeningNow(access_token: string): Promise<TrackInput> {
        throw new Error('Method not implemented.');
    }
    private readonly pythonServiceUrl =
        process.env.YTMUSIC_SERVICE_URL ?? 'http://localhost:3003';

    async getProfile(accessToken: string): Promise<ProviderUserProfile> {
        try {
            const response = await axios.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );

            return {
                id: response.data.id,
                email: response.data.email,
                displayName: response.data.name,
                country: '',
                imageUrl: response.data.picture,
            };
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar perfil do Google');
        }
    }

    async getTopTracks(_accessToken: string): Promise<TrackInput[]> {
        throw new HttpException(
            'getTopTracks não é suportado pelo YouTube Music',
            HttpStatus.NOT_IMPLEMENTED,
        );
    }

    async getLastRecentlyPlayed(refreshToken: string): Promise<TrackInput[]> {
        try {
            const freshAccessToken = await this.refreshToken(refreshToken);

            const response = await axios.post<RawYtTrack[]>(
                `${this.pythonServiceUrl}/history`,
                {
                    access_token: freshAccessToken,
                    refresh_token: refreshToken,
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    limit: 50,
                },
            );

            return response.data.map(mapYtTrackToTrackInput);
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao buscar histórico do YouTube Music');
        }
    }

    async refreshToken(refreshToken: string): Promise<string> {
        try {
            const response = await axios.post(
                'https://oauth2.googleapis.com/token',
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
            );

            return response.data.access_token as string;
        } catch (err) {
            this.handleAxiosError(err, 'Erro ao renovar token do Google');
        }
    }

    private handleAxiosError(err: unknown, message: string): never {
        if (err instanceof AxiosError) {
            const status = err.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const detail = err.response?.data?.error_description ?? err.message;
            throw new HttpException(`${message}: ${detail}`, status);
        }
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type RawYtTrack = {
    id: string;
    title: string;
    artist: string;
    img_url: string;
};

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapYtTrackToTrackInput(track: RawYtTrack): TrackInput {
    return {
        spotifyId: track.id,
        title: track.title,
        artist: track.artist,
        album: '',
        createdAt: new Date(),
        img_url: track.img_url ?? '',
    };
}
