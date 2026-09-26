-- Optional cup on an LFG post: player is looking for a five for this tournament.
ALTER TABLE "LfgPost" ADD COLUMN "tournamentId" TEXT;
CREATE INDEX "LfgPost_tournamentId_idx" ON "LfgPost"("tournamentId");
ALTER TABLE "LfgPost" ADD CONSTRAINT "LfgPost_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
