-- V2 enrichment columns: sustainability, trajectory, and pipeline enrichment fields
-- These columns were applied directly to the DB and this migration records them
-- for Prisma migrate history consistency.

-- ══════════════════════════════════════════════
-- User: sustainability & trajectory columns
-- ══════════════════════════════════════════════

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sustainabilitySensitivity" TEXT DEFAULT 'PASSIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sustainabilityPriorities" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sustainabilityDealbreakers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sustainabilityWillingnessToPayPremium" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileVersion" INTEGER DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastProfileSynthesizedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tasteTrajectoryDirection" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tasteTrajectoryDescription" TEXT;

-- ══════════════════════════════════════════════
-- PlaceIntelligence: v2 enrichment columns
-- ══════════════════════════════════════════════

ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "rhythmProfile" JSONB;
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "sustainabilityScore" DOUBLE PRECISION;
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "sustainabilityFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "culturalEngagementOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "provenanceNarrative" TEXT;
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "seasonalityData" JSONB;
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "sensoryCues" JSONB;
