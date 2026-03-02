-- PE-13: Fix PlaceIntelligence.embedding dimension from vector(32) to vector(34)
-- to match User.tasteVector dimension. Existing embeddings are nulled and must be re-backfilled.
ALTER TABLE "PlaceIntelligence"
  ALTER COLUMN "embedding" TYPE vector(34) USING NULL;

-- TG-11: HNSW index on User.tasteVector for fast nearest-neighbor queries
CREATE INDEX IF NOT EXISTS idx_user_taste_vector_hnsw
  ON "User" USING hnsw ("tasteVector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- PE-03/PE-12: HNSW index on PlaceIntelligence.embedding
CREATE INDEX IF NOT EXISTS idx_place_intelligence_embedding_hnsw
  ON "PlaceIntelligence" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
