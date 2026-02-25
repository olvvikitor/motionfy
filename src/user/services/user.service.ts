import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { UserRepository } from "../repository/user.repository";
import { User } from "@prisma/client";
import { NotFoundError } from "rxjs";
import { SpotifyService } from "src/auth/services/spotfy.service";
import axios from "axios";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/tracks/services/saveTracks";
import { SpotifyRecentlyPlayedItem } from "src/shared/types/TrackResponseSpotify";

@Injectable()
export default class UserService {
    constructor(private userRepository: UserRepository, @Inject() private spotifyService: SpotifyService, @Inject() private saveTrackService:SaveTracks) {
    }

    async getInfo(id: string): Promise<UserResponseDto> {
        const user = await this.userRepository.getUserById(id)
        if (!user) throw new NotFoundException('Usuario não encontrado')
        return {
            country:user.country,
            display_name:user.display_name,
            email:user.email!,
            id:user.id,
            img_profile:user.img_profile,
            spotifyId:user.spotifyId
        }
    }
    async lastTracks(id: string): Promise<SpotifyRecentlyPlayedItem[]> {
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
        await this.saveTrackService.saveMusic(response.data.items)
        return response.data
    }
}