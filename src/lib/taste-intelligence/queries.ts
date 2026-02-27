/**
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
import { vectorToSql } from './vectors';

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
  // Build a probe vector that emphasizes the target domain
  const DOMAIN_INDICES: Record<string, number> = {
    Design: 0, Character: 1, Service: 2, Food: 3, Location: 4, Wellness: 5,
  };
  const idx = DOMAIN_INDICES[domain];
  if (idx === undefined) return [];

  const probe = new Array(32).fill(0);
  probe[idx] = 1.0;
  // L2 normalize (already unit vector since only one dimension is set)

  return findSimilarProperties(probe, limit);
}
