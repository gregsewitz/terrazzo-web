/**
 * GET /api/intelligence/[googlePlaceId]
 *
 * Fetch full intelligence for a property.
 * Returns signals, anti-signals, reliability, and pipeline status.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ googlePlaceId: string }> }
) {
  try {
    const { googlePlaceId } = await params;

    const intel = await prisma.placeIntelligence.findUnique({
      where: { googlePlaceId },
      include: {
        pipelineRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            currentStage: true,
            stagesCompleted: true,
            startedAt: true,
            completedAt: true,
            durationMs: true,
          },
        },
      },
    });

    if (!intel) {
      return NextResponse.json({ status: 'unknown' }, { status: 404 });
    }

    const latestRun = intel.pipelineRuns[0] || null;

    return NextResponse.json({
      status: intel.status,
      propertyName: intel.propertyName,
      signals: intel.signals,
      antiSignals: intel.antiSignals ?? [],
      reliability: intel.reliability ?? null,
      facts: intel.facts ?? null,
      signalCount: intel.signalCount,
      antiSignalCount: intel.antiSignalCount,
      reviewCount: intel.reviewCount,
      reliabilityScore: intel.reliabilityScore,
      lastEnrichedAt: intel.lastEnrichedAt,
      pipelineVersion: intel.pipelineVersion,
      latestRun: latestRun
        ? {
            status: latestRun.status,
            currentStage: latestRun.currentStage,
            stagesCompleted: latestRun.stagesCompleted ?? [],
            startedAt: latestRun.startedAt,
            completedAt: latestRun.completedAt,
            durationMs: latestRun.durationMs,
          }
        : null,
    });
  } catch (error) {
    console.error('Intelligence fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intelligence' },
      { status: 500 }
    );
  }
}