/**
 * GET /api/intelligence/[googlePlaceId]
 *
 * Fetch full intelligence for a property.
 * Returns signals, anti-signals, reliability, and pipeline status.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
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

    // Debug mode: return raw DB record for inspection
    const url = new URL(req.url);
    if (url.searchParams.get('debug') === 'true') {
      return NextResponse.json({
        raw: {
          signals: intel.signals,
          signalsType: typeof intel.signals,
          signalsIsArray: Array.isArray(intel.signals),
          signalsLength: Array.isArray(intel.signals) ? intel.signals.length : null,
          signalsSample: Array.isArray(intel.signals) ? intel.signals.slice(0, 2) : intel.signals,
          antiSignals: intel.antiSignals,
          facts: intel.facts,
          reliability: intel.reliability,
          status: intel.status,
          signalCount: intel.signalCount,
          antiSignalCount: intel.antiSignalCount,
        },
      });
    }

    return NextResponse.json({
      status: intel.status,
      propertyName: intel.propertyName,
      signals: Array.isArray(intel.signals) ? intel.signals : [],
      antiSignals: Array.isArray(intel.antiSignals) ? intel.antiSignals : [],
      reliability: intel.reliability ?? null,
      facts: intel.facts ?? null,
      signalCount: intel.signalCount,
      antiSignalCount: intel.antiSignalCount,
      reviewCount: intel.reviewCount,
      reliabilityScore: intel.reliabilityScore,
      lastEnrichedAt: intel.lastEnrichedAt,
      pipelineVersion: intel.pipelineVersion,
      // Synthesis fields
      description: intel.description ?? null,
      whatToOrder: intel.whatToOrder ?? null,
      tips: intel.tips ?? null,
      alsoKnownAs: intel.alsoKnownAs ?? null,
      googleData: intel.googleData ?? null,
      formalityLevel: intel.formalityLevel ?? null,
      cuisineStyle: intel.cuisineStyle ?? null,
      // Heritage — extracted from facts for dedicated rendering
      heritage: (() => {
        if (!intel.facts || typeof intel.facts !== 'object') return null;
        const f = intel.facts as Record<string, any>;
        const h: Record<string, any> = {};
        if (f.architect) h.architect = f.architect;
        if (f.yearEstablished || f.year_established) h.yearEstablished = String(f.yearEstablished || f.year_established);
        if (f.yearRenovated || f.year_renovated) h.yearRenovated = String(f.yearRenovated || f.year_renovated);
        if (f.previousUses && Array.isArray(f.previousUses)) h.previousUses = f.previousUses;
        if (f.significance) h.significance = f.significance;
        if (f.restorationPhilosophy || f.restoration_philosophy) h.restorationPhilosophy = f.restorationPhilosophy || f.restoration_philosophy;
        return Object.keys(h).length > 0 ? h : null;
      })(),
      // Seasonality — extracted from facts for dedicated rendering
      seasonality: (() => {
        if (!intel.facts || typeof intel.facts !== 'object') return null;
        const f = intel.facts as Record<string, any>;
        const s: Record<string, any> = {};
        if (f.bestMonths && Array.isArray(f.bestMonths)) s.bestMonths = f.bestMonths;
        if (f.peakMonths && Array.isArray(f.peakMonths)) s.peakMonths = f.peakMonths;
        if (f.seasonalNote) s.seasonalNote = f.seasonalNote;
        if (f.crowdPatterns) s.crowdPatterns = f.crowdPatterns;
        if (f.seasonalClosures && Array.isArray(f.seasonalClosures)) s.seasonalClosures = f.seasonalClosures;
        return Object.keys(s).length > 0 ? s : null;
      })(),
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