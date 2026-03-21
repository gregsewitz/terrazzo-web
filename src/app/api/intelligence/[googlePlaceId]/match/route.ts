/**
 * POST /api/intelligence/[googlePlaceId]/match
 *
 * Compute taste match between a user and a property using vector cosine similarity.
 * Returns raw cosine score, per-domain breakdown, and match explanation.
 *
 * Returns 404 if vectors are unavailable (no signal-based fallback — that
 * operates on an incompatible 0-100 scale).
 *
 * Body: { userId: string }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeVectorMatchFromDb } from '@/lib/taste-match-vectors';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ googlePlaceId: string }> }
) {
  try {
    const { googlePlaceId } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required in request body' },
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

    const vectorMatch = await computeVectorMatchFromDb(userId, googlePlaceId);

    if (!vectorMatch) {
      return NextResponse.json(
        { status: 'not_ready', message: 'Vector scoring unavailable — user or property embedding missing' },
        { status: 404 }
      );
    }

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
  } catch (error) {
    console.error('Match computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute match' },
      { status: 500 }
    );
  }
}