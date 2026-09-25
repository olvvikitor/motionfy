import { Module } from "@nestjs/common";
import { SpotifyProvider } from "./spotify/spotify.service";
import { SpotifyCatalogService } from "./spotify/spotify-catalog.service";
import { SpotifyMofyAccountService } from "./spotify/spotify-mofy-account.service";
import { LastFmProvider } from "./lastfm/lastfm.service";
import { MusicProviderFactory } from "./music.provider.factory";
import { YtMusicService } from "./yt/Ytmusice.service";
@Module({
    imports:[],
    providers:[SpotifyProvider,SpotifyCatalogService,SpotifyMofyAccountService,LastFmProvider,YtMusicService,MusicProviderFactory],
    controllers:[],
    exports:[MusicProviderFactory,LastFmProvider,SpotifyMofyAccountService],
})
export class MusicProviderModule{}
