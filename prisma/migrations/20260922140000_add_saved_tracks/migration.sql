-- CreateTable
CREATE TABLE "SavedTrack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedTrack_userId_trackId_key" ON "SavedTrack"("userId", "trackId");

-- AddForeignKey
ALTER TABLE "SavedTrack" ADD CONSTRAINT "SavedTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrack" ADD CONSTRAINT "SavedTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("spotifyId") ON DELETE RESTRICT ON UPDATE CASCADE;

