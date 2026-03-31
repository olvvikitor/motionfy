-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificateEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificatePush" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificateWeek" BOOLEAN NOT NULL DEFAULT false;
