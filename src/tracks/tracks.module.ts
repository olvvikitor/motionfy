import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { TrackRepository } from "./repository/TrackRepository";
import SaveTracks from "./services/saveTracks";

@Module({
    imports:[ConfigModuleAplication],
    providers:[TrackRepository, SaveTracks],
    exports:[SaveTracks,TrackRepository]
})
export class TracksModule{}