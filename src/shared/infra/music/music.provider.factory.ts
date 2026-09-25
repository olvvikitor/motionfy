import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { SpotifyProvider } from "./spotify/spotify.service";
import {MusicProviderInterface} from "./music.provider.interface";
import { YtMusicService } from "./yt/Ytmusice.service";
import { LastFmProvider } from "./lastfm/lastfm.service";

@Injectable()
export class MusicProviderFactory{
    constructor(
        private readonly spotifyProvider:SpotifyProvider,
        private readonly ytProvider:YtMusicService,
        private readonly lastFmProvider:LastFmProvider,

    ){}
    getProvider(provider:string):MusicProviderInterface{
        if(provider === 'spotify'){
            return this.spotifyProvider;
        }
        if(provider === 'lastfm'){
            return this.lastFmProvider;
        }
        if(provider === 'youtube'){
            'return this.ytProvider;'
        }
        throw new BadRequestException('Provider não existe ou não foi passado')
    }
}