-- Rename provenanceNarrative to heritageNarrative (origin story / heritage concept)
ALTER TABLE "PlaceIntelligence" RENAME COLUMN "provenanceNarrative" TO "heritageNarrative";

-- Add heritageData JSON field for richer heritage extraction
ALTER TABLE "PlaceIntelligence" ADD COLUMN "heritageData" JSONB;

-- Add competitiveContext JSON field for neighborhood positioning
ALTER TABLE "PlaceIntelligence" ADD COLUMN "competitiveContext" JSONB;
