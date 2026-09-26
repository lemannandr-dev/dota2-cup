CREATE TABLE "SiteAppearance" (
    "id" TEXT NOT NULL,
    "appLogoUrl" TEXT NOT NULL,
    "dotaLogoUrl" TEXT NOT NULL,
    "mobileBackdropUrl" TEXT NOT NULL,
    "homeCoverUrl" TEXT NOT NULL DEFAULT '/brand/dota2-heroes.webp',
    "motionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "backdropOpacity" INTEGER NOT NULL DEFAULT 24,
    "backdropPositionY" INTEGER NOT NULL DEFAULT 42,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAppearance_pkey" PRIMARY KEY ("id")
);
