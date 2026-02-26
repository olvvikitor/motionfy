/*
  Warnings:

  - A unique constraint covering the columns `[userId,trackId,playedAt]` on the table `ListeningHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListeningHistory_userId_trackId_playedAt_key" ON "ListeningHistory"("userId", "trackId", "playedAt");
