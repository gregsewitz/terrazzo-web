-- AlterTable: Add placeType to PlaceIntelligence
-- Stores the canonical place category derived from Google Places primaryType
-- Values: hotel | restaurant | bar | cafe | museum | shop | neighborhood | activity
ALTER TABLE "PlaceIntelligence" ADD COLUMN "placeType" TEXT;

-- Index for filtering/querying by place type
CREATE INDEX "PlaceIntelligence_placeType_idx" ON "PlaceIntelligence"("placeType");
