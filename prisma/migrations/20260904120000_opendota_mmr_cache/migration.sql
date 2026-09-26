-- Last OpenDota MMR we actually received (solo / party / estimate). Never invent a number.
ALTER TABLE "User" ADD COLUMN "openDotaMmr" INTEGER;
ALTER TABLE "User" ADD COLUMN "openDotaMmrSource" TEXT;
