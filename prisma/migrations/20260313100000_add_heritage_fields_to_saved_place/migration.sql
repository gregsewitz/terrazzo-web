-- AlterTable: Add heritage-related fields to SavedPlace
-- These are promoted from PlaceIntelligence.facts during enrichment-complete webhook

ALTER TABLE "SavedPlace" ADD COLUMN IF NOT EXISTS "heritageHighlight" TEXT;
ALTER TABLE "SavedPlace" ADD COLUMN IF NOT EXISTS "yearEstablished" TEXT;
