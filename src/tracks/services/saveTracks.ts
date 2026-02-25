import { Injectable } from "@nestjs/common";
import { TrackRepository } from "../repository/TrackRepository";
import { SpotifyRecentlyPlayedItem } from "src/shared/types/TrackResponseSpotify";
import { mapSpotifyToPrisma } from "../mappers/spotifyToPrisma";

@Injectable()
export default class SaveTracks {

    constructor(private trackRepository: TrackRepository) {
    }

    async saveMusic(tracks: SpotifyRecentlyPlayedItem[]): Promise<void> {
        const tracksProcessed = mapSpotifyToPrisma(tracks)
        
        Promise.all(tracksProcessed.map(async (track) => await this.trackRepository.createNewTrack(track)))
    }

}