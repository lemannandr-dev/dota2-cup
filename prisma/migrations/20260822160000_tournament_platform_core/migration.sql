-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ORGANIZER';

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'ADMIN', 'REFEREE');
CREATE TYPE "PrizeAllocationStatus" AS ENUM ('PENDING', 'RESERVED', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "nextLoserMatchId" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "nextLoserSlot" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "reportDeadlineAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BonusRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bonusCodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BonusRedemption_userId_bonusCodeId_key" ON "BonusRedemption"("userId", "bonusCodeId");
CREATE INDEX "BonusRedemption_bonusCodeId_idx" ON "BonusRedemption"("bonusCodeId");

ALTER TABLE "BonusRedemption" ADD CONSTRAINT "BonusRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BonusRedemption" ADD CONSTRAINT "BonusRedemption_bonusCodeId_fkey" FOREIGN KEY ("bonusCodeId") REFERENCES "BonusCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TournamentStaff" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentStaff_tournamentId_userId_key" ON "TournamentStaff"("tournamentId", "userId");
CREATE INDEX "TournamentStaff_userId_idx" ON "TournamentStaff"("userId");

ALTER TABLE "TournamentStaff" ADD CONSTRAINT "TournamentStaff_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentStaff" ADD CONSTRAINT "TournamentStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchReport" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,
    "dotaMatchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchReport_matchId_teamId_key" ON "MatchReport"("matchId", "teamId");
CREATE INDEX "MatchReport_reporterId_idx" ON "MatchReport"("reporterId");

ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrizeAllocation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "teamId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PrizeAllocationStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrizeAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrizeAllocation_tournamentId_place_key" ON "PrizeAllocation"("tournamentId", "place");
CREATE INDEX "PrizeAllocation_tournamentId_status_idx" ON "PrizeAllocation"("tournamentId", "status");

ALTER TABLE "PrizeAllocation" ADD CONSTRAINT "PrizeAllocation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LfgPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" INTEGER[],
    "mmrMin" INTEGER,
    "mmrMax" INTEGER,
    "windowFrom" TIMESTAMP(3),
    "windowTo" TIMESTAMP(3),
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LfgPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LfgPost_userId_expiresAt_idx" ON "LfgPost"("userId", "expiresAt");
CREATE INDEX "LfgPost_expiresAt_idx" ON "LfgPost"("expiresAt");

ALTER TABLE "LfgPost" ADD CONSTRAINT "LfgPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
