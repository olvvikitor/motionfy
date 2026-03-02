import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/config/prisma.service';
import { UserRepository } from '../../user/repository/user.repository';

@Injectable()
export class SpotifyService {
  constructor(private userRepository:UserRepository) {}

  async getValidToken(id: string) {
    const user = await this.userRepository.getUserById(id)

    if (!user) throw new Error('User not found');


    return user.accessToken;
  }

  async refreshToken(id: string) {
    const user = await this.userRepository.getUserById(id)

    if (!user) throw new Error('User not found');

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken!,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              process.env.SPOTIFY_CLIENT_ID +
                ':' +
                process.env.SPOTIFY_CLIENT_SECRET,
            ).toString('base64'),
        },
      },
    );

    const { access_token } = response.data
    await this.userRepository.update(user.id, access_token)
    return access_token;
  }
}