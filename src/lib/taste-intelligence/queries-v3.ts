/**
 * Taste Intelligence — Vector Similarity Queries (v3.4: Signal-Only)
 *
 * Mirrors queries.ts but uses v3 columns:
 *   - "embeddingV3" vector(400) — signal-only, no domain dims
 *   - "tasteVectorV3" vector(400) — signal-only, no domain dims
 *
 * Same query patterns, same pgvector <=> operator, different columns.
 */

import { prisma } from '@/lib/prisma';
import { vectorToSqlV3, VECTOR_DIM_V3 } from './vectors-v3';

// Types previously imported from ./queries (v2, now removed)
export interface VectorMatch {
  id: string;
  googlePlaceId: string;
  propertyName: string;
  similarity: number;
  score: number;
}

export interface UserNeighbor {
  id: string;
  name: string | null;
  similarity: number;
}

// ─── PE-04: User-to-Property Matching (v3) ─────────────────────────────────

export async function findSimilarPropertiesV3(
  userTasteVector: number[],
  limit: number = 50,
  minScore: number = 0,
): Promise<VectorMatch[]> {
  const vecSql = vectorToSqlV3(userTasteVector);

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
       ("embeddingV3" <=> $1::vector) as distance
     FROM "PlaceIntelligence"
     WHERE "status" = 'complete'
       AND "embeddingV3" IS NOT NULL
       AND "signalCount" > 0
     ORDER BY "embeddingV3" <=> $1::vector
     LIMIT $2`,
    vecSql,
    limit,
  );

  return results
    .map((r: any) => ({
      id: r.id,
      googlePlaceId: r.googlePlaceId,
      propertyName: r.propertyName,
      similarity: 1 - r.distance,
      score: Math.round((1 - r.distance) * 100),
    }))
    .filter((r: any) => r.score >= minScore);
}

// ─── TG-05: User Nearest Neighbors (v3) ────────────────────────────────────

export async function findTasteNeighborsV3(
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
       (u1."tasteVectorV3" <=> u2."tasteVectorV3") as distance
     FROM "User" u1
     CROSS JOIN "User" u2
     WHERE u1."id" = $1
       AND u2."id" != $1
       AND u1."tasteVectorV3" IS NOT NULL
       AND u2."tasteVectorV3" IS NOT NULL
     ORDER BY u1."tasteVectorV3" <=> u2."tasteVectorV3"
     LIMIT $2`,
    userId,
    limit,
  );

  return results.map((r: any) => ({
    id: r.id,
    name: r.name,
    similarity: 1 - r.distance,
  }));
}

// ─── PE-05: Property-to-Property Similarity (v3) ───────────────────────────

export async function findSimilarPropertiesToPropertyV3(
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
       (p1."embeddingV3" <=> p2."embeddingV3") as distance
     FROM "PlaceIntelligence" p1
     CROSS JOIN "PlaceIntelligence" p2
     WHERE p1."googlePlaceId" = $1
       AND p2."googlePlaceId" != $1
       AND p1."embeddingV3" IS NOT NULL
       AND p2."embeddingV3" IS NOT NULL
       AND p2."status" = 'complete'
     ORDER BY p1."embeddingV3" <=> p2."embeddingV3"
     LIMIT $2`,
    googlePlaceId,
    limit,
  );

  return results.map((r: any) => ({
    id: r.id,
    googlePlaceId: r.googlePlaceId,
    propertyName: r.propertyName,
    similarity: 1 - r.distance,
    score: Math.round((1 - r.distance) * 100),
  }));
}

// ─── PE-09: Domain Slice Queries (v3.4) ─────────────────────────────────────
// With signal-only vectors, domain queries activate all clusters belonging to a domain.
// Cluster-to-domain mapping comes from signal-clusters.json.

import clusterMap from './signal-clusters.json';

const clusterInfoForDomain: Record<string, { domain?: string }> =
  (clusterMap as any).clusters ?? {};

/** Build a set of cluster indices belonging to a given domain */
function clusterIndicesForDomain(domain: string): number[] {
  const indices: number[] = [];
  for (const [cidStr, info] of Object.entries(clusterInfoForDomain)) {
    if (info.domain === domain) {
      indices.push(parseInt(cidStr, 10));
    }
  }
  return indices;
}

export async function findPropertiesByDomainV3(
  domain: string,
  limit: number = 10,
): Promise<VectorMatch[]> {
  const indices = clusterIndicesForDomain(domain);
  if (indices.length === 0) return [];

  // Create probe vector with uniform activation on all clusters in this domain
  const probe = new Array(VECTOR_DIM_V3).fill(0);
  const value = 1.0 / Math.sqrt(indices.length); // L2-normalized uniform
  for (const idx of indices) {
    probe[idx] = value;
  }

  return findSimilarPropertiesV3(probe, limit);
}

/**
 * Find properties that are strong exemplars of a specific domain.
 * Used for gap-fill reaction cards — shows properties that maximally
 * activate clusters in the target domain, with enough variety to
 * cover different sub-tastes.
 *
 * Excludes properties the user has already anchored (via their googlePlaceIds).
 */
export async function findDomainExemplars(
  domain: string,
  limit: number = 3,
  excludeGooglePlaceIds: string[] = [],
): Promise<Array<VectorMatch & { placeType: string | null; locationHint: string | null }>> {
  const indices = clusterIndicesForDomain(domain);
  if (indices.length === 0) return [];

  // Create probe vector strongly biased toward this domain
  const probe = new Array(VECTOR_DIM_V3).fill(0);
  const value = 1.0 / Math.sqrt(indices.length);
  for (const idx of indices) {
    probe[idx] = value;
  }
  const vecSql = vectorToSqlV3(probe);

  // Fetch more than needed so we can exclude and diversify
  const fetchLimit = limit * 4;

  const excludeClause = excludeGooglePlaceIds.length > 0
    ? `AND "googlePlaceId" NOT IN (${excludeGooglePlaceIds.map((_, i) => `$${i + 2}`).join(',')})`
    : '';

  const params: (string | number)[] = [vecSql, fetchLimit];
  if (excludeGooglePlaceIds.length > 0) {
    // Re-order: vecSql first, then excludes, then limit at end
    params.length = 0;
    params.push(vecSql, ...excludeGooglePlaceIds, fetchLimit);
  }

  const results = await prisma.$queryRawUnsafe<Array<{
    id: string;
    googlePlaceId: string;
    propertyName: string;
    placeType: string | null;
    locationHint: string | null;
    distance: number;
  }>>(
    `SELECT
       "id",
       "googlePlaceId",
       "propertyName",
       "placeType",
       "facts"->'location'->>'address' as "locationHint",
       ("embeddingV3" <=> $1::vector) as distance
     FROM "PlaceIntelligence"
     WHERE "status" = 'complete'
       AND "embeddingV3" IS NOT NULL
       AND "signalCount" > 0
       ${excludeClause}
     ORDER BY "embeddingV3" <=> $1::vector
     LIMIT $${excludeGooglePlaceIds.length + 2}`,
    ...params,
  );

  // Return top N with score
  return results.slice(0, limit).map((r: any) => {
    const similarity = Math.round((1 - r.distance) * 100) / 100;
    return {
      id: r.id,
      googlePlaceId: r.googlePlaceId,
      propertyName: r.propertyName,
      similarity,
      score: Math.round(similarity * 100),
      placeType: r.placeType,
      locationHint: r.locationHint,
    };
  });
}

