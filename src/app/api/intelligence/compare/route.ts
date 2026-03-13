/**
 * POST /api/intelligence/compare
 *
 * Pairwise comparative positioning between two places within a destination.
 * Returns vector-based domain comparison, differentiators, and a brief narrative.
 *
 * Body: { placeA: googlePlaceId, placeB: googlePlaceId, userId: string }
 *
 * Used by the frontend ComparativeCard when a user taps "Compare" on two places
 * in the same destination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  cosineSimilarityV3,
  getClusterIndicesForDomain,
  getAllClusterLabels,
  ALL_DOMAINS,
} from '@/lib/taste-intelligence';
import { computeVectorMatch } from '@/lib/taste-match-vectors';
import type { TasteDomain } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ComparisonResult {
  similarity: number; // 0-100 how similar the two places are
  domainComparison: Record<TasteDomain, { placeA: number; placeB: number; delta: number }>;
  differentiators: {
    placeAStronger: Array<{ domain: TasteDomain; cluster: string; delta: number }>;
    placeBStronger: Array<{ domain: TasteDomain; cluster: string; delta: number }>;
  };
  userFit: {
    placeA: number | null; // match score for user
    placeB: number | null;
  };
}

// ─── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { placeA, placeB, userId } = await req.json();

    if (!placeA || !placeB) {
      return NextResponse.json({ error: 'Both placeA and placeB googlePlaceIds are required' }, { status: 400 });
    }

    // Fetch both property vectors
    const [intelA, intelB] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ id: string; vec: string }>>(
        `SELECT id, "embeddingV3"::text as vec FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1 AND "embeddingV3" IS NOT NULL`,
        placeA,
      ),
      prisma.$queryRawUnsafe<Array<{ id: string; vec: string }>>(
        `SELECT id, "embeddingV3"::text as vec FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1 AND "embeddingV3" IS NOT NULL`,
        placeB,
      ),
    ]);

    if (intelA.length === 0 || intelB.length === 0) {
      return NextResponse.json(
        { error: 'One or both places do not have computed embeddings' },
        { status: 404 },
      );
    }

    // Parse vectors from pgvector text format: "[0.1,0.2,...]"
    const vecA = parseVector(intelA[0].vec);
    const vecB = parseVector(intelB[0].vec);

    if (!vecA || !vecB) {
      return NextResponse.json({ error: 'Failed to parse embeddings' }, { status: 500 });
    }

    // Place-to-place cosine similarity
    const rawCosine = cosineSimilarityV3(vecA, vecB);
    const similarity = Math.round(Math.max(0, Math.min(100, (rawCosine + 1) * 50)));

    // Per-domain comparison
    const allClusterInfo = getAllClusterLabels();
    // Build a lookup: index → label string
    const clusterLabelMap = new Map<number, string>();
    for (const info of allClusterInfo) {
      clusterLabelMap.set(info.id, info.label);
    }
    const domainComparison: Record<string, { placeA: number; placeB: number; delta: number }> = {};
    const diffA: Array<{ domain: TasteDomain; cluster: string; delta: number }> = [];
    const diffB: Array<{ domain: TasteDomain; cluster: string; delta: number }> = [];

    for (const domain of ALL_DOMAINS) {
      const indices = getClusterIndicesForDomain(domain);
      let sumA = 0, sumB = 0;

      for (const idx of indices) {
        sumA += vecA[idx] || 0;
        sumB += vecB[idx] || 0;

        // Track per-cluster differentiators
        const delta = (vecA[idx] || 0) - (vecB[idx] || 0);
        if (Math.abs(delta) > 0.05) {
          const label = clusterLabelMap.get(idx) || `cluster-${idx}`;
          if (delta > 0) {
            diffA.push({ domain: domain as TasteDomain, cluster: label, delta: Math.round(delta * 100) });
          } else {
            diffB.push({ domain: domain as TasteDomain, cluster: label, delta: Math.round(Math.abs(delta) * 100) });
          }
        }
      }

      const normA = Math.round(Math.max(0, Math.min(100, sumA * 100)));
      const normB = Math.round(Math.max(0, Math.min(100, sumB * 100)));
      domainComparison[domain] = { placeA: normA, placeB: normB, delta: normA - normB };
    }

    // Sort differentiators by magnitude
    diffA.sort((a, b) => b.delta - a.delta);
    diffB.sort((a, b) => b.delta - a.delta);

    // Optionally compute user fit if userId provided
    let userFit: { placeA: number | null; placeB: number | null } = { placeA: null, placeB: null };
    if (userId) {
      const userVecRow = await prisma.$queryRawUnsafe<Array<{ vec: string }>>(
        `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1 AND "tasteVectorV3" IS NOT NULL`,
        userId,
      );

      if (userVecRow.length > 0) {
        const userVec = parseVector(userVecRow[0].vec);
        if (userVec) {
          const matchA = computeVectorMatch(userVec, vecA);
          const matchB = computeVectorMatch(userVec, vecB);
          userFit = {
            placeA: matchA.overallScore,
            placeB: matchB.overallScore,
          };
        }
      }
    }

    const result: ComparisonResult = {
      similarity,
      domainComparison: domainComparison as Record<TasteDomain, { placeA: number; placeB: number; delta: number }>,
      differentiators: {
        placeAStronger: diffA.slice(0, 5),
        placeBStronger: diffB.slice(0, 5),
      },
      userFit,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[compare] Error:', error);
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseVector(raw: string): number[] | null {
  try {
    // pgvector format: "[0.1,0.2,0.3,...]"
    const cleaned = raw.replace(/^\[/, '').replace(/\]$/, '');
    const nums = cleaned.split(',').map(s => parseFloat(s.trim()));
    if (nums.some(isNaN)) return null;
    return nums;
  } catch {
    return null;
  }
}
