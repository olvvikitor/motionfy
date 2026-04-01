-- CreateEnum
CREATE TYPE "CreditLogType" AS ENUM ('PURCHASE', 'CONSUME', 'BONUS', 'REFUND');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "image_credits" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "CreditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditLogType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CreditLog" ADD CONSTRAINT "CreditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
