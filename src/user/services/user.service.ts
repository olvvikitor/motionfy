import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { UserRepository } from "../repository/user.repository";
import { User } from "@prisma/client";
import { NotFoundError } from "rxjs";
import { SpotifyService } from "src/auth/services/spotfy.service";
import axios from "axios";

@Injectable()
export default class UserService {
    constructor(private userRepository: UserRepository, @Inject() private spotifyService: SpotifyService) {
    }

    async getInfo(id: string): Promise<User> {
        const user = await this.userRepository.getUserById(id)
        if (!user) throw new NotFoundException('Usuario não encontrado')
        return user
    }
    async lastTracks(id: string): Promise<User> {
        const user = await this.userRepository.getUserById(id)

        if (!user) throw new NotFoundException('Usuario não encontrado')

        const token = await this.spotifyService.getValidToken(user.id)

        const response = await axios.get(
            'https://api.spotify.com/v1/me/player/recently-played?limit=5',
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        return response.data
    }
}