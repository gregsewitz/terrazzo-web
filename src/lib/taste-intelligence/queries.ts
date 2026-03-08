/**
 * @deprecated v2.1 queries replaced by queries-v3.ts in v4 architecture.
 * This file is preserved for reference only. Use queries-v3.ts for all new code.
 *
 * Taste Intelligence — Vector Similarity Queries
 *
 * Database queries using pgvector for:
 * - PE-04: User-to-property matching (find best properties for a user)
 * - TG-05: User-to-user nearest neighbors (taste neighbors)
 * - PE-05: Property-to-property similarity (similar places)
 *
 * All queries use cosine distance via pgvector's <=> operator with HNSW index.
 */

import { prisma } from '@/lib/prisma';
import { vectorToSql, VECTOR_DIM } from './vectors';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VectorMatch {
  id: string;
  googlePlaceId: string;
  propertyName: string;
  similarity: number;  // 0-1 (cosine similarity, higher = more similar)
  score: number;       // 0-100 match score
}

export interface UserNeighbor {
  id: string;
  name: string | null;
  similarity: number;
}

// ─── PE-04: User-to-Property Matching ───────────────────────────────────────

/**
 * Find the top-K properties most similar to a user's taste vector.
 *
 * Uses pgvector's HNSW index for fast approximate nearest-neighbor search.
 * Only returns properties with status='complete' and a computed embedding.
 */
export async function findSimilarProperties(
  userTasteVector: number[],
  limit: number = 50,
  minScore: number = 0,
): Promise<VectorMatch[]> {
  const vecSql = vectorToSql(userTasteVector);

  // pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
  // Convert to similarity: 1 - distance
  const results = await prisma.$queryRawUnsafe<Array<{
    id: string;
    googlePlaceId: string;
    propertyName: string;
    distance: number;
  }>>(
    `SELECT
       "id",
       "googlePlaceId",
       "propertyName",
       ("embedding" <=> $1::vector) as distance
     FROM "PlaceIntelligence"
     WHERE "status" = 'complete'
       AND "embedding" IS NOT NULL
       AND "signalCount" > 0
     ORDER BY "embedding" <=> $1::vector
     LIMIT $2`,
    vecSql,
    limit,
  );

  return results
    .map((r) => ({
      id: r.id,
      googlePlaceId: r.googlePlaceId,
      propertyName: r.propertyName,
      similarity: 1 - r.distance,
      score: Math.round((1 - r.distance) * 100),
    }))
    .filter((r) => r.score >= minScore);
}

// ─── TG-05: User Nearest Neighbors ─────────────────────────────────────────

/**
 * Find the N most taste-similar users to a given user.
 * Replaces LLM-fabricated tasteNeighbors with real computed neighbors.
 */
export async function findTasteNeighbors(
  userId: string,
  limit: number = 10,
): Promise<UserNeighbor[]> {
  const results = await prisma.$queryRawUnsafe<Array<{
    id: string;
    name: string | null;
    distance: number;
  }>>(
    `SELECT
       u2."id",
       u2."name",
       (u1."tasteVector" <=> u2."tasteVector") as distance
     FROM "User" u1
     CROSS JOIN "User" u2
     WHERE u1."id" = $1
       AND u2."id" != $1
       AND u1."tasteVector" IS NOT NULL
       AND u2."tasteVector" IS NOT NULL
     ORDER BY u1."tasteVector" <=> u2."tasteVector"
     LIMIT $2`,
    userId,
    limit,
  );

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    similarity: 1 - r.distance,
  }));
}

// ─── PE-05: Property-to-Property Similarity ─────────────────────────────────

/**
 * Find properties similar to a given property.
 * Powers "If you liked X, you'll love Y" patterns.
 */
export async function findSimilarPropertiesToProperty(
  googlePlaceId: string,
  limit: number = 10,
): Promise<VectorMatch[]> {
  const results = await prisma.$queryRawUnsafe<Array<{
    id: string;
    googlePlaceId: string;
    propertyName: string;
    distance: number;
  }>>(
    `SELECT
       p2."id",
       p2."googlePlaceId",
       p2."propertyName",
       (p1."embedding" <=> p2."embedding") as distance
     FROM "PlaceIntelligence" p1
     CROSS JOIN "PlaceIntelligence" p2
     WHERE p1."googlePlaceId" = $1
       AND p2."googlePlaceId" != $1
       AND p1."embedding" IS NOT NULL
       AND p2."embedding" IS NOT NULL
       AND p2."status" = 'complete'
     ORDER BY p1."embedding" <=> p2."embedding"
     LIMIT $2`,
    googlePlaceId,
    limit,
  );

  return results.map((r) => ({
    id: r.id,
    googlePlaceId: r.googlePlaceId,
    propertyName: r.propertyName,
    similarity: 1 - r.distance,
    score: Math.round((1 - r.distance) * 100),
  }));
}

// ─── PE-09: Taste-Dimension Slice Queries ───────────────────────────────────

/**
 * Find properties that score high on a specific taste domain.
 * Used for signal thread cards in the discover feed.
 *
 * Works by constructing a "probe" vector that's strong on the target domain
 * and finding the nearest properties.
 */
