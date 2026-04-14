import { TrackInput } from "src/shared/types/TrackInput";

export interface ProviderUserProfile {
  id: string;
  email: string;
  displayName: string;
  country: string;
  imageUrl?: string;
}

export interface ProviderTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  playedAt?: Date;
}
export  interface MusicProviderInterface{
    getProfile(accessToken:string):Promise<ProviderUserProfile>
    getTopTracks(accessToken:string):Promise<TrackInput[]>
    getLastRecentlyPlayed(accessToken:string):Promise<TrackInput[]>
    getListeningNow(access_token:string):Promise<TrackInput>
    refreshToken(access_token:string):Promise<any>
    addToQueue?(accessToken: string, trackId: string): Promise<void>;
}