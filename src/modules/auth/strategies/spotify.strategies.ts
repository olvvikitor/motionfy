import "dotenv/config";

import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-spotify';
import { Injectable } from '@nestjs/common';

export interface ResponseProfileApi {
    data: {
        country: string,
        display_name: string,
        email: string,
        explicit_content: {
            filter_enabled: boolean,
            filter_locked: boolean
        },
        external_urls: {
            spotify: string
        },
        followers: {
            href: any,
            total: boolean
        },
        href: string,
        id: string,
        images: [
            {
                height: number,
                url: string,
                width: number
            },
            {
                height: number,
                url: string,
                width: number
            }
        ],
        product: string,
        type: string,
        uri: string,
        accessToken: string,
        refreshToken: string,
    }
}
@Injectable()
export class SpotifyStrategy extends PassportStrategy(Strategy, 'spotify') {
    constructor() {
        super({
            clientID: process.env.SPOTIFY_CLIENT_ID!,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
            callbackURL: process.env.SPOTIFY_CALLBACK_URL ?? 'http://127.0.0.1:3000/auth/spotify/callback',
            scope: [
                'user-read-email',
                'user-read-private',
                'user-read-recently-played',
                'user-library-read',
                'playlist-read-private',
                'playlist-read-collaborative',
                'user-read-playback-state',
                'user-read-currently-playing',
                'user-modify-playback-state',
                // Criar playlists: usado pela conta do Mofy (SPOTIFY_MOFY_REFRESH_TOKEN).
                'playlist-modify-public',
                'playlist-modify-private',
                // Mudar a capa das playlists da conta do Mofy.
                'ugc-image-upload',

            ],
        });
    }
    async validate(
        accessToken: string,
        refreshToken: string,
    ) {

        return {
            accessToken, refreshToken,
        }
    }
}