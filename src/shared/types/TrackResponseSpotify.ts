export type SpotifyRecentlyPlayedItem = {
  track: {
    id: string;
    name: string;
    artists: {
      name: string;
    }[];
    album: {
      name: string;
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
    album: {
      name: string;
      images: {
        height: string,
        url: string,
        whidth: number
      }[]
    }
  };
  added_at: string
}