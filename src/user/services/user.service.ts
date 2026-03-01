import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { UserRepository } from "../repository/user.repository";
import { User } from "@prisma/client";
import { NotFoundError } from "rxjs";
import { SpotifyService } from "src/auth/services/spotfy.service";
import axios from "axios";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/tracks/services/saveTracks";
import { SpotifyRecentlyPlayedItem } from "src/shared/types/TrackResponseSpotify";
import { TrackRepository } from "src/tracks/repository/TrackRepository";
import { AiService, ResponseAi } from "src/shared/providers/IA/Ai.service";

@Injectable()
export default class UserService {
    constructor(private userRepository: UserRepository,
        @Inject() private spotifyService: SpotifyService,
        @Inject() private saveTrackService: SaveTracks,
        @Inject() private trackRepository: TrackRepository,
        @Inject() private AiService: AiService
    ) {
    }

    async getInfo(id: string): Promise<UserResponseDto> {
        const user = await this.userRepository.getUserById(id)


        if (!user) throw new NotFoundException('Usuario não encontrado')

        this.lastTracks(id);

        return {
            country: user.country,
            display_name: user.display_name,
            email: user.email!,
            id: user.id,
            img_profile: user.img_profile,
            spotifyId: user.spotifyId
        }
    }

    async lastTracks(id: string): Promise<SpotifyRecentlyPlayedItem[]> {
        const user = await this.userRepository.getUserById(id)

        if (!user) throw new NotFoundException('Usuario não encontrado')

        const token = await this.spotifyService.getValidToken(user.id)

        const response = await axios.get(
            'https://api.spotify.com/v1/me/player/recently-played?limit=50',
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        await this.saveTrackService.saveMusicsHistoryLine(response.data.items, user.id)
        return response.data
    }
    async getSavedTracks(id: string): Promise<SpotifyRecentlyPlayedItem[]> {
        const user = await this.userRepository.getUserById(id)

        if (!user) throw new NotFoundException('Usuario não encontrado')

        const token = await this.spotifyService.getValidToken(user.id)

        const response = await axios.get(
            'https://api.spotify.com/v1/me/tracks?offset=0&limit=50&locale=pt-BR',
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        await this.saveTrackService.saveMusicsSaved(response.data.items)
        return response.data
    }
    async RefreshMoodUserToday(id: string): Promise<ResponseAi> {
        const historyMusic = await this.trackRepository.getLastListened(id);
        const tracks = historyMusic.map(item => item.track);

        const response = await this.AiService.analyzeMusicMoodByHistoryToday(tracks);

        const mood = {
            moodScore: response.moodScore,
            sentiment: response.dominantSentiment,
            emotions: response.emotionalVector,
            tracks:response.tracks
        };

        // 🔥 dispara sem bloquear a resposta
        setImmediate(()=>{
            this.userRepository
                .SaveMood(id, mood)
                .catch(err => {
                    console.error('Erro ao salvar mood:', err);
                });
        })

        return response;
    }
    async getMoodUserToday(id: string): Promise<any> {
        const response = await this.userRepository.getMoodUser(id);
        return response;
    }
}