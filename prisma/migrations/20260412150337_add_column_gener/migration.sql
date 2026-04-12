/*
  Warnings:

  - Added the required column `genre` to the `TracksAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subgenre` to the `TracksAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TracksAnalysis" ADD COLUMN     "genre" TEXT NOT NULL,
ADD COLUMN     "subgenre" TEXT NOT NULL;
