import { Module } from "@nestjs/common";
import { GeniusProvider } from "./genius.provider";

@Module({
    controllers:[],
    providers:[GeniusProvider],
    exports:[GeniusProvider]
})
export class LyricsModule{}