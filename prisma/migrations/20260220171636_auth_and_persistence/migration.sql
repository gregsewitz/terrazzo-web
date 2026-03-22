/*
  Warnings:

  - The `stagesCompleted` column on the `PipelineRun` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `googleData` column on the `Place` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `matchBreakdown` column on the `Place` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `enrichment` column on the `Place` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `placedIn` column on the `Place` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `signals` column on the `PlaceIntelligence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `antiSignals` column on the `PlaceIntelligence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `reliability` column on the `PlaceIntelligence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `facts` column on the `PlaceIntelligence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `reviewIntel` column on the `PlaceIntelligence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sourcesProcessed` column on the `PlaceIntelligence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tasteProfile` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[supabaseId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `source` on the `Place` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `data` on the `PlaceCache` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `days` on the `Trip` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `supabaseId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PipelineRun" DROP COLUMN "stagesCompleted",
ADD COLUMN     "stagesCompleted" JSONB;

-- AlterTable
ALTER TABLE "Place" DROP COLUMN "googleData",
ADD COLUMN     "googleData" JSONB,
DROP COLUMN "source",
ADD COLUMN     "source" JSONB NOT NULL,
DROP COLUMN "matchBreakdown",
ADD COLUMN     "matchBreakdown" JSONB,
DROP COLUMN "enrichment",
ADD COLUMN     "enrichment" JSONB,
DROP COLUMN "placedIn",
ADD COLUMN     "placedIn" JSONB;

-- AlterTable
ALTER TABLE "PlaceCache" DROP COLUMN "data",
ADD COLUMN     "data" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "PlaceIntelligence" DROP COLUMN "signals",
ADD COLUMN     "signals" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "antiSignals",
ADD COLUMN     "antiSignals" JSONB,
DROP COLUMN "reliability",
ADD COLUMN     "reliability" JSONB,
DROP COLUMN "facts",
ADD COLUMN     "facts" JSONB,
DROP COLUMN "reviewIntel",
ADD COLUMN     "reviewIntel" JSONB,
DROP COLUMN "sourcesProcessed",
ADD COLUMN     "sourcesProcessed" JSONB;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "conversationHistory" JSONB,
ADD COLUMN     "destinations" JSONB,
ADD COLUMN     "groupSize" INTEGER,
ADD COLUMN     "groupType" TEXT,
ADD COLUMN     "pool" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'planning',
ADD COLUMN     "vibe" TEXT,
DROP COLUMN "days",
ADD COLUMN     "days" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allContradictions" JSONB,
ADD COLUMN     "allSignals" JSONB,
ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "isOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lifeContext" JSONB,
ADD COLUMN     "onboardingDepth" TEXT,
ADD COLUMN     "seedTrips" JSONB,
ADD COLUMN     "supabaseId" TEXT NOT NULL,
ADD COLUMN     "trustedSources" JSONB,
DROP COLUMN "tasteProfile",
ADD COLUMN     "tasteProfile" JSONB;

-- CreateTable
CREATE TABLE "SavedPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googlePlaceId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "source" JSONB,
    "ghostSource" TEXT,
    "friendAttribution" JSONB,
    "userContext" TEXT,
    "timing" TEXT,
    "travelWith" TEXT,
    "intentStatus" TEXT,
    "savedDate" TEXT,
    "importBatchId" TEXT,
    "rating" JSONB,
    "isShortlisted" BOOLEAN NOT NULL DEFAULT false,
    "enrichment" JSONB,
    "whatToOrder" JSONB,
    "tips" JSONB,
    "alsoKnownAs" TEXT,
    "matchScore" INTEGER,
    "matchBreakdown" JSONB,
    "tasteNote" TEXT,
    "terrazzoInsight" JSONB,
    "googleData" JSONB,
    "placeIntelligenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT 'sparkle',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSmartCollection" BOOLEAN NOT NULL DEFAULT false,
    "query" TEXT,
    "filterTags" JSONB,
    "placeIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPlace_userId_idx" ON "SavedPlace"("userId");

-- CreateIndex
CREATE INDEX "SavedPlace_googlePlaceId_idx" ON "SavedPlace"("googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPlace_userId_googlePlaceId_key" ON "SavedPlace"("userId", "googlePlaceId");

-- CreateIndex
CREATE INDEX "Shortlist_userId_idx" ON "Shortlist"("userId");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE INDEX "User_supabaseId_idx" ON "User"("supabaseId");

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_placeIntelligenceId_fkey" FOREIGN KEY ("placeIntelligenceId") REFERENCES "PlaceIntelligence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
