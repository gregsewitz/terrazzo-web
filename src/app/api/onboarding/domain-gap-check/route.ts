import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import {
  computeUserTasteVectorV3,
  analyzeDomainCoverage,
  findDomainExemplars,
} from '@/lib/taste-intelligence';
import type { CoverageAnalysis } from '@/lib/taste-intelligence';
import type { TasteSignal, PropertyExemplar } from '@/types';

/**
 * POST /api/onboarding/domain-gap-check
 *
 * Computes a preliminary taste vector from current signals, analyzes domain
 * coverage, and returns gap domains with exemplar properties for gap-fill reactions.
 *
 * Called after Act 1 completes (or periodically during onboarding) to decide
 * whether the user needs additional property-anchored questions to fill gaps.
 *
 * Input:
 *   { signals: TasteSignal[], radarData: {axis,value}[], existingAnchorIds?: string[] }
 *
 * Output:
 *   { coverage: CoverageAnalysis, exemplars: Record<domain, PropertyExemplar[]> }
 */

interface DomainGapCheckRequest {
  signals: TasteSignal[];
  radarData: Array<{ axis: string; value: number }>;
  existingAnchorIds?: string[];
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':gap-check', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body: DomainGapCheckRequest = await req.json();
    const { signals, radarData, existingAnchorIds = [] } = body;

    if (!signals?.length || !radarData?.length) {
      return NextResponse.json({ error: 'signals and radarData are required' }, { status: 400 });
    }

    // Build micro-taste signals map for computeUserTasteVectorV3
    const microTasteSignals: Record<string, string[]> = {};
    for (const sig of signals) {
      const cat = sig.cat || 'uncategorized';
      if (!microTasteSignals[cat]) microTasteSignals[cat] = [];
      microTasteSignals[cat].push(sig.tag);
    }

    // Compute preliminary vector from current signals
    const vector = computeUserTasteVectorV3({
      radarData,
      microTasteSignals,
      allSignals: signals.map((s) => ({ tag: s.tag, cat: s.cat, confidence: s.confidence })),
    });

    // Analyze coverage
    const coverage = analyzeDomainCoverage(vector);

    // For each gap domain, find exemplar properties
    const exemplars: Record<string, PropertyExemplar[]> = {};

    if (coverage.gapDomains.length > 0) {
      const exemplarPromises = coverage.gapDomains.map(async (domain) => {
        const results = await findDomainExemplars(domain, 2, existingAnchorIds);
        exemplars[domain] = results.map((r) => ({
          googlePlaceId: r.googlePlaceId,
          propertyName: r.propertyName,
          placeType: r.placeType,
          locationHint: r.locationHint,
          domainScore: r.score,
        }));
      });
      await Promise.all(exemplarPromises);
    }

    return NextResponse.json({ coverage, exemplars });
  } catch (error) {
    console.error('[domain-gap-check] Error:', error);
    return NextResponse.json(
      { error: 'Gap check failed', details: String(error) },
      { status: 500 },
    );
  }
}
