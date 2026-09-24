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
    // null = nada tocando agora (não é erro).
    getListeningNow(access_token:string):Promise<TrackInput | null>
    refreshToken(access_token:string):Promise<any>
    addToQueue?(accessToken: string, trackId: string): Promise<void>;
    // Recebem access token já renovado (uma renovação por fluxo, não por chamada).
    searchTracks?(accessToken: string, query: string, offset?: number): Promise<TrackInput[]>;
    getSavedTracks?(accessToken: string, max: number): Promise<TrackInput[]>;
    getLibrarySources?(accessToken: string): Promise<LibrarySources>;
    getPlaylistTracks?(accessToken: string, playlistId: string, max: number): Promise<TrackInput[]>;
    addTracksToQueue?(accessToken: string, trackIds: string[]): Promise<QueueResult>;
}

export interface LibraryPlaylist {
  id: string;
  name: string;
  imageUrl: string;
  total: number;
}

// De onde o usuário pode puxar músicas para a biblioteca.
export interface LibrarySources {
  likedTotal: number;
  playlists: LibraryPlaylist[];
  // Playlists seguidas de outras pessoas: o provedor só entrega os metadados, não as músicas.
  hiddenPlaylists: number;
}

export interface QueueResult {
  queued: number;
  // Motivo quando nada/parte não entrou (ex.: nenhum dispositivo ativo).
  error?: string;
}