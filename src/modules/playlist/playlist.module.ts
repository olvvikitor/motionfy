import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { AiModule } from "src/shared/infra/IA/Ai.module";
import { MusicProviderModule } from "src/shared/infra/music/music.provider.module";
import { CreditModule } from "../credits/credit.module";
import { StorageModule } from "src/shared/infra/storage/storage.module";
import { TracksModule } from "../tracks/tracks.module";
import { PlaylistController } from "./controllers/playlist.controller";
import { PlaylistRepository } from "./repository/playlist.repository";
import { CandidateSourcingService } from "./services/candidate-sourcing.service";
import { JourneyPlaylistService } from "./services/journey-playlist.service";
import { MofyPlaylistService } from "./services/mofy-playlist.service";
import { PlaylistCoverService } from "./services/playlist-cover.service";

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, AiModule, MusicProviderModule, TracksModule, CreditModule, StorageModule],
    controllers: [PlaylistController],
    providers: [PlaylistRepository, CandidateSourcingService, JourneyPlaylistService, MofyPlaylistService, PlaylistCoverService],
})
export class PlaylistModule {}
