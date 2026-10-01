import { TrackInput } from "src/shared/types/TrackInput";

export interface ProviderUserProfile {
  id: string;
  email: string | null; // o Last.fm não informa e-mail
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
    // null = nada tocando agora (não é erro).
    getListeningNow(access_token:string):Promise<TrackInput | null>
    refreshToken(access_token:string):Promise<any>
    // Recebem access token já renovado (uma renovação por fluxo, não por chamada).
    searchTracks?(accessToken: string, query: string, offset?: number): Promise<TrackInput[]>;
    addTracksToQueue?(accessToken: string, trackIds: string[]): Promise<QueueResult>;
    // Quando o provedor recebeu a última música (Last.fm: último scrobble). null = nunca.
    getLastActivity?(refreshToken: string): Promise<Date | null>;
}

export interface QueueResult {
  queued: number;
  // Motivo quando nada/parte não entrou (ex.: nenhum dispositivo ativo).
  error?: string;
}