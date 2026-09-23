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
    // Recebem access token já renovado (uma renovação por fluxo, não por chamada).
    searchTracks?(accessToken: string, query: string): Promise<TrackInput[]>;
    addTracksToQueue?(accessToken: string, trackIds: string[]): Promise<QueueResult>;
}

export interface QueueResult {
  queued: number;
  // Motivo quando nada/parte não entrou (ex.: nenhum dispositivo ativo).
  error?: string;
}