ALTER TABLE "TeamInvite" ADD COLUMN "tournamentId" TEXT;

CREATE TABLE "TeamJoinLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamJoinLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeamJoinLink_tokenHash_key" ON "TeamJoinLink"("tokenHash");
CREATE INDEX "TeamJoinLink_teamId_fromUserId_idx" ON "TeamJoinLink"("teamId", "fromUserId");

UPDATE "TeamInvite" AS invite
SET "tournamentId" = note."metadata"->>'tournamentId'
FROM "Notification" AS note
WHERE note."type" = 'TEAM_INVITE'
  AND note."metadata"->>'inviteId' = invite."id";
