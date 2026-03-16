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
  targetDomains?: string[];
  maxExemplars?: number;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':gap-check', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body: DomainGapCheckRequest = await req.json();
    const { signals, radarData = [], existingAnchorIds = [], targetDomains, maxExemplars } = body;

    if (!signals?.length) {
      return NextResponse.json({ error: 'signals are required' }, { status: 400 });
    }

    // Early onboarding (Act 0): radarData is empty, not enough signal for gap
    // analysis. Just spread exemplars across all core domains for diverse first
    // impressions. targetDomains from the client can still override.
    const ALL_CORE_DOMAINS = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Geography'];
    const earlyOnboarding = radarData.length === 0;

    let coverage: CoverageAnalysis | null = null;
    let domainsToQuery: string[];

    if (targetDomains?.length) {
      // Explicit target domains always win
      domainsToQuery = targetDomains;
    } else if (earlyOnboarding) {
      // Act 0: spread across all core domains for diverse first impressions
      domainsToQuery = ALL_CORE_DOMAINS;
    } else {
      // Later acts: use gap analysis
      const microTasteSignals: Record<string, string[]> = {};
      for (const sig of signals) {
        const cat = sig.cat || 'uncategorized';
        if (!microTasteSignals[cat]) microTasteSignals[cat] = [];
        microTasteSignals[cat].push(sig.tag);
      }

      const vector = computeUserTasteVectorV3({
        radarData,
        microTasteSignals,
        allSignals: signals.map((s) => ({ tag: s.tag, cat: s.cat, confidence: s.confidence })),
      });

      coverage = analyzeDomainCoverage(vector);
      domainsToQuery = coverage.gapDomains;
    }

    const perDomainLimit = maxExemplars ? Math.ceil(maxExemplars / Math.max(1, domainsToQuery.length)) : 2;

    // For each domain, find exemplar properties
    const exemplars: Record<string, PropertyExemplar[]> = {};

    if (domainsToQuery.length > 0) {
      const exemplarPromises = domainsToQuery.map(async (domain) => {
        const results = await findDomainExemplars(domain, perDomainLimit, existingAnchorIds);
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

    // Flatten to array format: [{ domain, exemplar }]
    let flatExemplars: { domain: string; exemplar: PropertyExemplar }[] = [];
    for (const [domain, items] of Object.entries(exemplars)) {
      for (const exemplar of items) {
        flatExemplars.push({ domain, exemplar });
      }
    }
    if (maxExemplars) {
      flatExemplars = flatExemplars.slice(0, maxExemplars);
    }

    return NextResponse.json({ coverage, exemplars: flatExemplars });
  } catch (error) {
    console.error('[domain-gap-check] Error:', error);
    return NextResponse.json(
      { error: 'Gap check failed', details: String(error) },
      { status: 500 },
    );
  }
}
