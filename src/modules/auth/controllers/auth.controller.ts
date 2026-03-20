import { Controller, Get, Req, Res, UseGuards, Post, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { LoginCredentialsDto, SetPasswordDto } from '../dtos/auth.dto';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

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
        const token = await this.authService.handleCallback('spotify', { accessToken, refreshToken });
        return res.redirect(`${this.getFrontendUrl(req)}/terminate?token=${token}`);
    }

    @Get('youtube')
    @UseGuards(AuthGuard('youtube'))
    youtubeLogin() { }

    @Get('youtube/callback')
    @UseGuards(AuthGuard('youtube'))
    async youtubeCallback(@Req() req: any, @Res() res: any) {
        const { accessToken, refreshToken } = req.user;
        const token = await this.authService.handleCallback('youtube', { accessToken, refreshToken });
        return res.redirect(`${this.getFrontendUrl(req)}/terminate?token=${token}`);
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
