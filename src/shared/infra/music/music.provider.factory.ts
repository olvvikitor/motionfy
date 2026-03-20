import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { SpotifyProvider } from "./spotify/spotify.service";
import {MusicProviderInterface} from "./music.provider.interface";
import { YtMusicService } from "./yt/Ytmusice.service";

@Injectable()
export class MusicProviderFactory{
    constructor(
        private readonly spotifyProvider:SpotifyProvider,
        private readonly ytProvider:YtMusicService

    ){}
    getProvider(provider:string):MusicProviderInterface{
        if(provider === 'spotify'){
            return this.spotifyProvider;
        }
        if(provider === 'youtube'){
            'return this.ytProvider;'
        }
        throw new BadRequestException('Provider não existe ou não foi passado')
    }
}