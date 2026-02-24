import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserService } from '../services/create.user.service';
import { ResponseProfileApi } from '../strategies/spotify.strategies';
import { User } from '@prisma/client';
// import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private createUser:CreateUserService) {}

  @Get('spotify')
  @UseGuards(AuthGuard('spotify'))
  async spotifyLogin() {
    // redireciona automaticamente
  }

  @Get('spotify/callback')
  @UseGuards(AuthGuard('spotify'))
  async spotifyCallback(@Req() req) {
    const userResponse = req.user

    const user:User = {
        country:userResponse.data.country,
        display_name:userResponse.data.display_name,
        email:userResponse.data.email,
        id:userResponse.data.id,
        img_profile:userResponse.data.images[0].url,
        spotifyAccessToken:userResponse.accessToken,
        spotifyId:userResponse.data.id,
        spotifyRefreshToken:userResponse.refreshToken
    }
    return this.createUser.create(user);
  }
}