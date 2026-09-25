-- CreateTable
CREATE TABLE "MofyPlaylist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotifyPlaylistId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tracksHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "MofyPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MofyPlaylist_userId_createdAt_idx" ON "MofyPlaylist"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MofyPlaylist_userId_tracksHash_idx" ON "MofyPlaylist"("userId", "tracksHash");

-- AddForeignKey
ALTER TABLE "MofyPlaylist" ADD CONSTRAINT "MofyPlaylist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
