/*
  Warnings:

  - You are about to drop the column `AccessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `RefreshToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email,provider]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_spotifyId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "AccessToken",
DROP COLUMN "RefreshToken",
DROP COLUMN "spotifyId",
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "refreshToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_provider_key" ON "User"("email", "provider");
