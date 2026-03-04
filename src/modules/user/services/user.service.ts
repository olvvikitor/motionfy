import { Injectable, NotFoundException } from "@nestjs/common";
import { UserRepository } from "../repository/user.repository";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiService, ResponseAi } from "src/shared/infra/IA/Ai.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";

@Injectable()
export  class UserService {
    constructor(private userRepository: UserRepository,
        private providerMusic: MusicProviderFactory,
        private saveTrackService: SaveTracks,
        private trackRepository: TrackRepository,
        private AiService: AiService
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
            provider: user.provider
        }
    }

    async lastTracks(id: string): Promise<void> {
        const user = await this.userRepository.getUserById(id)

        if (!user) throw new NotFoundException('Usuario não encontrado')

        const providerMusic = this.providerMusic.getProvider(user.provider)

        const tracks = await providerMusic.getLastRecentlyPlayed(user.refreshToken!)

        await this.saveTrackService.saveMusicsHistoryLine(tracks, user.id)

    }
    // async getSavedTracks(id: string): Promise<SpotifyRecentlyPlayedItem[]> {
    //     const user = await this.userRepository.getUserById(id)

    //     if (!user) throw new NotFoundException('Usuario não encontrado')

    //     const token = await this.spotifyService.getValidToken(user.id)

    //     const response = await axios.get(
    //         'https://api.spotify.com/v1/me/tracks?offset=0&limit=50&locale=pt-BR',
    //         {
    //             headers: {
    //                 Authorization: `Bearer ${token}`,
    //             },
    //         },
    //     );
    //     await this.saveTrackService.saveMusicsSaved(response.data.items)
    //     return response.data
    // }
    async RefreshMoodUserToday(id: string): Promise<ResponseAi> {
        const historyMusic = await this.trackRepository.getLastListened(id);
        const tracks = historyMusic.map(item => item.track);

        const response = await this.AiService.analyzeMusicMoodByHistoryToday(tracks);

        const mood = {
            moodScore: response.moodScore,
            sentiment: response.dominantSentiment,
            emotions: response.emotionalVector,
            coreAxes: response.coreAxes,
            tracks: response.tracks
        };

        // 🔥 dispara sem bloquear a resposta
        setImmediate(() => {
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
    async getValidToken(id: string) {
        const user = await this.userRepository.getUserById(id)

        if (!user) throw new Error('User not found');


        return user.accessToken;
    }
    

}