import { Body, Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserService } from '../services/create.user.service';
import { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private createUser: CreateUserService) { }

  @Get('spotify')
  @UseGuards(AuthGuard('spotify'))
  async spotifyLogin() {
    // redireciona automaticamente
  }

  @Get('spotify/callback')
  @UseGuards(AuthGuard('spotify'))
  async spotifyCallback(@Req() req: any) {
    const userResponse = req.user
    let url_perfil = ''

    if (userResponse.data.images) {
      url_perfil = userResponse.data.images[0].url as string
    }

    const user: User = {
      country: userResponse.data.country,
      display_name: userResponse.data.display_name,
      email: userResponse.data.email,
      id: userResponse.data.id,
      spotifyExpiresAt: userResponse.expiresAt,
      img_profile: userResponse.data.images[0].url || '',
      spotifyAccessToken: userResponse.accessToken,
      spotifyId: userResponse.data.id,
      spotifyRefreshToken: userResponse.refreshToken
    }
    const token = await this.createUser.create(user);

    return {token:token}
  }
}