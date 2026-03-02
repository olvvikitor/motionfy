/*
  Warnings:

  - You are about to drop the column `spotifyAccessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyRefreshToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "spotifyAccessToken",
DROP COLUMN "spotifyExpiresAt",
DROP COLUMN "spotifyRefreshToken",
ADD COLUMN     "AccessToken" TEXT,
ADD COLUMN     "RefreshToken" TEXT;
