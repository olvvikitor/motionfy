-- CreateTable
CREATE TABLE "TracksAnalysis" (
    "id" TEXT NOT NULL,
    "spotifyid" TEXT NOT NULL,
    "moodScore" DOUBLE PRECISION NOT NULL,
    "dominantSentiment" TEXT NOT NULL,
    "coreAxes" JSONB NOT NULL,
    "emotionalVector" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TracksAnalysis_id_key" ON "TracksAnalysis"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TracksAnalysis_spotifyid_key" ON "TracksAnalysis"("spotifyid");
