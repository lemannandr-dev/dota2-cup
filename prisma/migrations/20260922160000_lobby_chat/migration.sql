CREATE TABLE "LobbyMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LobbyMessage_userId_createdAt_idx" ON "LobbyMessage"("userId", "createdAt");

CREATE INDEX "LobbyMessage_createdAt_idx" ON "LobbyMessage"("createdAt");

ALTER TABLE "LobbyMessage" ADD CONSTRAINT "LobbyMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
