/**
 * Taste Intelligence Engine — V3 (400-dim semantic clusters)
 *
 * The sole scoring/ranking mechanism for property matching in the v4 architecture.
 * V3 vectors use 400 semantic signal clusters with L2-normalized embeddings and
 * pgvector HNSW indices for approximate nearest-neighbor queries.
 *
 * v2.1 (136-dim FNV-1a hash) has been fully removed.
 */

// Vector computation (v3 — 400-dim, semantic clusters)
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

// Database queries (v3)
export {
  findSimilarPropertiesV3,
  findTasteNeighborsV3,
  findSimilarPropertiesToPropertyV3,
  findPropertiesByDomainV3,
  findPropertiesByDomainWeightsV3,
  findDomainExemplars,
} from './queries-v3';

// Backfill pipeline (v3)
export {
  backfillUserV3,
  backfillAllUsersV3,
  backfillPropertyEmbeddingV3,
  backfillAllPropertyEmbeddingsV3,
  backfillPropertyEmbeddingsBatchV3,
  computeAndSetIdfWeightsV3,
  runFullBackfillV3,
} from './backfill-v3';