export async function findPropertiesByDomain(
  domain: string,
  limit: number = 10,
): Promise<VectorMatch[]> {
  // Build a probe vector that emphasizes the target domain (34 dimensions)
  const DOMAIN_INDICES: Record<string, number> = {
    Design: 0, Atmosphere: 1, Character: 2, Service: 3,
    FoodDrink: 4, Setting: 5, Wellness: 6, Sustainability: 7,
  };
  const idx = DOMAIN_INDICES[domain];
  if (idx === undefined) return [];

  const probe = new Array(VECTOR_DIM).fill(0);
  probe[idx] = 1.0;
  // L2 normalize (already unit vector since only one dimension is set)

  return findSimilarProperties(probe, limit);
}

// ─── PE-09 Extension: Multi-Domain Slice ─────────────────────────────────────

/**
 * Find properties matching a weighted combination of taste domains.
 * Useful for "mood-based" discovery (e.g., "design-forward + great food").
 */
export async function findPropertiesByDomainWeights(
  weights: Partial<Record<string, number>>,
  limit: number = 10,
): Promise<VectorMatch[]> {
  const DOMAIN_INDICES: Record<string, number> = {
    Design: 0, Atmosphere: 1, Character: 2, Service: 3,
    FoodDrink: 4, Setting: 5, Wellness: 6, Sustainability: 7,
  };

  const probe = new Array(VECTOR_DIM).fill(0);
  let magnitude = 0;

  for (const [domain, weight] of Object.entries(weights)) {
    const idx = DOMAIN_INDICES[domain];
    if (idx !== undefined && weight) {
      probe[idx] = weight;
      magnitude += weight * weight;
    }
  }

  // L2 normalize the probe vector
  if (magnitude > 0) {
    const norm = Math.sqrt(magnitude);
    for (let i = 0; i < probe.length; i++) {
      probe[i] /= norm;
    }
  } else {
    return [];
  }

  return findSimilarProperties(probe, limit);
}

// ─── TG-06: Contradiction Co-Occurrence Analysis ─────────────────────────────

export interface ContradictionCoOccurrence {
  stated: string;
  revealed: string;
  domain: string;
  userCount: number;
  userIds: string[];
}

/**
 * Find contradiction patterns shared across multiple users.
 *
 * Identifies users who share the same stated/revealed tension, surfacing
 * non-obvious commonalities that content-based matching can't detect.
 * These patterns are inputs to future collaborative filtering (Phase 3).
 */
export async function findContradictionCoOccurrences(
  minUsers: number = 2,
  limit: number = 20,
): Promise<ContradictionCoOccurrence[]> {
  // Query ContradictionNode table for patterns shared across users
  const results = await prisma.$queryRawUnsafe<Array<{
    stated: string;
    revealed: string;
    domain: string;
    user_count: number;
    user_ids: string[];
  }>>(
    `SELECT
       "stated",
       "revealed",
       "domain",
       COUNT(DISTINCT "userId") as user_count,
       ARRAY_AGG(DISTINCT "userId") as user_ids
     FROM "ContradictionNode"
     GROUP BY "stated", "revealed", "domain"
     HAVING COUNT(DISTINCT "userId") >= $1
     ORDER BY COUNT(DISTINCT "userId") DESC
     LIMIT $2`,
    minUsers,
    limit,
  );

  return results.map((r) => ({
    stated: r.stated,
    revealed: r.revealed,
    domain: r.domain,
    userCount: Number(r.user_count),
    userIds: r.user_ids,
  }));
}

/**
 * Find users who share contradictions with a specific user.
 * Returns users with matching stated/revealed tensions — these are
 * "contradiction neighbors" who may respond similarly to novel properties.
 */
export async function findContradictionNeighbors(
  userId: string,
  limit: number = 10,
): Promise<{ userId: string; sharedContradictions: number; similarity: number }[]> {
  const results = await prisma.$queryRawUnsafe<Array<{
    other_user_id: string;
    shared_count: number;
    total_contradictions: number;
  }>>(
    `WITH user_contradictions AS (
       SELECT "stated", "revealed", "domain"
       FROM "ContradictionNode"
       WHERE "userId" = $1
     )
     SELECT
       cn."userId" as other_user_id,
       COUNT(*) as shared_count,
       (SELECT COUNT(*) FROM "ContradictionNode" WHERE "userId" = cn."userId") as total_contradictions
     FROM "ContradictionNode" cn
     JOIN user_contradictions uc
       ON cn."stated" = uc."stated"
       AND cn."revealed" = uc."revealed"
       AND cn."domain" = uc."domain"
     WHERE cn."userId" != $1
     GROUP BY cn."userId"
     ORDER BY COUNT(*) DESC
     LIMIT $2`,
    userId,
    limit,
  );

  return results.map((r) => ({
    userId: r.other_user_id,
    sharedContradictions: Number(r.shared_count),
    similarity: Number(r.total_contradictions) > 0
      ? Number(r.shared_count) / Number(r.total_contradictions)
      : 0,
  }));
}
