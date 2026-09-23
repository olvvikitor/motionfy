export type SpotifyRecentlyPlayedItem = {
  track: {
    id: string;
    name: string;
    artists: {
      name: string;
    }[];
    explicit?: boolean;
    duration_ms?: number;
    external_ids?: { isrc?: string };
    album: {
      name: string;
      release_date?: string;
      images: {
        height: string,
        url: string,
        whidth: number
      }[]
    };
  };
  played_at: string;
}
export type SpotifySavedTracksItem = {
  track: {
    id: string;
    name: string;
    artists: {
      name: string;
    }[];
    explicit?: boolean;
    duration_ms?: number;
    external_ids?: { isrc?: string };
    album: {
      name: string;
      release_date?: string;
      images: {
        height: string,
        url: string,
        whidth: number
      }[]
    }
  };
  added_at: string
}