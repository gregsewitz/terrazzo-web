-- Soft delete for SavedPlace (library places)
-- Adds a deletedAt timestamp for 30-day recovery window.
-- null = active, non-null = soft-deleted.

ALTER TABLE "SavedPlace" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Index for efficient queries: exclude deleted from listings, find recently deleted
CREATE INDEX "SavedPlace_deletedAt_idx" ON "SavedPlace"("deletedAt");

-- Import provenance log: append-only array tracking every import source
-- Default to empty JSON array for existing rows
ALTER TABLE "SavedPlace" ADD COLUMN "importSources" JSONB NOT NULL DEFAULT '[]';
