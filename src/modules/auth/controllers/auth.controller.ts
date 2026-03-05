import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService:AuthService) { }

    @Get('spotify/callback')
    @UseGuards(AuthGuard('spotify'))
    async spotifyCallback(@Req() req: any, @Res() res) {
        const { accessToken, refreshToken } = req.user

        const token = await this.authService.handleCallback('spotify', {accessToken, refreshToken})

        return res.redirect(`http://localhost:3002/terminate?token=${token}`);
    }
}