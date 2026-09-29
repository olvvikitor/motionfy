-- CreateTable
CREATE TABLE "CoverGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mofyPlaylistId" TEXT NOT NULL,
    "title" TEXT,
    "sentiment" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverGeneration_createdAt_idx" ON "CoverGeneration"("createdAt");

-- AddForeignKey
ALTER TABLE "CoverGeneration" ADD CONSTRAINT "CoverGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
