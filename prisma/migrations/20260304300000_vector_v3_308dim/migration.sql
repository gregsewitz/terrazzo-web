-- Upgrade v3 vector columns to 408-dim (400 clusters + 8 domains, with neighbor bleed)
-- Applied in two stages: first 104→308 (v3.1), then 308→408 (v3.2)
-- This drops existing v3 vectors (they need to be recomputed with new cluster assignments)

-- Drop existing HNSW indexes
DROP INDEX IF EXISTS "PlaceIntelligence_embeddingV3_hnsw_idx";
DROP INDEX IF EXISTS "User_tasteVectorV3_hnsw_idx";

-- Drop old columns
ALTER TABLE "PlaceIntelligence" DROP COLUMN IF EXISTS "embeddingV3";
ALTER TABLE "User" DROP COLUMN IF EXISTS "tasteVectorV3";

-- Re-add with new dimension
ALTER TABLE "PlaceIntelligence" ADD COLUMN "embeddingV3" vector(408);
ALTER TABLE "User" ADD COLUMN "tasteVectorV3" vector(408);

-- Recreate HNSW indexes
CREATE INDEX "PlaceIntelligence_embeddingV3_hnsw_idx"
  ON "PlaceIntelligence" USING hnsw ("embeddingV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "User_tasteVectorV3_hnsw_idx"
  ON "User" USING hnsw ("tasteVectorV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
