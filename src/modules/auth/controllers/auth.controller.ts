import { Body, Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserService } from '../services/create.user.service';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }


    @Get(':provider')
    @UseGuards(AuthGuard())
    async login() { }

    @Get(':provider/callback')
    @UseGuards()
    async callback(
        @Param('provider') provider: string,
        @Req() req: any,
        @Res() res: any) {
        const token = await this.authService.handleCallback(provider, req.user)
        return res.redirect(`http://localhost:3002/auth-success?token=${token}`);
    }
}