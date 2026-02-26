export type SpotifyRecentlyPlayedItem= {
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
export type SpotifySavedTracksItem ={
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
  added_at:string
}