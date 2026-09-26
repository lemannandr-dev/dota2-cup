CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamInvite_teamId_status_idx" ON "TeamInvite"("teamId", "status");
CREATE INDEX "TeamInvite_toUserId_status_idx" ON "TeamInvite"("toUserId", "status");
CREATE INDEX "TeamInvite_fromUserId_idx" ON "TeamInvite"("fromUserId");