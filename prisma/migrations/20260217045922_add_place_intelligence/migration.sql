-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "tasteProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NylasGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NylasGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "days" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "googlePlaceId" TEXT,
    "location" TEXT,
    "googleData" TEXT,
    "source" TEXT NOT NULL,
    "matchScore" INTEGER,
    "matchBreakdown" TEXT,
    "tasteNote" TEXT,
    "enrichment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "placedIn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "placeIntelligenceId" TEXT,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceCache" (
    "id" TEXT NOT NULL,
    "googlePlaceId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceIntelligence" (
    "id" TEXT NOT NULL,
    "googlePlaceId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pipelineVersion" TEXT NOT NULL DEFAULT 'v3-ri',
    "signals" TEXT NOT NULL DEFAULT '[]',
    "antiSignals" TEXT,
    "reliability" TEXT,
    "facts" TEXT,
    "reviewIntel" TEXT,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "antiSignalCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "reliabilityScore" DOUBLE PRECISION,
    "sourcesProcessed" TEXT,
    "lastEnrichedAt" TIMESTAMP(3),
    "enrichmentTTL" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "placeIntelligenceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "triggerSource" TEXT NOT NULL,
    "triggeredByUserId" TEXT,
    "currentStage" TEXT,
    "stagesCompleted" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NylasGrant_grantId_key" ON "NylasGrant"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceCache_googlePlaceId_key" ON "PlaceCache"("googlePlaceId");

-- CreateIndex
CREATE INDEX "PlaceCache_googlePlaceId_idx" ON "PlaceCache"("googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceIntelligence_googlePlaceId_key" ON "PlaceIntelligence"("googlePlaceId");

-- CreateIndex
CREATE INDEX "PlaceIntelligence_googlePlaceId_idx" ON "PlaceIntelligence"("googlePlaceId");

-- CreateIndex
CREATE INDEX "PlaceIntelligence_status_idx" ON "PlaceIntelligence"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_placeIntelligenceId_idx" ON "PipelineRun"("placeIntelligenceId");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- AddForeignKey
ALTER TABLE "NylasGrant" ADD CONSTRAINT "NylasGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_placeIntelligenceId_fkey" FOREIGN KEY ("placeIntelligenceId") REFERENCES "PlaceIntelligence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_placeIntelligenceId_fkey" FOREIGN KEY ("placeIntelligenceId") REFERENCES "PlaceIntelligence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
