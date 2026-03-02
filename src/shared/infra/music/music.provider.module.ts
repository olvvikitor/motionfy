import { Module } from "@nestjs/common";
import { SpotifyProvider } from "./spotify/spotify.service";
import { MusicProviderFactory } from "./music.provider.factory";
@Module({
    imports:[],
    providers:[SpotifyProvider,MusicProviderFactory],
    controllers:[],
    exports:[MusicProviderFactory],
})
export class MusicProviderModule{}