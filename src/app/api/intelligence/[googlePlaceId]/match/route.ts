/**
 * POST /api/intelligence/[googlePlaceId]/match
 *
 * Compute taste match between a user's profile and a property's intelligence.
 * Returns per-dimension scores and an overall match score.
 *
 * Body: { tasteProfile: TasteProfile }
 * (Pass the user's profile directly — avoids needing auth for now)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ googlePlaceId: string }> }
) {
  try {
    const { googlePlaceId } = await params;
    const { tasteProfile } = await req.json();

    if (!tasteProfile) {
      return NextResponse.json(
        { error: 'tasteProfile is required in request body' },
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

    const signals = JSON.parse(intel.signals);
    const antiSignals = intel.antiSignals ? JSON.parse(intel.antiSignals) : [];
    const match = computeMatchFromSignals(signals, antiSignals, tasteProfile);

    return NextResponse.json({
      googlePlaceId,
      propertyName: intel.propertyName,
      overallScore: match.overallScore,
      breakdown: match.breakdown,
      topDimension: match.topDimension,
      signalCount: intel.signalCount,
      reliabilityScore: intel.reliabilityScore,
    });
  } catch (error) {
    console.error('Match computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute match' },
      { status: 500 }
    );
  }
}