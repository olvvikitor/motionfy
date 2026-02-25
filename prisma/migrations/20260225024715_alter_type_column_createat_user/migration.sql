/*
  Warnings:

  - Changed the type of `spotifyExpiresAt` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "spotifyExpiresAt",
ADD COLUMN     "spotifyExpiresAt" TIMESTAMP(3) NOT NULL;
