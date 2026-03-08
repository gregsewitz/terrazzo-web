/**
 * POST /api/intelligence/[googlePlaceId]/match
 *
 * Compute taste match between a user's profile and a property's intelligence.
 * Returns per-dimension scores and an overall match score.
 *
 * v4: Uses vector cosine similarity when userId is provided and both vectors exist.
 * Falls back to signal-based scoring when vectors aren't available.
 *
 * Body: { tasteProfile: TasteProfile, userId?: string }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match-v3';
import { computeVectorMatchFromDb } from '@/lib/taste-match-vectors';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ googlePlaceId: string }> }
) {
  try {
    const { googlePlaceId } = await params;
    const { tasteProfile, userId } = await req.json();

    if (!tasteProfile && !userId) {
      return NextResponse.json(
        { error: 'tasteProfile or userId is required in request body' },
        { status: 400 }
      );
    }

    const intel = await prisma.placeIntelligence.findUnique({
      where: { googlePlaceId },
    });

    if (!intel || intel.status !== 'complete') {
      return NextResponse.json(
        { status: 'not_ready', message: 'Intelligence not yet available for this property' },
        { status: 404 }
      );
    }

    // v4: Try vector-first scoring when userId is available
    if (userId) {
      const vectorMatch = await computeVectorMatchFromDb(userId, googlePlaceId);
      if (vectorMatch) {
        return NextResponse.json({
          googlePlaceId,
          propertyName: intel.propertyName,
          overallScore: vectorMatch.overallScore,
          breakdown: vectorMatch.breakdown,
          topDimension: vectorMatch.topDimension,
          explanation: vectorMatch.explanation,
          signalCount: intel.signalCount,
          reliabilityScore: intel.reliabilityScore,
          scoringMethod: 'vector',
        });
      }
    }

    // Fallback: signal-based scoring
    if (!tasteProfile) {
      return NextResponse.json(
        { error: 'Vector scoring unavailable and no tasteProfile provided' },
        { status: 400 }
      );
    }

    const signals = intel.signals as any[];
    const antiSignals = (intel.antiSignals ?? []) as any[];
    const match = computeMatchFromSignals(signals, antiSignals, tasteProfile);

    return NextResponse.json({
      googlePlaceId,
      propertyName: intel.propertyName,
      overallScore: match.overallScore,
      breakdown: match.breakdown,
      topDimension: match.topDimension,
      signalCount: intel.signalCount,
      reliabilityScore: intel.reliabilityScore,
      scoringMethod: 'signal',
    });
  } catch (error) {
    console.error('Match computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute match' },
      { status: 500 }
    );
  }
}