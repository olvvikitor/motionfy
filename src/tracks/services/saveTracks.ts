import {Injectable } from "@nestjs/common";
import { TrackRepository } from "../repository/TrackRepository";
import { SpotifyRecentlyPlayedItem, SpotifySavedTracksItem } from "src/shared/types/TrackResponseSpotify";
import { mapSpotifyHistoryToPrisma, mapSpotifySavedTracksToPrisma } from "../mappers/spotifyToPrisma";

@Injectable()
export default class SaveTracks {
    constructor(
        private trackRepository: TrackRepository,
    ) { }

    async saveMusicsSaved(tracks: SpotifySavedTracksItem[]): Promise<void> {
        const tracksProcessed = mapSpotifySavedTracksToPrisma(tracks);

        // Usamos um for...of para processar uma por uma e evitar 503/P2002
        for (const trackData of tracksProcessed) {
            try {
                // 1. Cria ou recupera a track (use Upsert no Repository para evitar duplicados)
              await this.trackRepository.createNewTrack(trackData);

            } catch (error) {
                console.error(`Erro ao processar a faixa ${trackData.title}:`, error.message);
                // Continua para a próxima música mesmo se uma falhar
                continue;
            }
        }
    }
    async saveMusicsHistoryLine(tracks: SpotifyRecentlyPlayedItem[], idUser: string): Promise<void> {
        const tracksProcessed = mapSpotifyHistoryToPrisma(tracks);

        // Usamos um for...of para processar uma por uma e evitar 503/P2002
        for (const trackData of tracksProcessed) {
            try {
                // 1. Cria ou recupera a track (use Upsert no Repository para evitar duplicados)
                await this.trackRepository.createNewTrack(trackData);
                await this.trackRepository.saveHistoryListen(idUser, trackData.spotifyId, trackData.createdAt)

            } catch (error) {
                console.error(`Erro ao processar a faixa ${trackData.title}:`, error.message);
                // Continua para a próxima música mesmo se uma falhar
                continue;
            }
        }
    }

}