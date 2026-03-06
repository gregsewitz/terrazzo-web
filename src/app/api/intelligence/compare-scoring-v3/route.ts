/**
 * 3-Way Comparison: Signal-Based vs Vector v2.1 vs Vector v3
 *
 * Runs all three scoring approaches against enriched places for a user,
 * then outputs rank correlations, top-N overlap, and divergence analysis.
 *
 * GET /api/intelligence/compare-scoring-v3?userId=...
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match-v3';
import { findSimilarProperties } from '@/lib/taste-intelligence/queries';
import { findSimilarPropertiesV3 } from '@/lib/taste-intelligence/queries-v3';
import { sqlToVector } from '@/lib/taste-intelligence/vectors';
import type { TasteProfile, TasteDomain, BriefingSignal, BriefingAntiSignal } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';

export const maxDuration = 60;

interface PlaceScores {
  googlePlaceId: string;
  propertyName: string;
  signalScore: number;
  vectorV21Score: number;
  vectorV3Score: number;
  signalRank: number;
  vectorV21Rank: number;
  vectorV3Rank: number;
  signalCount: number;
}

function spearmanCorrelation(
  items: { rankA: number; rankB: number }[]
): number {
  const n = items.length;
  if (n < 2) return 0;
  const sumD2 = items.reduce((s, i) => s + (i.rankA - i.rankB) ** 2, 0);
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function topKOverlap(
  listA: string[],
  listB: string[],
  k: number
): { count: number; pct: number } {
  const setA = new Set(listA.slice(0, k));
  const setB = new Set(listB.slice(0, k));
  const intersect = [...setA].filter((id) => setB.has(id)).length;
  return { count: intersect, pct: Math.round((intersect / k) * 100) };
}

function stats(arr: number[]) {
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
    median: sorted[Math.floor(sorted.length / 2)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
  };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'userId required' }, { status: 400 });
  }

  // 1. Load user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tasteProfile: true, allSignals: true },
  });
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Get both taste vectors via raw SQL
  const vectorResult = await prisma.$queryRaw<
    { tasteVector: string | null; tasteVectorV3: string | null }[]
  >`
    SELECT "tasteVector"::text, "tasteVectorV3"::text
    FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  const tasteVectorV21Raw = vectorResult[0]?.tasteVector ?? null;
  const tasteVectorV3Raw = vectorResult[0]?.tasteVectorV3 ?? null;

  if (!tasteVectorV21Raw || !tasteVectorV3Raw) {
    return Response.json(
      {
        error: 'User missing taste vectors',
        hasV21: !!tasteVectorV21Raw,
        hasV3: !!tasteVectorV3Raw,
      },
      { status: 400 }
    );
  }

  const userVectorV21 = sqlToVector(tasteVectorV21Raw);
  const userVectorV3 = sqlToVector(tasteVectorV3Raw);

  // Build user taste profile for signal scoring
  const tasteProfile = (
    user.tasteProfile as unknown as { radarData?: Record<string, number> }
  )?.radarData;
  const userProfile: TasteProfile = {} as TasteProfile;
  for (const domain of ALL_TASTE_DOMAINS) {
    userProfile[domain] = tasteProfile?.[domain] ?? 0.5;
  }

  // 2. Load all enriched places
  const places = await prisma.placeIntelligence.findMany({
    where: { status: 'complete', signalCount: { gt: 0 } },
    select: {
      googlePlaceId: true,
      propertyName: true,
      signals: true,
      antiSignals: true,
      signalCount: true,
    },
  });

  console.log(
    `[compare-scoring-v3] 3-way scoring ${places.length} places for user ${userId}`
  );

  // 3. Signal-based scoring
  const signalScoreMap = new Map<string, number>();
  for (const place of places) {
    const signals = (place.signals as unknown as BriefingSignal[]) || [];
    const antiSignals =
      (place.antiSignals as unknown as BriefingAntiSignal[]) || [];
    const match = computeMatchFromSignals(signals, antiSignals, userProfile);
    signalScoreMap.set(place.googlePlaceId, match.overallScore);
  }

  // 4. Vector v2.1 scoring
  const v21Matches = await findSimilarProperties(userVectorV21, 500);
  const v21ScoreMap = new Map<string, number>();
  for (const m of v21Matches) {
    v21ScoreMap.set(m.googlePlaceId, m.score);
  }

  // 5. Vector v3 scoring
  const v3Matches = await findSimilarPropertiesV3(userVectorV3, 500);
  const v3ScoreMap = new Map<string, number>();
  for (const m of v3Matches) {
    v3ScoreMap.set(m.googlePlaceId, m.score);
  }

  // 6. Combine
  const combined: PlaceScores[] = places.map((place) => ({
    googlePlaceId: place.googlePlaceId,
    propertyName: place.propertyName,
    signalScore: signalScoreMap.get(place.googlePlaceId) ?? 50,
    vectorV21Score: v21ScoreMap.get(place.googlePlaceId) ?? 0,
    vectorV3Score: v3ScoreMap.get(place.googlePlaceId) ?? 0,
    signalRank: 0,
    vectorV21Rank: 0,
    vectorV3Rank: 0,
    signalCount: place.signalCount,
  }));

  // Assign ranks
  const bySignal = [...combined].sort(
    (a, b) => b.signalScore - a.signalScore
  );
  bySignal.forEach((p, i) => (p.signalRank = i + 1));

  const byV21 = [...combined].sort(
    (a, b) => b.vectorV21Score - a.vectorV21Score
  );
  byV21.forEach((p, i) => (p.vectorV21Rank = i + 1));

  const byV3 = [...combined].sort(
    (a, b) => b.vectorV3Score - a.vectorV3Score
  );
  byV3.forEach((p, i) => (p.vectorV3Rank = i + 1));

  // 7. Analytics

  // Pairwise Spearman correlations
  const spearmanSignalV21 = spearmanCorrelation(
    combined.map((p) => ({ rankA: p.signalRank, rankB: p.vectorV21Rank }))
  );
  const spearmanSignalV3 = spearmanCorrelation(
    combined.map((p) => ({ rankA: p.signalRank, rankB: p.vectorV3Rank }))
  );
  const spearmanV21V3 = spearmanCorrelation(
    combined.map((p) => ({ rankA: p.vectorV21Rank, rankB: p.vectorV3Rank }))
  );

  // Top-N overlap (pairwise)
  const topNs = [10, 20, 50];
  const signalIds = bySignal.map((p) => p.googlePlaceId);
  const v21Ids = byV21.map((p) => p.googlePlaceId);
  const v3Ids = byV3.map((p) => p.googlePlaceId);

  const overlapTable: Record<
    number,
    {
      signalVsV21: { count: number; pct: number };
      signalVsV3: { count: number; pct: number };
      v21VsV3: { count: number; pct: number };
    }
  > = {};
  for (const k of topNs) {
    overlapTable[k] = {
      signalVsV21: topKOverlap(signalIds, v21Ids, k),
      signalVsV3: topKOverlap(signalIds, v3Ids, k),
      v21VsV3: topKOverlap(v21Ids, v3Ids, k),
    };
  }

  // Ground truth check
  const groundTruth = [
    'Forestis Dolomites',
    'Ett Hem',
    'WIESERGUT',
    'Arena México',
    'Chatuchak Weekend Market',
  ];
  const groundTruthResults = groundTruth
    .map((name) => {
      const p = combined.find((c) => c.propertyName === name);
      if (!p) return null;
      return {
        propertyName: name,
        signalRank: p.signalRank,
        vectorV21Rank: p.vectorV21Rank,
        vectorV3Rank: p.vectorV3Rank,
        signalScore: p.signalScore,
        vectorV21Score: p.vectorV21Score,
        vectorV3Score: p.vectorV3Score,
      };
    })
    .filter(Boolean);

  // Biggest v21↔v3 divergences
  const v3VsV21Divergence = [...combined]
    .map((p) => ({
      propertyName: p.propertyName,
      vectorV21Rank: p.vectorV21Rank,
      vectorV3Rank: p.vectorV3Rank,
      delta: p.vectorV21Rank - p.vectorV3Rank, // positive = v3 ranks higher
      vectorV21Score: p.vectorV21Score,
      vectorV3Score: p.vectorV3Score,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return Response.json(
    {
      summary: {
        totalPlaces: combined.length,
        spearmanCorrelations: {
          signalVsV21: Math.round(spearmanSignalV21 * 1000) / 1000,
          signalVsV3: Math.round(spearmanSignalV3 * 1000) / 1000,
          v21VsV3: Math.round(spearmanV21V3 * 1000) / 1000,
        },
        topNOverlap: overlapTable,
        scoreDistributions: {
          signal: stats(combined.map((p) => p.signalScore)),
          vectorV21: stats(combined.map((p) => p.vectorV21Score)),
          vectorV3: stats(combined.map((p) => p.vectorV3Score)),
        },
      },
      groundTruth: groundTruthResults,
      divergences: {
        v3FavorsOverV21: v3VsV21Divergence
          .filter((d) => d.delta > 0)
          .slice(0, 10),
        v21FavorsOverV3: v3VsV21Divergence
          .filter((d) => d.delta < 0)
          .slice(0, 10),
      },
      topBySignal: bySignal.slice(0, 20).map((p) => ({
        propertyName: p.propertyName,
        signalScore: p.signalScore,
        vectorV21Score: p.vectorV21Score,
        vectorV3Score: p.vectorV3Score,
        signalRank: p.signalRank,
        vectorV21Rank: p.vectorV21Rank,
        vectorV3Rank: p.vectorV3Rank,
      })),
      topByV21: byV21.slice(0, 20).map((p) => ({
        propertyName: p.propertyName,
        signalScore: p.signalScore,
        vectorV21Score: p.vectorV21Score,
        vectorV3Score: p.vectorV3Score,
        signalRank: p.signalRank,
        vectorV21Rank: p.vectorV21Rank,
        vectorV3Rank: p.vectorV3Rank,
      })),
      topByV3: byV3.slice(0, 20).map((p) => ({
        propertyName: p.propertyName,
        signalScore: p.signalScore,
        vectorV21Score: p.vectorV21Score,
        vectorV3Score: p.vectorV3Score,
        signalRank: p.signalRank,
        vectorV21Rank: p.vectorV21Rank,
        vectorV3Rank: p.vectorV3Rank,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-cache' } }
  );
}
