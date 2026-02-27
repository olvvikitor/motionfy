-- DropForeignKey
ALTER TABLE "MoodAnalysis" DROP CONSTRAINT "MoodAnalysis_userId_fkey";

-- AddForeignKey
ALTER TABLE "MoodAnalysis" ADD CONSTRAINT "MoodAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
