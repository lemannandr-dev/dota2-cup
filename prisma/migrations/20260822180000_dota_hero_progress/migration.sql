CREATE TABLE "DotaHeroProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heroId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "xpToNext" INTEGER,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DotaHeroProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DotaHeroProgress_userId_heroId_key" ON "DotaHeroProgress"("userId", "heroId");
CREATE INDEX "DotaHeroProgress_userId_capturedAt_idx" ON "DotaHeroProgress"("userId", "capturedAt");

ALTER TABLE "DotaHeroProgress" ADD CONSTRAINT "DotaHeroProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
