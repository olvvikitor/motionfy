import { TrackInput } from "src/shared/types/TrackInput";
import { SpotifyRecentlyPlayedItem } from "src/shared/types/TrackResponseSpotify";

export const mapSpotifyToPrisma = (items: SpotifyRecentlyPlayedItem[]): TrackInput[] => {
  return items.map((item) => ({
    spotifyId: item.track.id,
    title: item.track.name,
    // Une múltiplos artistas em uma string separada por vírgula
    artist: item.track.artists.map((a) => a.name).join(", "),
    album: item.track.album.name,
    // Converte a string ISO do Spotify para um objeto Date do JS/Prisma
    createdAt: new Date(item.played_at),
  }));
};