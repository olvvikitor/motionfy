import { Body, Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@prisma/client';
import { CreateUserService } from 'src/modules/user/services/create.user.service';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly createUser: CreateUserService, private readonly authService:AuthService) { }

    @Get('spotify')
    @UseGuards(AuthGuard('spotify'))
    async spotifyLogin() {
    }

    @Get('spotify/callback')
    @UseGuards(AuthGuard('spotify'))
    async spotifyCallback(@Req() req: any, @Res() res) {
        const { accessToken, refreshToken } = req.user

        const token = await this.authService.handleCallback('spotify', {accessToken, refreshToken})

        return res.redirect(`http://localhost:3002/auth-success?token=${token}`);
    }
}