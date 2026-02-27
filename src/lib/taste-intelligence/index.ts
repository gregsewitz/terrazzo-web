/**
 * Taste Intelligence Engine
 *
 * Phase 1: Proprietary Taste Graph (TG-01 through TG-10)
 * Phase 2: Property Embeddings (PE-01 through PE-08)
 *
 * Transforms Terrazzo from an LLM wrapper into a proprietary recommendation
 * engine with compounding data network effects.
 */

// Vector computation
export {
  computeUserTasteVector,
  computeUserVectorFromProfile,
  computePropertyEmbedding,
  cosineSimilarity,
  similarityToScore,
  vectorToSql,
  sqlToVector,
  VECTOR_DIM,
  DOMAIN_INDEX,
} from './vectors';
export type { UserVectorInput, PropertyEmbeddingInput } from './vectors';

// Database queries
export {
  findSimilarProperties,
  findTasteNeighbors,
  findSimilarPropertiesToProperty,
  findPropertiesByDomain,
} from './queries';
export type { VectorMatch, UserNeighbor } from './queries';

// Backfill pipeline
export {
  backfillUser,
  backfillAllUsers,
  backfillPropertyEmbedding,
  backfillAllPropertyEmbeddings,
  runFullBackfill,
} from './backfill';
