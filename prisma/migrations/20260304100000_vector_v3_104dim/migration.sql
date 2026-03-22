-- Vector v3: Add 104-dimensional columns for semantic cluster-based embeddings
-- These coexist with v2.1's 136-dim columns for parallel comparison

-- Property embeddings (v3)
ALTER TABLE "PlaceIntelligence" ADD COLUMN "embeddingV3" vector(104);

-- User taste vectors (v3)
ALTER TABLE "User" ADD COLUMN "tasteVectorV3" vector(104);

-- HNSW indexes for fast approximate nearest-neighbor search
CREATE INDEX "PlaceIntelligence_embeddingV3_hnsw_idx"
  ON "PlaceIntelligence" USING hnsw ("embeddingV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "User_tasteVectorV3_hnsw_idx"
  ON "User" USING hnsw ("tasteVectorV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
