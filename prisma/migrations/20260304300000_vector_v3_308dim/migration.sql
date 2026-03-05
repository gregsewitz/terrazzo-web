-- Upgrade v3 vector columns from 104-dim (96 clusters) to 308-dim (300 clusters)
-- This drops existing v3 vectors (they need to be recomputed anyway with new cluster assignments)

-- Drop existing HNSW indexes
DROP INDEX IF EXISTS "PlaceIntelligence_embeddingV3_hnsw_idx";
DROP INDEX IF EXISTS "User_tasteVectorV3_hnsw_idx";

-- Drop old columns
ALTER TABLE "PlaceIntelligence" DROP COLUMN IF EXISTS "embeddingV3";
ALTER TABLE "User" DROP COLUMN IF EXISTS "tasteVectorV3";

-- Re-add with new dimension
ALTER TABLE "PlaceIntelligence" ADD COLUMN "embeddingV3" vector(308);
ALTER TABLE "User" ADD COLUMN "tasteVectorV3" vector(308);

-- Recreate HNSW indexes
CREATE INDEX "PlaceIntelligence_embeddingV3_hnsw_idx"
  ON "PlaceIntelligence" USING hnsw ("embeddingV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "User_tasteVectorV3_hnsw_idx"
  ON "User" USING hnsw ("tasteVectorV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
