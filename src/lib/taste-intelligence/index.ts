/**
 * Taste Intelligence Engine
 *
 * Phase 1: Proprietary Taste Graph (TG-01 through TG-10)
 * Phase 2: Property Embeddings (PE-01 through PE-08)
 *
 * Transforms Terrazzo from an LLM wrapper into a proprietary recommendation
 * engine with compounding data network effects.
 */

// Vector computation (v2.1 — 136-dim, FNV-1a hash)
export {
  computeUserTasteVector,
  computeUserVectorFromProfile,
  computePropertyEmbedding,
  cosineSimilarity,
  similarityToScore,
  vectorToSql,
  sqlToVector,
  setIdfWeights,
  clearIdfWeights,
  hashSignalToBucket,
  VECTOR_DIM,
  SIGNAL_DIMS,
  DOMAIN_DIMS,
  DOMAIN_WEIGHT,
  SIGNAL_WEIGHT,
  DOMAIN_INDEX,
} from './vectors';
export type { UserVectorInput, PropertyEmbeddingInput } from './vectors';

// Vector computation (v3 — 104-dim, semantic clusters)
export {
  computeUserTasteVectorV3,
  computePropertyEmbeddingV3,
  cosineSimilarityV3,
  vectorToSqlV3,
  setIdfWeightsV3,
  clearIdfWeightsV3,
  lookupSignalCluster,
  getSignalClusterLabel,
  getAllClusterLabels,
  VECTOR_DIM_V3,
  blendPropertyAnchors,
  USER_SIGNAL_WEIGHT,
  ANTI_SIGNAL_SCALE,
  analyzeDomainCoverage,
  computeEffectiveActivation,
  getClusterIndicesForDomain,
  ALL_DOMAINS,
  ACTIVATION_THRESHOLD,
} from './vectors-v3';
export type {
  UserVectorInputV3,
  PropertyEmbeddingInputV3,
  PropertyAnchorForBlending,
  DomainCoverage,
  CoverageAnalysis,
} from './vectors-v3';

// Database queries (v2.1)
export {
  findSimilarProperties,
  findTasteNeighbors,
  findSimilarPropertiesToProperty,
  findPropertiesByDomain,
  findPropertiesByDomainWeights,
  findContradictionCoOccurrences,
  findContradictionNeighbors,
} from './queries';
export type { VectorMatch, UserNeighbor, ContradictionCoOccurrence } from './queries';

// Database queries (v3)
export {
  findSimilarPropertiesV3,
  findTasteNeighborsV3,
  findSimilarPropertiesToPropertyV3,
  findPropertiesByDomainV3,
  findPropertiesByDomainWeightsV3,
  findDomainExemplars,
} from './queries-v3';

// Backfill pipeline (v2.1)
export {
  backfillUser,
  backfillAllUsers,
  backfillPropertyEmbedding,
  backfillAllPropertyEmbeddings,
  runFullBackfill,
} from './backfill';

// Backfill pipeline (v3)
export {
  backfillUserV3,
  backfillAllUsersV3,
  backfillPropertyEmbeddingV3,
  backfillAllPropertyEmbeddingsV3,
  runFullBackfillV3,
} from './backfill-v3';

// Evaluation harness (PE-10)
export {
  evaluateUser,
  evaluateAll,
} from './evaluation';
export type { EvaluationResult } from './evaluation';
