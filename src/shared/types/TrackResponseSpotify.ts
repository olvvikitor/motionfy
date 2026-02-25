export interface SpotifyRecentlyPlayedItem {
  track: {
    id: string;
    name: string;
    artists: {
      name: string;
    }[];
    album: {
      name: string;
    };
  };
  played_at: string;
}