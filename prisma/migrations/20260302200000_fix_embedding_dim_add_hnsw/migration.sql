-- PE-13: Ensure PlaceIntelligence.embedding exists, then resize to vector(34)
-- to match User.tasteVector dimension. Existing embeddings are nulled and must be re-backfilled.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlaceIntelligence' AND column_name='embedding') THEN
    ALTER TABLE "PlaceIntelligence" ADD COLUMN "embedding" vector(34);
  ELSE
    ALTER TABLE "PlaceIntelligence" ALTER COLUMN "embedding" TYPE vector(34) USING NULL;
  END IF;
END $$;

-- Also ensure PlaceIntelligence.embeddingUpdatedAt exists
ALTER TABLE "PlaceIntelligence" ADD COLUMN IF NOT EXISTS "embeddingUpdatedAt" TIMESTAMP(3);

-- TG-11: HNSW index on User.tasteVector for fast nearest-neighbor queries
CREATE INDEX IF NOT EXISTS idx_user_taste_vector_hnsw
  ON "User" USING hnsw ("tasteVector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- PE-03/PE-12: HNSW index on PlaceIntelligence.embedding
CREATE INDEX IF NOT EXISTS idx_place_intelligence_embedding_hnsw
  ON "PlaceIntelligence" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
