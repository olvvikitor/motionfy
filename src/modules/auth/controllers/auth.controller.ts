import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('spotify/callback')
    @UseGuards(AuthGuard('spotify'))
    async spotifyCallback(@Req() req: any, @Res() res) {
        const { accessToken, refreshToken } = req.user

        const token = await this.authService.handleCallback('spotify', { accessToken, refreshToken })
        return res.redirect(`http://localhost:3002/terminate?token=${token}`);
    }


        // ← rota que inicia o fluxo — redireciona pro Google
    @Get('youtube')
    @UseGuards(AuthGuard('youtube'))
    youtubeLogin() {}


    @Get('youtube/callback')
    @UseGuards(AuthGuard('youtube'))
    async youtubeCallback(@Req() req: any, @Res() res: any) {
        const { accessToken, refreshToken } = req.user;
        console.log('refreshToken recebido:', refreshToken); // não deve ser null
        console.log('refreshToken recebido:', accessToken); // não deve ser null

        const token = await this.authService.handleCallback('youtube', { accessToken, refreshToken });
        return res.redirect(`http://localhost:3002/terminate?token=${token}`);
    }
}