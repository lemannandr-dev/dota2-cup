ALTER TABLE "Match" ADD COLUMN "scrim" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "scrimBoard" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TeamChallenge" ADD COLUMN "matchId" TEXT;
CREATE UNIQUE INDEX "TeamChallenge_matchId_key" ON "TeamChallenge"("matchId");
ALTER TABLE "TeamChallenge" ADD CONSTRAINT "TeamChallenge_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
