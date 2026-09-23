export interface TrackInput {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  img_url:string
  createdAt: Date;
  isrc?: string | null;
  explicit?: boolean | null;
  releaseDate?: string | null;
  durationMs?: number | null;
}
