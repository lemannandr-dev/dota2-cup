-- CreateTable
CREATE TABLE "RefereeNomination" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefereeNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefereeBallotVote" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "nominationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefereeBallotVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefereeNomination_tournamentId_teamId_key" ON "RefereeNomination"("tournamentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RefereeNomination_tournamentId_nomineeId_key" ON "RefereeNomination"("tournamentId", "nomineeId");

-- CreateIndex
CREATE INDEX "RefereeNomination_nomineeId_idx" ON "RefereeNomination"("nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "RefereeBallotVote_tournamentId_teamId_key" ON "RefereeBallotVote"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "RefereeBallotVote_nominationId_idx" ON "RefereeBallotVote"("nominationId");

-- AddForeignKey
ALTER TABLE "RefereeNomination" ADD CONSTRAINT "RefereeNomination_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeNomination" ADD CONSTRAINT "RefereeNomination_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeNomination" ADD CONSTRAINT "RefereeNomination_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeNomination" ADD CONSTRAINT "RefereeNomination_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeBallotVote" ADD CONSTRAINT "RefereeBallotVote_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "RefereeNomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeBallotVote" ADD CONSTRAINT "RefereeBallotVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
