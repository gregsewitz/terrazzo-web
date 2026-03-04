/**
 * Compare Signal-Based vs Embedding-Based Match Scoring
 *
 * Runs both scoring approaches against all enriched places for a user,
 * then outputs a detailed comparison: rank correlation, score distributions,
 * top-N overlap, and places where the methods diverge most.
 *
 * GET /api/intelligence/compare-scoring?userId=...
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match';
import { findSimilarProperties } from '@/lib/taste-intelligence/queries';
import { sqlToVector } from '@/lib/taste-intelligence/vectors';
import type { TasteProfile, TasteDomain, BriefingSignal, BriefingAntiSignal } from '@/types';
import { ALL_TASTE_DOMAINS, DIMENSION_TO_DOMAIN } from '@/types';

export const maxDuration = 60;

interface PlaceScores {
  googlePlaceId: string;
  propertyName: string;
  signalScore: number;     // 0-100 from computeMatchFromSignals
  vectorScore: number;     // 0-100 from pgvector cosine similarity
  blendedScore: number;    // 60% vector + 40% signal
  signalRank: number;
  vectorRank: number;
  rankDelta: number;       // signalRank - vectorRank (positive = vector ranks higher)
  signalCount: number;
  domainBreakdown: Record<TasteDomain, number>;
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'userId required' }, { status: 400 });
  }

  // 1. Load user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tasteProfile: true,
      allSignals: true,
    },
  });

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Get taste vector via raw SQL (Unsupported type)
  const vectorResult = await prisma.$queryRaw<{ tasteVector: string | null }[]>`
    SELECT "tasteVector"::text FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  const tasteVectorRaw = vectorResult[0]?.tasteVector ?? null;

  if (!tasteVectorRaw) {
    return Response.json({ error: 'User has no taste vector — run backfill first' }, { status: 400 });
  }

  const userVector = sqlToVector(tasteVectorRaw);

  // Build user taste profile from radarData or allSignals
  const tasteProfile = (user.tasteProfile as unknown as { radarData?: Record<string, number> })?.radarData;
  const userProfile: TasteProfile = {} as TasteProfile;
  for (const domain of ALL_TASTE_DOMAINS) {
    userProfile[domain] = tasteProfile?.[domain] ?? 0.5;
  }

  // 2. Load all enriched places
  const places = await prisma.placeIntelligence.findMany({
    where: {
      status: 'complete',
      signalCount: { gt: 0 },
    },
    select: {
      googlePlaceId: true,
      propertyName: true,
      signals: true,
      antiSignals: true,
      signalCount: true,
    },
  });

  console.log(`[compare-scoring] Scoring ${places.length} places for user ${userId}`);

  // 3. Run SIGNAL-BASED scoring for all places
  const signalScores: Map<string, { score: number; breakdown: Record<TasteDomain, number> }> = new Map();
  for (const place of places) {
    const signals = (place.signals as unknown as BriefingSignal[]) || [];
    const antiSignals = (place.antiSignals as unknown as BriefingAntiSignal[]) || [];
    const match = computeMatchFromSignals(signals, antiSignals, userProfile);
    signalScores.set(place.googlePlaceId, {
      score: match.overallScore,
      breakdown: match.breakdown,
    });
  }

  // 4. Run VECTOR-BASED scoring (pgvector cosine similarity)
  const vectorMatches = await findSimilarProperties(userVector, 500); // get all
  const vectorScoreMap = new Map<string, number>();
  for (const match of vectorMatches) {
    vectorScoreMap.set(match.googlePlaceId, match.score);
  }

  // 5. Combine and rank
  const combined: PlaceScores[] = places.map((place) => {
    const sig = signalScores.get(place.googlePlaceId);
    const vecScore = vectorScoreMap.get(place.googlePlaceId) ?? 0;
    const sigScore = sig?.score ?? 50;
    const blended = Math.round(vecScore * 0.6 + sigScore * 0.4);

    return {
      googlePlaceId: place.googlePlaceId,
      propertyName: place.propertyName,
      signalScore: sigScore,
      vectorScore: vecScore,
      blendedScore: blended,
      signalRank: 0, // filled below
      vectorRank: 0,
      rankDelta: 0,
      signalCount: place.signalCount,
      domainBreakdown: sig?.breakdown ?? ({} as Record<TasteDomain, number>),
    };
  });

  // Assign ranks
  const bySignal = [...combined].sort((a, b) => b.signalScore - a.signalScore);
  bySignal.forEach((p, i) => { p.signalRank = i + 1; });

  const byVector = [...combined].sort((a, b) => b.vectorScore - a.vectorScore);
  byVector.forEach((p, i) => { p.vectorRank = i + 1; });

  combined.forEach((p) => { p.rankDelta = p.signalRank - p.vectorRank; });

  // 6. Compute analytics

  // Spearman rank correlation
  const n = combined.length;
  const sumD2 = combined.reduce((sum, p) => sum + p.rankDelta * p.rankDelta, 0);
  const spearman = 1 - (6 * sumD2) / (n * (n * n - 1));

  // Top-N overlap
  const topN = [10, 20, 50];
  const overlap: Record<number, { count: number; pct: number }> = {};
  for (const k of topN) {
    const signalTopK = new Set(bySignal.slice(0, k).map((p) => p.googlePlaceId));
    const vectorTopK = new Set(byVector.slice(0, k).map((p) => p.googlePlaceId));
    const intersect = [...signalTopK].filter((id) => vectorTopK.has(id)).length;
    overlap[k] = { count: intersect, pct: Math.round((intersect / k) * 100) };
  }

  // Score distribution stats
  const signalScoresArr = combined.map((p) => p.signalScore);
  const vectorScoresArr = combined.map((p) => p.vectorScore);
  const stats = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
      median: sorted[Math.floor(sorted.length / 2)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
    };
  };

  // Biggest divergences (vector says high, signal says low — or vice versa)
  const sortedByDivergence = [...combined].sort(
    (a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta)
  );

  // Places where vector ranks much higher than signal
  const vectorFavors = sortedByDivergence
    .filter((p) => p.rankDelta > 0) // positive = signal ranks lower than vector
    .slice(0, 10)
    .map((p) => ({
      propertyName: p.propertyName,
      signalRank: p.signalRank,
      vectorRank: p.vectorRank,
      signalScore: p.signalScore,
      vectorScore: p.vectorScore,
      rankDelta: p.rankDelta,
    }));

  // Places where signal ranks much higher than vector
  const signalFavors = sortedByDivergence
    .filter((p) => p.rankDelta < 0) // negative = signal ranks higher than vector
    .slice(0, 10)
    .map((p) => ({
      propertyName: p.propertyName,
      signalRank: p.signalRank,
      vectorRank: p.vectorRank,
      signalScore: p.signalScore,
      vectorScore: p.vectorScore,
      rankDelta: p.rankDelta,
    }));

  // Final sorted results (by blended score)
  combined.sort((a, b) => b.blendedScore - a.blendedScore);

  return Response.json({
    summary: {
      totalPlaces: n,
      spearmanCorrelation: Math.round(spearman * 1000) / 1000,
      topNOverlap: overlap,
      signalDistribution: stats(signalScoresArr),
      vectorDistribution: stats(vectorScoresArr),
    },
    divergences: {
      vectorFavors,
      signalFavors,
    },
    topByBlended: combined.slice(0, 30).map((p) => ({
      propertyName: p.propertyName,
      signalScore: p.signalScore,
      vectorScore: p.vectorScore,
      blendedScore: p.blendedScore,
      signalRank: p.signalRank,
      vectorRank: p.vectorRank,
      signalCount: p.signalCount,
    })),
    topBySignalOnly: bySignal.slice(0, 30).map((p) => ({
      propertyName: p.propertyName,
      signalScore: p.signalScore,
      vectorScore: p.vectorScore,
      signalRank: p.signalRank,
      vectorRank: p.vectorRank,
    })),
    topByVectorOnly: byVector.slice(0, 30).map((p) => ({
      propertyName: p.propertyName,
      signalScore: p.signalScore,
      vectorScore: p.vectorScore,
      signalRank: p.signalRank,
      vectorRank: p.vectorRank,
    })),
    allScores: combined.map((p) => ({
      googlePlaceId: p.googlePlaceId,
      propertyName: p.propertyName,
      signalScore: p.signalScore,
      vectorScore: p.vectorScore,
      blendedScore: p.blendedScore,
      signalRank: p.signalRank,
      vectorRank: p.vectorRank,
      rankDelta: p.rankDelta,
    })),
  }, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}
