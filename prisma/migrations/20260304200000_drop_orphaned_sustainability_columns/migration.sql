-- DropOrphanedSustainabilityColumns
-- These top-level columns were never populated; sustainability data lives
-- inside the tasteProfile JSON blob (as sustainabilityProfile) and in the
-- SustainabilitySignal table.

ALTER TABLE "User" DROP COLUMN IF EXISTS "sustainabilitySensitivity";
ALTER TABLE "User" DROP COLUMN IF EXISTS "sustainabilityPriorities";
ALTER TABLE "User" DROP COLUMN IF EXISTS "sustainabilityDealbreakers";
ALTER TABLE "User" DROP COLUMN IF EXISTS "sustainabilityWillingnessToPayPremium";
ALTER TABLE "User" DROP COLUMN IF EXISTS "profileVersion";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastProfileSynthesizedAt";
