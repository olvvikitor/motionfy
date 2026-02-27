/*
  Warnings:

  - You are about to drop the column `trackId` on the `MoodAnalysis` table. All the data in the column will be lost.
  - You are about to drop the `Lyrics` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `MoodAnalysis` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `MoodAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Lyrics" DROP CONSTRAINT "Lyrics_trackId_fkey";

-- DropForeignKey
ALTER TABLE "MoodAnalysis" DROP CONSTRAINT "MoodAnalysis_trackId_fkey";

-- DropIndex
DROP INDEX "MoodAnalysis_trackId_key";

-- AlterTable
ALTER TABLE "MoodAnalysis" DROP COLUMN "trackId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Lyrics";

-- CreateIndex
CREATE UNIQUE INDEX "MoodAnalysis_userId_key" ON "MoodAnalysis"("userId");

-- AddForeignKey
ALTER TABLE "MoodAnalysis" ADD CONSTRAINT "MoodAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
