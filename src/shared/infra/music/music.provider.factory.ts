import { BadRequestException, Injectable } from "@nestjs/common";
import { SpotifyProvider } from "./spotify/spotify.service";
import MusicProviderInterface from "./music.provider.interface";

@Injectable()
export class MusicProviderFactory{
    constructor(
        private spotifyProvider:SpotifyProvider,
    ){}
    getProvider(provider:string):MusicProviderInterface{
        if(provider === 'spotify'){
            return this.spotifyProvider;
        }
        throw new BadRequestException('Provider não existe ou não foi passado')
    }
}