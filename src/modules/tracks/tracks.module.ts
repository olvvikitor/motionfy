import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { TrackRepository } from "./repository/TrackRepository";
import SaveTracks from "./services/saveTracks";
import { AiModule } from "src/shared/infra/IA/Ai.module";

@Module({
    imports:[ConfigModuleAplication,AiModule],
    providers:[TrackRepository, SaveTracks],
    exports:[SaveTracks,TrackRepository]
})
export class TracksModule{}