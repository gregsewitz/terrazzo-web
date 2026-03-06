// ─── Collaborative Filtering: Aggregation & Hybrid Blending ─────────────────
//
// STATUS: Blueprint only. Do not call these functions in production yet.
// ACTIVATE WHEN: ~500-1000 active users with booking/save history.
//
// ARCHITECTURE:
//   1. Aggregate interaction_events into a sparse user×property matrix
//   2. Apply matrix factorization (ALS) to get user + property embeddings
//   3. Blend collaborative scores with content-based scores (taste vector cosine)
//   4. Cluster user embeddings to discover taste archetypes
//
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import type { UserPropertyScore, UserEmbedding, TasteArchetype } from '@/types/interactions';

// ─── Constants ───

const TIME_DECAY_HALF_LIFE_DAYS = 90;   // Events lose half their weight after 90 days
const MIN_INTERACTIONS_PER_USER = 5;     // Users need ≥5 interactions to be in the matrix
const MIN_INTERACTIONS_PER_PROPERTY = 3; // Properties need ≥3 users to be collaborative
const EMBEDDING_DIMENSIONS = 64;         // Latent factor count for matrix factorization
const CONTENT_BLEND_ALPHA = 0.8;         // Start heavily content-based, drift toward 0.5

// ─── Step 1: Build the Interaction Matrix ───

/**
 * Aggregate raw events into time-decayed (user, property) scores.
 *
 * For each (user_id, google_place_id) pair:
 *   raw_score = Σ( signal_weight × exp(-age_days / half_life) )
 *   normalized  = tanh(raw_score)   →  range [-1, 1]
 *
 * This produces the sparse matrix that feeds into matrix factorization.
 */
export async function buildInteractionMatrix(): Promise<UserPropertyScore[]> {
  const rows = await prisma.$queryRawUnsafe<UserPropertyScore[]>(`
    WITH decayed AS (
      SELECT
        user_id                                                    AS "userId",
        google_place_id                                            AS "googlePlaceId",
        SUM(
          signal_weight * EXP(
            -EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0
            / ${TIME_DECAY_HALF_LIFE_DAYS}
          )
        )                                                          AS "rawScore",
        COUNT(*)                                                   AS "eventCount",
        MAX(created_at)                                            AS "lastInteraction"
      FROM interaction_events
      GROUP BY user_id, google_place_id
    )
    SELECT
      "userId",
      "googlePlaceId",
      "rawScore",
      -- tanh normalization to [-1, 1]
      (EXP(2 * "rawScore") - 1) / (EXP(2 * "rawScore") + 1)     AS "normalizedScore",
      "eventCount"::int,
      "lastInteraction"
    FROM decayed
    WHERE "eventCount" >= 2  -- Require at least 2 interactions for signal stability
    ORDER BY "userId", "normalizedScore" DESC
  `);

  return rows;
}

// ─── Step 2: Matrix Factorization (Placeholder) ───

/**
 * Run Alternating Least Squares (ALS) on the interaction matrix to produce
 * low-dimensional embeddings for users and properties.
 *
 * IMPLEMENTATION NOTE: This should run as a periodic batch job (daily or weekly),
 * not on every request. The output embeddings are cached and served from a table.
 *
 * Options for implementation:
 *   a) Supabase Edge Function with a lightweight ALS in TypeScript
 *   b) External Python job using implicit (https://github.com/benfred/implicit)
 *   c) Supabase pg_ml extension for in-database matrix factorization
 *
 * For ~1000 users × ~5000 properties, option (a) is feasible.
 * For larger scale, option (b) or (c) is recommended.
 */
export async function runMatrixFactorization(): Promise<{
  userEmbeddings: Map<string, number[]>;
  propertyEmbeddings: Map<string, number[]>;
}> {
  // TODO: Implement when we have enough data
  // The algorithm:
  //   1. Load interaction matrix from buildInteractionMatrix()
  //   2. Initialize random user and property factor matrices (n_users × k, n_items × k)
  //   3. Alternately fix one and solve for the other (least squares)
  //   4. Repeat for 10-20 iterations until convergence
  //   5. Store embeddings in user_embeddings / property_embeddings tables

  throw new Error('Not yet implemented — need ~500+ active users');
}

// ─── Step 3: Hybrid Score Blending ───

/**
 * Compute the final recommendation score by blending content-based
 * (taste vector cosine similarity) with collaborative filtering scores.
 *
 *   final = α × content_similarity + (1 - α) × collaborative_score
 *
 * α starts at 0.8 (mostly content-based) and should decrease as
 * interaction data grows. At ~5000 active users, α ≈ 0.5.
 *
 * The content_similarity comes from the existing 400-dim taste vector
 * cosine distance (already implemented in vectors-v3.ts).
 *
 * The collaborative_score is dot(userEmbedding, propertyEmbedding).
 */
