-- Créditos fracionados: playlists acima de 45 min custam 0,30 / 0,50 / 0,75 crédito.
ALTER TABLE "User" ALTER COLUMN "image_credits" TYPE DECIMAL(10,2);
ALTER TABLE "User" ALTER COLUMN "image_credits" SET DEFAULT 1;
ALTER TABLE "CreditLog" ALTER COLUMN "amount" TYPE DECIMAL(10,2);
