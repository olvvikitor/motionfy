import { Module } from "@nestjs/common";
import { SpotifyProvider } from "./spotify/spotify.service";
import { MusicProviderFactory } from "./music.provider.factory";
import { YtMusicService } from "./yt/Ytmusice.service";
@Module({
    imports:[],
    providers:[SpotifyProvider,YtMusicService,MusicProviderFactory],
    controllers:[],
    exports:[MusicProviderFactory],
})
export class MusicProviderModule{}