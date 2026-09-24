-- CreateTable
CREATE TABLE "PlaylistSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaylistSuggestion_userId_suggestedAt_idx" ON "PlaylistSuggestion"("userId", "suggestedAt");

-- AddForeignKey
ALTER TABLE "PlaylistSuggestion" ADD CONSTRAINT "PlaylistSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
