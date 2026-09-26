-- CreateTable
CREATE TABLE "DotaGuild" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "avatarUrl" TEXT,
    "points" INTEGER,
    "leaderboardRank" INTEGER,
    "level" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DotaGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DotaGuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT,
    "points" INTEGER,
    "userId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DotaGuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DotaGuildSnapshot" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "points" INTEGER,
    "leaderboardRank" INTEGER,
    "level" INTEGER,
    "payload" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DotaGuildSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DotaGuild_guildId_key" ON "DotaGuild"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DotaGuildMember_userId_key" ON "DotaGuildMember"("userId");

-- CreateIndex
CREATE INDEX "DotaGuildMember_steamId_idx" ON "DotaGuildMember"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "DotaGuildMember_guildId_steamId_key" ON "DotaGuildMember"("guildId", "steamId");

-- CreateIndex
CREATE INDEX "DotaGuildSnapshot_guildId_capturedAt_idx" ON "DotaGuildSnapshot"("guildId", "capturedAt");

-- AddForeignKey
ALTER TABLE "DotaGuildMember" ADD CONSTRAINT "DotaGuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DotaGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DotaGuildMember" ADD CONSTRAINT "DotaGuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DotaGuildSnapshot" ADD CONSTRAINT "DotaGuildSnapshot_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DotaGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
