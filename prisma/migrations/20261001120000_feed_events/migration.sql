-- Feed de acontecimentos: quando cada humor começou (analyzedAt é renovado enquanto ele segue) e
-- reações/comentários nas playlists.
ALTER TABLE "MoodAnalysis" ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Humores antigos: o começo exato se perdeu; o fim do anterior (ou a própria hora) é a melhor aproximação.
UPDATE "MoodAnalysis" m SET "startedAt" = LEAST(m."analyzedAt", COALESCE((
    SELECT p."analyzedAt" FROM "MoodAnalysis" p
    WHERE p."userId" = m."userId" AND p."analyzedAt" < m."analyzedAt"
    ORDER BY p."analyzedAt" DESC LIMIT 1
), m."analyzedAt"));
CREATE INDEX "MoodAnalysis_userId_startedAt_idx" ON "MoodAnalysis"("userId", "startedAt");

CREATE TABLE "PlaylistReaction" (
    "id" TEXT NOT NULL,
    "mofyPlaylistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlaylistReaction_mofyPlaylistId_userId_key" ON "PlaylistReaction"("mofyPlaylistId", "userId");
ALTER TABLE "PlaylistReaction" ADD CONSTRAINT "PlaylistReaction_mofyPlaylistId_fkey" FOREIGN KEY ("mofyPlaylistId") REFERENCES "MofyPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistReaction" ADD CONSTRAINT "PlaylistReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlaylistComment" (
    "id" TEXT NOT NULL,
    "mofyPlaylistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlaylistComment_mofyPlaylistId_createdAt_idx" ON "PlaylistComment"("mofyPlaylistId", "createdAt");
ALTER TABLE "PlaylistComment" ADD CONSTRAINT "PlaylistComment_mofyPlaylistId_fkey" FOREIGN KEY ("mofyPlaylistId") REFERENCES "MofyPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistComment" ADD CONSTRAINT "PlaylistComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
