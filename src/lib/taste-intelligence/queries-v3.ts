/**
 * Taste Intelligence — Vector Similarity Queries (v3: Semantic Clusters)
 *
 * Mirrors queries.ts but uses v3 columns:
 *   - "embeddingV3" vector(104) instead of "embedding" vector(136)
 *   - "tasteVectorV3" vector(104) instead of "tasteVector" vector(136)
 *
 * Same query patterns, same pgvector <=> operator, different columns.
 */

import { prisma } from '@/lib/prisma';
import { vectorToSqlV3, VECTOR_DIM_V3 } from './vectors-v3';
import type { VectorMatch, UserNeighbor } from './queries';

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
    .map((r) => ({
      id: r.id,
      googlePlaceId: r.googlePlaceId,
      propertyName: r.propertyName,
      similarity: 1 - r.distance,
      score: Math.round((1 - r.distance) * 100),
    }))
    .filter((r) => r.score >= minScore);
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

  return results.map((r) => ({
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

  return results.map((r) => ({
    id: r.id,
    googlePlaceId: r.googlePlaceId,
    propertyName: r.propertyName,
    similarity: 1 - r.distance,
    score: Math.round((1 - r.distance) * 100),
  }));
}

// ─── PE-09: Domain Slice Queries (v3) ──────────────────────────────────────

export async function findPropertiesByDomainV3(
  domain: string,
  limit: number = 10,
): Promise<VectorMatch[]> {
  const DOMAIN_INDICES: Record<string, number> = {
    Design: 0, Atmosphere: 1, Character: 2, Service: 3,
    FoodDrink: 4, Setting: 5, Wellness: 6, Sustainability: 7,
  };
  const idx = DOMAIN_INDICES[domain];
  if (idx === undefined) return [];

  const probe = new Array(VECTOR_DIM_V3).fill(0);
  probe[idx] = 1.0;

  return findSimilarPropertiesV3(probe, limit);
}

export async function findPropertiesByDomainWeightsV3(
  weights: Partial<Record<string, number>>,
  limit: number = 10,
): Promise<VectorMatch[]> {
  const DOMAIN_INDICES: Record<string, number> = {
    Design: 0, Atmosphere: 1, Character: 2, Service: 3,
    FoodDrink: 4, Setting: 5, Wellness: 6, Sustainability: 7,
  };

  const probe = new Array(VECTOR_DIM_V3).fill(0);
  let magnitude = 0;

  for (const [domain, weight] of Object.entries(weights)) {
    const idx = DOMAIN_INDICES[domain];
    if (idx !== undefined && weight) {
      probe[idx] = weight;
      magnitude += weight * weight;
    }
  }

  if (magnitude > 0) {
    const norm = Math.sqrt(magnitude);
    for (let i = 0; i < probe.length; i++) {
      probe[i] /= norm;
    }
  } else {
    return [];
  }

  return findSimilarPropertiesV3(probe, limit);
}
