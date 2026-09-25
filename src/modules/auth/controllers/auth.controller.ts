import { Controller, Get, Req, Res, UseGuards, Post, Body, Query, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { LastFmProvider } from 'src/shared/infra/music/lastfm/lastfm.service';
import { SpotifyMofyAccountService } from 'src/shared/infra/music/spotify/spotify-mofy-account.service';
import { randomBytes } from 'crypto';
import { LoginCredentialsDto, SetPasswordDto } from '../dtos/auth.dto';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';

@Controller('auth')
export class AuthController {
    // state do login da conta do Mofy → quando começou (vale 10 min, uso único).
    private readonly mofyAccountStates = new Map<string, number>();

    constructor(
        private readonly authService: AuthService,
        private readonly lastFm: LastFmProvider,
        private readonly mofyAccount: SpotifyMofyAccountService,
    ) { }

    private getFrontendUrl(req: any) {
        if (process.env.FRONTEND_URL) {
            return process.env.FRONTEND_URL;
        }

        const protocol = req.protocol ?? 'http';
        const host = req.get('host') ?? 'localhost:3000';
        const hostname = host.replace(/:\d+$/, '');
        return `${protocol}://${hostname}:3002`;
    }

    @Get('spotify/callback')
    @UseGuards(AuthGuard('spotify'))
    async spotifyCallback(@Req() req: any, @Res() res) {
        const { accessToken, refreshToken } = req.user;
        const frontend = this.getFrontendUrl(req);
        try {
            const { token, isNewUser } = await this.authService.handleCallback('spotify', { accessToken, refreshToken });
            return res.redirect(`${frontend}/terminate?token=${token}&new=${isNewUser}`);
        } catch (error) {
            // Contas novas só pelo Last.fm: quem não tinha conta volta ao login com o aviso.
            if (error instanceof ForbiddenException) return res.redirect(`${frontend}/login?error=signup-closed`);
            console.error('[Auth] login com Spotify falhou:', error?.message ?? error);
            return res.redirect(`${frontend}/login?error=spotify`);
        }
    }

    // Last.fm: sem limite de usuários como o Spotify. Redireciona para a tela de permissão dele.
    @Get('lastfm')
    lastfmLogin(@Res() res: any) {
        return res.redirect(this.lastFm.authUrl());
    }

    @Get('lastfm/callback')
    async lastfmCallback(@Req() req: any, @Res() res: any, @Query('token') lastfmToken?: string) {
        const frontend = this.getFrontendUrl(req);
        if (!lastfmToken) return res.redirect(`${frontend}/login?error=lastfm`);
        try {
            const sessionKey = await this.lastFm.getSessionKey(lastfmToken);
            const { token, isNewUser } = await this.authService.handleCallback('lastfm', { accessToken: sessionKey, refreshToken: sessionKey });
            return res.redirect(`${frontend}/terminate?token=${token}&new=${isNewUser}`);
        } catch (error) {
            console.error('[Auth] login com Last.fm falhou:', error?.message ?? error);
            return res.redirect(`${frontend}/login?error=lastfm`);
        }
    }

    // Configuração única da conta do Mofy no Spotify (onde as playlists são criadas).
    // O dono abre GET auth/spotify/mofy-account?key=MOFY_ADMIN_KEY, entra com a conta do
    // Mofy e copia o refresh token mostrado para SPOTIFY_MOFY_REFRESH_TOKEN.
    @Get('spotify/mofy-account')
    mofyAccountLogin(@Query('key') key: string | undefined, @Res() res: any) {
        const adminKey = process.env.MOFY_ADMIN_KEY;
        if (!adminKey || key !== adminKey) return res.status(403).send('Acesso negado.');
        const state = randomBytes(16).toString('hex');
        this.mofyAccountStates.set(state, Date.now());
        return res.redirect(this.mofyAccount.authorizeUrl(state, this.mofyAccountCallbackUrl()));
    }

    @Get('spotify/mofy-account/callback')
    async mofyAccountCallback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Res() res: any) {
        const startedAt = state ? this.mofyAccountStates.get(state) : undefined;
        if (state) this.mofyAccountStates.delete(state);
        if (!code || !startedAt || Date.now() - startedAt > 10 * 60_000) return res.status(400).send('Link expirado. Comece de novo.');

        const refreshToken = await this.mofyAccount.exchangeCode(code, this.mofyAccountCallbackUrl());
        res.set('Cache-Control', 'no-store');
        return res.type('text/plain').send(`Coloque no .env da API e reinicie:\n\nSPOTIFY_MOFY_REFRESH_TOKEN=${refreshToken}\n`);
    }

    private mofyAccountCallbackUrl(): string {
        return process.env.SPOTIFY_MOFY_CALLBACK_URL ?? 'http://127.0.0.1:3000/auth/spotify/mofy-account/callback';
    }

    @Get('youtube')
    @UseGuards(AuthGuard('youtube'))
    youtubeLogin() { }

    @Get('youtube/callback')
    @UseGuards(AuthGuard('youtube'))
    async youtubeCallback(@Req() req: any, @Res() res: any) {
        const { accessToken, refreshToken } = req.user;
        const { token, isNewUser } = await this.authService.handleCallback('youtube', { accessToken, refreshToken });
        return res.redirect(`${this.getFrontendUrl(req)}/terminate?token=${token}&new=${isNewUser}`);
    }

    @Post('login')
    async login(@Body() credentials: LoginCredentialsDto) {
        return await this.authService.login(credentials);
    }

    @Post('set-password')
    @UseGuards(JwtAuthGuard)
    async setPassword(@Req() req: any, @Body() data: SetPasswordDto) {
        const userId = req.user.id;
        return await this.authService.setPassword(userId, data);
    }
}
