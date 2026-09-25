-- Destaque das playlists no perfil
ALTER TABLE "MofyPlaylist" ADD COLUMN "title" TEXT;
ALTER TABLE "MofyPlaylist" ADD COLUMN "sentiment" TEXT;
ALTER TABLE "MofyPlaylist" ADD COLUMN "fromSentiment" TEXT;
ALTER TABLE "MofyPlaylist" ADD COLUMN "trackIds" JSONB;
ALTER TABLE "MofyPlaylist" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "MofyPlaylist" ADD COLUMN "featuredOrder" INTEGER;
