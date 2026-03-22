-- Vector v2.1: Upgrade from 34-dim to 136-dim vectors
-- 8 domain dims + 128 signal hash dims (was 26)
-- Includes independent normalization and IDF weighting (code-side changes)

-- Step 1: Drop existing HNSW indexes (they're dimension-specific)
DROP INDEX IF EXISTS "PlaceIntelligence_embedding_hnsw_idx";
DROP INDEX IF EXISTS "User_tasteVector_hnsw_idx";

-- Step 2: Resize vector columns (NULL out existing data since vectors must be recomputed)
ALTER TABLE "PlaceIntelligence"
  ALTER COLUMN "embedding" TYPE vector(136) USING NULL;

ALTER TABLE "User"
  ALTER COLUMN "tasteVector" TYPE vector(136) USING NULL;

-- Step 3: Recreate HNSW indexes for the new dimension
-- HNSW with cosine distance for fast approximate nearest neighbor
CREATE INDEX "PlaceIntelligence_embedding_hnsw_idx"
  ON "PlaceIntelligence" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "User_tasteVector_hnsw_idx"
  ON "User" USING hnsw ("tasteVector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
