/**
 * GET /api/profile/reprofiling-check?userId=...
 *
 * Check if a user should be re-profiled based on signal health.
 *
 * Evaluates four triggers:
 * 1. 6+ months since last profile synthesis
 * 2. 3+ new bookings since last synthesis
 * 3. Any domain confidence dropped below 50% after decay
 * 4. Contradiction ratio exceeds 30%
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decayConfidence, checkReprofilingTriggers } from '@/lib/signal-decay';
import { ALL_TASTE_DOMAINS } from '@/types';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastProfileSynthesizedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Count new saved places (proxy for "bookings") since last synthesis
  const newBookingsSinceSynthesis = user.lastProfileSynthesizedAt
    ? await prisma.savedPlace.count({
        where: {
          userId,
          createdAt: { gt: user.lastProfileSynthesizedAt },
        },
      })
    : 0;

  // Compute per-domain decayed confidence averages
  const signals = await prisma.tasteNode.findMany({
    where: { userId, isActive: true },
    select: { domain: true, confidence: true, extractedAt: true, createdAt: true },
  });

  const now = new Date();
  const domainConfidences: Record<string, number> = {};

  for (const domain of ALL_TASTE_DOMAINS) {
    const domainSigs = signals.filter((s) => s.domain === domain);
    if (domainSigs.length === 0) {
      domainConfidences[domain] = 0;
      continue;
    }
    const avgDecayed =
      domainSigs.reduce((sum, s) => {
        const extractedAt = s.extractedAt || s.createdAt;
        return sum + decayConfidence(s.confidence, extractedAt, 180, now);
      }, 0) / domainSigs.length;
    domainConfidences[domain] = Math.round(avgDecayed * 1000) / 1000;
  }

  // Compute contradiction ratio
  const contradictions = await prisma.contradictionNode.count({
    where: { userId, isActive: true },
  });
  const totalSignals = signals.length;
  const contradictionRatio = totalSignals > 0 ? contradictions / totalSignals : 0;

  // Run the check
  const result = checkReprofilingTriggers({
    lastSynthesizedAt: user.lastProfileSynthesizedAt,
    newBookingsSinceSynthesis,
    domainConfidences,
    contradictionRatio,
  });

  return NextResponse.json({
    ...result,
    diagnostics: {
      lastSynthesizedAt: user.lastProfileSynthesizedAt,
      newBookings: newBookingsSinceSynthesis,
      domainConfidences,
      contradictionRatio: Math.round(contradictionRatio * 100) / 100,
      totalSignals,
      totalContradictions: contradictions,
    },
  });
}
