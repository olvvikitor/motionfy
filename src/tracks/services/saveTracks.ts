import { Inject, Injectable } from "@nestjs/common";
import { TrackRepository } from "../repository/TrackRepository";
import { SpotifyRecentlyPlayedItem, SpotifySavedTracksItem } from "src/shared/types/TrackResponseSpotify";
import { mapSpotifyHistoryToPrisma, mapSpotifySavedTracksToPrisma } from "../mappers/spotifyToPrisma";
import { AiService } from "src/shared/providers/IA/Ai.service";

@Injectable()
export default class SaveTracks {
    constructor(
        private trackRepository: TrackRepository, 
        private iaService: AiService
    ) {}

    async saveMusicsSaved(tracks:SpotifySavedTracksItem[]): Promise<void> {
        const tracksProcessed = mapSpotifySavedTracksToPrisma(tracks);

        // Usamos um for...of para processar uma por uma e evitar 503/P2002
        for (const trackData of tracksProcessed) {
            try {
                // 1. Cria ou recupera a track (use Upsert no Repository para evitar duplicados)
                const musica = await this.trackRepository.createNewTrack(trackData);

                // 2. Verifica se já existe análise para essa música específica
                // const existingMood = await this.trackRepository.findMoodMusicById(musica.id);

                // if (!existingMood) {
                //     // 3. Só chama a IA se for necessário
                //     const mood = await this.iaService.analyzeMusicMood(musica.title, musica.artist);
                //     // 4. Salva o humor (Certifique-se que o saveMood use upsert internamente)
                //     await this.trackRepository.saveMood(musica.id, mood);
                // }

            } catch (error) {
                console.error(`Erro ao processar a faixa ${trackData.title}:`, error.message);
                // Continua para a próxima música mesmo se uma falhar
                continue;
            }
        }
    }
    async saveMusicsHistoryLine(tracks:SpotifyRecentlyPlayedItem[], idUser:string): Promise<void> {
        const tracksProcessed = mapSpotifyHistoryToPrisma(tracks);

        // Usamos um for...of para processar uma por uma e evitar 503/P2002
        for (const trackData of tracksProcessed) {
            try {
                // 1. Cria ou recupera a track (use Upsert no Repository para evitar duplicados)
                const musica = await this.trackRepository.createNewTrack(trackData);
                const historyLine = await this.trackRepository.saveHistoryListen(idUser, trackData.spotifyId, trackData.createdAt)

                // 2. Verifica se já existe análise para essa música específica
                // const existingMood = await this.trackRepository.findMoodMusicById(musica.id);

                // if (!existingMood) {
                //     // 3. Só chama a IA se for necessário
                //     const mood = await this.iaService.analyzeMusicMood(musica.title, musica.artist);
                //     // 4. Salva o humor (Certifique-se que o saveMood use upsert internamente)
                //     await this.trackRepository.saveMood(musica.id, mood);
                // }

            } catch (error) {
                console.error(`Erro ao processar a faixa ${trackData.title}:`, error.message);
                // Continua para a próxima música mesmo se uma falhar
                continue;
            }
        }
    }

}