-- CreateTable
CREATE TABLE "MoodReaction" (
    "id" TEXT NOT NULL,
    "moodAnalysisId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodComment" (
    "id" TEXT NOT NULL,
    "moodAnalysisId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoodReaction_moodAnalysisId_userId_key" ON "MoodReaction"("moodAnalysisId", "userId");

-- AddForeignKey
ALTER TABLE "MoodReaction" ADD CONSTRAINT "MoodReaction_moodAnalysisId_fkey" FOREIGN KEY ("moodAnalysisId") REFERENCES "MoodAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodReaction" ADD CONSTRAINT "MoodReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodComment" ADD CONSTRAINT "MoodComment_moodAnalysisId_fkey" FOREIGN KEY ("moodAnalysisId") REFERENCES "MoodAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodComment" ADD CONSTRAINT "MoodComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
