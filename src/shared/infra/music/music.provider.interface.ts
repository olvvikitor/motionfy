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
export default interface MusicProviderInterface{
    getProfile(accessToken:string):Promise<ProviderUserProfile>
    getTopTracks(accessToken:string):Promise<ProviderTrack[]>
    getLastTracgetRecentlyPlayed(accessToken:string):Promise<ProviderTrack[]>
}