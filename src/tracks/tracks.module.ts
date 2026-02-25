import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { TrackRepository } from "./repository/TrackRepository";
import SaveTracks from "./services/saveTracks";
import { LyricsModule } from "src/shared/providers/genius/genius.module";
import { AiModule } from "src/shared/providers/IA/Ai.module";

@Module({
    imports:[ConfigModuleAplication,LyricsModule,AiModule],
    providers:[TrackRepository, SaveTracks],
    exports:[SaveTracks,TrackRepository]
})
export class TracksModule{}