export function blendScores(
  contentSimilarity: number,     // range [0, 1] from taste vector cosine
  collaborativeScore: number,    // range [-1, 1] from embedding dot product
  alpha: number = CONTENT_BLEND_ALPHA,
): number {
  // Normalize collaborative score to [0, 1] for blending
  const collabNormalized = (collaborativeScore + 1) / 2;
  return alpha * contentSimilarity + (1 - alpha) * collabNormalized;
}

// ─── Step 4: Archetype Discovery ───

/**
 * Cluster user embeddings to discover natural taste archetypes.
 *
 * Algorithm: k-means or HDBSCAN on the user embedding vectors.
 * k-means is simpler and sufficient when k is chosen via elbow method.
 * HDBSCAN is better for discovering non-spherical clusters and outliers.
 *
 * Each archetype is characterized by:
 *   - A centroid (center of the cluster)
 *   - Top properties (most loved by members)
 *   - Dominant taste signals (from content-based vectors of members)
 *   - A human-readable name (manually assigned after inspection)
 *
 * Expected archetypes (hypothesized, not yet validated):
 *   - "Design Pilgrim": travels for architecture and interiors
 *   - "Quiet Luxury": Aman/Amangiri aesthetic, subtraction over addition
 *   - "Grand Dame": heritage properties, Ritz/Peninsula energy
 *   - "Soulful Explorer": local immersion, Ett Hem/Blackberry Farm warmth
 *   - "Scene Seeker": social energy, pool scene, nightlife adjacency
 *   - "Nature Escapist": remote, landscape-driven, anti-urban
 *   - "Family Orchestrator": logistics-first, kid-friendly, reliable
 *   - "Culinary Traveler": food/drink is the organizing principle
 */
export async function discoverArchetypes(
  userEmbeddings: Map<string, number[]>,
  k: number = 8,
): Promise<TasteArchetype[]> {
  // TODO: Implement when embeddings are available
  // Steps:
  //   1. Extract embedding vectors into a matrix
  //   2. Run k-means with k (or HDBSCAN for automatic k)
  //   3. For each cluster:
  //      a. Compute centroid
  //      b. Find top-rated properties among cluster members
  //      c. Extract dominant taste signals from members' taste vectors
  //      d. Assign a provisional name based on dominant signals
  //   4. Store in taste_archetypes table
  //   5. Update each user's archetypeId

  throw new Error('Not yet implemented — need embeddings from Step 2');
}

// ─── Readiness Check ───

/**
 * Check if we have enough interaction data to activate collaborative filtering.
 * Returns metrics about the current state of the interaction matrix.
 */
export async function checkCollaborativeReadiness(): Promise<{
  totalEvents: number;
  uniqueUsers: number;
  uniqueProperties: number;
  qualifiedUsers: number;      // Users with ≥ MIN_INTERACTIONS_PER_USER
  qualifiedProperties: number; // Properties with ≥ MIN_INTERACTIONS_PER_PROPERTY
  matrixDensity: number;       // Fraction of (user, property) pairs with data
  ready: boolean;              // Whether to activate collaborative filtering
}> {
  const stats = await prisma.$queryRawUnsafe<[{
    totalEvents: number;
    uniqueUsers: number;
    uniqueProperties: number;
    qualifiedUsers: number;
    qualifiedProperties: number;
  }]>(`
    WITH user_counts AS (
      SELECT user_id, COUNT(*) AS cnt
      FROM interaction_events
      GROUP BY user_id
    ),
    property_counts AS (
      SELECT google_place_id, COUNT(DISTINCT user_id) AS cnt
      FROM interaction_events
      GROUP BY google_place_id
    )
    SELECT
      (SELECT COUNT(*) FROM interaction_events)::int AS "totalEvents",
      (SELECT COUNT(*) FROM user_counts)::int AS "uniqueUsers",
      (SELECT COUNT(*) FROM property_counts)::int AS "uniqueProperties",
      (SELECT COUNT(*) FROM user_counts WHERE cnt >= ${MIN_INTERACTIONS_PER_USER})::int AS "qualifiedUsers",
      (SELECT COUNT(*) FROM property_counts WHERE cnt >= ${MIN_INTERACTIONS_PER_PROPERTY})::int AS "qualifiedProperties"
  `);

  const s = stats[0];
  const matrixDensity = s.uniqueUsers > 0 && s.uniqueProperties > 0
    ? s.totalEvents / (s.uniqueUsers * s.uniqueProperties)
    : 0;

  return {
    ...s,
    matrixDensity,
    ready: s.qualifiedUsers >= 500 && s.qualifiedProperties >= 100,
  };
}
