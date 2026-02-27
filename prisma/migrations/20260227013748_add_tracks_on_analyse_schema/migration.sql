/*
  Warnings:

  - Added the required column `tracksAnalyzeds` to the `MoodAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MoodAnalysis" ADD COLUMN     "tracksAnalyzeds" JSONB NOT NULL;
