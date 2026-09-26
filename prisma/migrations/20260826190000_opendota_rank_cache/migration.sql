-- Last OpenDota medal we actually received. Live API can time out; we do not invent a rank.
ALTER TABLE "User" ADD COLUMN "openDotaRankTier" INTEGER;
ALTER TABLE "User" ADD COLUMN "openDotaLeaderboard" INTEGER;
ALTER TABLE "User" ADD COLUMN "openDotaRankAt" TIMESTAMP(3);
