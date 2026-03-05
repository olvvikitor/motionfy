import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MusicProviderInterface, ProviderUserProfile } from '../music.provider.interface';
import { TrackInput } from 'src/shared/types/TrackInput';
import axios from 'axios';

@Injectable()
export class YtMusicService implements MusicProviderInterface {
    private readonly pythonServiceUrl =
        process.env.YTMUSIC_SERVICE_URL ?? 'http://localhost:3003';

    // ── getProfile ────────────────────────────────────────────────────────────
    // YouTube OAuth usa Google, então o perfil vem da API do Google
    async getProfile(accessToken: string): Promise<ProviderUserProfile> {
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
    }

    // ── getTopTracks ──────────────────────────────────────────────────────────
    // YT Music não expõe top tracks via API — não implementado
    async getTopTracks(_accessToken: string): Promise<TrackInput[]> {
        throw new HttpException(
            'getTopTracks não é suportado pelo YouTube Music',
            HttpStatus.NOT_IMPLEMENTED,
        );
    }

    // ── getLastRecentlyPlayed ─────────────────────────────────────────────────
    // 1. Troca o refreshToken salvo no banco por um accessToken fresco
    // 2. Manda o accessToken fresco pro Python junto com as credenciais do app
    async getLastRecentlyPlayed(refreshToken: string): Promise<TrackInput[]> {
        const freshAccessToken = await this.refreshToken(refreshToken);

        const response = await axios.post<RawYtTrack[]>(
            `${this.pythonServiceUrl}/history`,
            {
                access_token: freshAccessToken,
                refresh_token: refreshToken,      // ← adicione
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                limit: 50,
            },
        );

        return response.data.map(mapYtTrackToTrackInput);
    }

    // ── refreshToken ──────────────────────────────────────────────────────────
    // Google OAuth2 — mesmo padrão do Spotify, mas endpoint diferente
    async refreshToken(refreshToken: string): Promise<string> {
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
// Mesmo shape que mapSpotifyHistoryToPrisma produz — sem surpresas downstream

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