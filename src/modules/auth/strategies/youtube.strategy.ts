import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20'; // ← era passport-spotify, causava o bug

/**
 * Strategy 'youtube' — OAuth via Google com scopes do YouTube Music.
 *
 * Instalar:  npm install passport-google-oauth20 @types/passport-google-oauth20
 *
 * Variáveis de ambiente necessárias:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_CALLBACK_URL   (ex: http://localhost:3000/auth/youtube/callback)
 */
@Injectable()
export class YoutubeStrategy extends PassportStrategy(Strategy, 'youtube') {
    constructor() {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/auth/youtube/callback',
            scope: [
                'https://www.googleapis.com/auth/youtube.readonly',
                'https://www.googleapis.com/auth/youtube',
                'profile',
                'email',
            ],


        });
    }
    authorizationParams(): object {
        return {
            access_type: 'offline',
            prompt: 'consent', // força o Google a emitir refresh_token mesmo já tendo autorizado
        };
    }
    async validate(
        accessToken: string,
        refreshToken: string,
        _profile: any,

    ): Promise<{ accessToken: string; refreshToken: string }> {
        // Repassa os tokens pro controller — mesmo padrão do Spotify
        return { accessToken, refreshToken };
    }
}