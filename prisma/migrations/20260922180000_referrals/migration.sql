ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralMilestone" (
    "id" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "amountKopecks" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralMilestone_threshold_key" ON "ReferralMilestone"("threshold");

CREATE TABLE "ReferralPayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralPayout_transactionId_key" ON "ReferralPayout"("transactionId");
CREATE UNIQUE INDEX "ReferralPayout_userId_milestoneId_key" ON "ReferralPayout"("userId", "milestoneId");
CREATE INDEX "ReferralPayout_milestoneId_idx" ON "ReferralPayout"("milestoneId");

ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ReferralMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ReferralMilestone" ("id", "threshold", "amountKopecks", "label", "isActive", "createdAt", "updatedAt")
VALUES ('seed_referral_100', 100, 10000, '100 приглашённых', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
