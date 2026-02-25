import { Inject, Injectable } from "@nestjs/common";
import { TrackRepository } from "../repository/TrackRepository";
import { SpotifyRecentlyPlayedItem } from "src/shared/types/TrackResponseSpotify";
import { mapSpotifyToPrisma } from "../mappers/spotifyToPrisma";
import { AiService } from "src/shared/providers/IA/Ai.service";

@Injectable()
export default class SaveTracks {
    constructor(
        private trackRepository: TrackRepository, 
        private iaService: AiService
    ) {}

    async saveMusic(tracks: SpotifyRecentlyPlayedItem[]): Promise<void> {
        const tracksProcessed = mapSpotifyToPrisma(tracks);

        // Usamos um for...of para processar uma por uma e evitar 503/P2002
        for (const trackData of tracksProcessed) {
            try {
                // 1. Cria ou recupera a track (use Upsert no Repository para evitar duplicados)
                const musica = await this.trackRepository.createNewTrack(trackData);

                // 2. Verifica se já existe análise para essa música específica
                const existingMood = await this.trackRepository.findMoodMusicById(musica.id);

                if (!existingMood) {
                    // 3. Só chama a IA se for necessário
                    const mood = await this.iaService.analyzeMusicMood(musica.title, musica.artist);
                    // 4. Salva o humor (Certifique-se que o saveMood use upsert internamente)
                    await this.trackRepository.saveMood(musica.id, mood);
                }
            } catch (error) {
                console.error(`Erro ao processar a faixa ${trackData.title}:`, error.message);
                // Continua para a próxima música mesmo se uma falhar
                continue;
            }
        }
    }
    // Função auxiliar para criar a pausa
    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}