-- Playlist do próprio usuário no Spotify trazida pelo link (Biblioteca > Playlists).
ALTER TABLE "MofyPlaylist" ADD COLUMN "imported" BOOLEAN NOT NULL DEFAULT false;
