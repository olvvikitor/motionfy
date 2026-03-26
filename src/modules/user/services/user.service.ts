import { Injectable, NotFoundException } from "@nestjs/common";
import { Track } from "@prisma/client";
import { UserRepository } from "../repository/user.repository";
import { UserResponseDto } from "../dto/UserResponseDto";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { AiService, ResponseAi } from "src/shared/infra/IA/Ai.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { ImagePromptService } from "src/shared/infra/IA/ImagePrompt.service";

export type ListeningNowResponse =
    | ({ isPlaying: true } & ResponseAi)
    | { isPlaying: false };

@Injectable()
export class UserService {
    constructor(
        private userRepository: UserRepository,
        private providerMusic: MusicProviderFactory,
        private saveTrackService: SaveTracks,
        private trackRepository: TrackRepository,
        private aiService: AiService,
        private prompt_imageService: ImagePromptService
    ) { }

    async getInfo(id: string): Promise<UserResponseDto> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');

        setImmediate(() => {
            this.lastTracks(id).catch(err =>
                console.error('Erro ao atualizar lastTracks:', err)
            );
        });

        return {
            country: user.country,
            display_name: user.display_name,
            email: user.email!,
            id: user.id,
            img_profile: user.img_profile,
            provider: user.provider,
        };
    }

    async lastTracks(id: string): Promise<void> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');

        const providerMusic = this.providerMusic.getProvider(user.provider);
        const tracks = await providerMusic.getLastRecentlyPlayed(user.refreshToken!);
        await this.saveTrackService.saveMusicsHistoryLine(tracks, user.id);
    }

    async RefreshMoodUserToday(id: string): Promise<ResponseAi> {

        const historyMusic = await this.trackRepository.getLastListened(id);
        const tracks = historyMusic.map(item => item.track);

        const response = await this.aiService.analyzeMusicMoodByHistoryToday(tracks);

        const image_mood = this.prompt_imageService.build(
            {
                ativacao: response.coreAxes.ativacao,
                moodScore: response.moodScore,
                sentiment: response.dominantSentiment,
                emotions:response.emotionalVector
            }

        )
        const image_charged = await this.aiService.genereateImage(image_mood)

        const mood = {
            moodScore: response.moodScore,
            sentiment: response.dominantSentiment,
            image_mood: image_charged,
            emotions: response.emotionalVector,
            coreAxes: response.coreAxes,
            tracks: response.tracks,
        };
        

        setImmediate(() => {
            this.userRepository
                .SaveMood(id, mood)
                .catch(err => console.error('Erro ao salvar mood:', err));
        });
        response.image_mood = image_charged


        return response;
    }

    async getMoodUserToday(id: string): Promise<any> {
        return await this.userRepository.getMoodUser(id);
    }

    async getValidToken(id: string): Promise<string> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuário não encontrado');
        return user.accessToken!;
    }

    async listeningNow(id: string): Promise<ListeningNowResponse> {
        const user = await this.userRepository.getUserById(id);
        if (!user) throw new NotFoundException('Usuario não encontrado');

        const providerMusic = this.providerMusic.getProvider(user.provider);
        const currentTrack = await providerMusic.getListeningNow(user.refreshToken!);

        // Nada tocando no momento — retorna flag limpa ao invés de 404
        if (!currentTrack) {
            return { isPlaying: false };
        }

        const trackToAnalyze: Track = {
            id: currentTrack.spotifyId,
            spotifyId: currentTrack.spotifyId,
            title: currentTrack.title,
            artist: currentTrack.artist,
            album: currentTrack.album,
            img_url: currentTrack.img_url,
            createdAt: currentTrack.createdAt ?? new Date(),
        };

        const analysis = await this.aiService.analyzeMusicMoodByHistoryToday([trackToAnalyze]);

        return { isPlaying: true, ...analysis };
    }
}
