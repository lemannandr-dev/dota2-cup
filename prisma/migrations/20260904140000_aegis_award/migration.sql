-- Which Aegis the champion receives after a closed final. ember = existing cups.
ALTER TABLE "Tournament" ADD COLUMN "aegisAward" TEXT NOT NULL DEFAULT 'ember';
ALTER TABLE "Tournament" ADD COLUMN "inviteOnly" BOOLEAN NOT NULL DEFAULT false;
