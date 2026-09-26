-- CreateTable
CREATE TABLE "DotaSyncRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DotaSyncRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DotaClientSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "steamPath" TEXT,
    "dotaPath" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DotaClientSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DotaSyncRequest_tokenHash_key" ON "DotaSyncRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "DotaSyncRequest_userId_expiresAt_idx" ON "DotaSyncRequest"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "DotaClientSnapshot_userId_createdAt_idx" ON "DotaClientSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DotaSyncRequest" ADD CONSTRAINT "DotaSyncRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DotaClientSnapshot" ADD CONSTRAINT "DotaClientSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
