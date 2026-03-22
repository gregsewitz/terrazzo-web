-- Pipeline v2 domain metadata columns for PlaceIntelligence
-- New domain-specific metadata that didn't exist before

-- Design domain
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "designProfile" JSONB;

-- Service domain
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "serviceProfile" JSONB;

-- FoodDrink domain
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "culinaryProfile" JSONB;

-- Wellness domain
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "wellnessPhilosophy" JSONB;
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "wellnessFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Sustainability certifications
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- SavedPlace promoted summary fields
ALTER TABLE "SavedPlace" ADD COLUMN IF NOT EXISTS "formalityLevel" TEXT;
ALTER TABLE "SavedPlace" ADD COLUMN IF NOT EXISTS "cuisineStyle" TEXT;
