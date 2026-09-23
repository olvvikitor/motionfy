import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { AiModule } from "src/shared/infra/IA/Ai.module";
import { MusicProviderModule } from "src/shared/infra/music/music.provider.module";
import { TracksModule } from "../tracks/tracks.module";
import { PlaylistController } from "./controllers/playlist.controller";
import { PlaylistRepository } from "./repository/playlist.repository";
import { CandidateSourcingService } from "./services/candidate-sourcing.service";
import { JourneyPlaylistService } from "./services/journey-playlist.service";

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, AiModule, MusicProviderModule, TracksModule],
    controllers: [PlaylistController],
    providers: [PlaylistRepository, CandidateSourcingService, JourneyPlaylistService],
})
export class PlaylistModule {}
