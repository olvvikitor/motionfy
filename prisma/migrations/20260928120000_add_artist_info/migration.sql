-- CreateTable
CREATE TABLE "ArtistInfo" (
    "name" TEXT NOT NULL,
    "country" TEXT,
    "source" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistInfo_pkey" PRIMARY KEY ("name")
);
