/**
 * POST /api/intelligence/lookup
 *
 * Called when a user adds a place. Checks for existing intelligence,
 * triggers the pipeline if needed, returns current state.
 *
 * Body: { googlePlaceId: string, propertyName: string, userId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

function daysBetween(a: Date | null, b: Date): number {
  if (!a) return Infinity;
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req.headers);
  const rl = rateLimit(clientIp, { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const { googlePlaceId, propertyName, userId } = await req.json();

    if (!googlePlaceId || !propertyName) {
      return NextResponse.json(
        { error: 'googlePlaceId and propertyName are required' },
        { status: 400 }
      );
    }

    // 1. Check if intelligence already exists
    const existing = await prisma.placeIntelligence.findUnique({
      where: { googlePlaceId },
    });

    if (existing?.status === 'complete') {
      const age = daysBetween(existing.lastEnrichedAt, new Date());

      if (age < existing.enrichmentTTL) {
        // Fresh — return cached intelligence
        return NextResponse.json({
          status: 'ready',
          intelligence: {
            id: existing.id,
            googlePlaceId: existing.googlePlaceId,
            propertyName: existing.propertyName,
            signalCount: existing.signalCount,
            antiSignalCount: existing.antiSignalCount,
            reliabilityScore: existing.reliabilityScore,
            lastEnrichedAt: existing.lastEnrichedAt,
          },
        });
      }

      // Stale — trigger background refresh, return existing data
      await inngest.send({
        name: 'pipeline/run',
        data: {
          googlePlaceId,
          propertyName,
          placeIntelligenceId: existing.id,
          trigger: 'refresh',
          triggeredByUserId: userId,
        },
      });

      return NextResponse.json({
        status: 'ready',
        refreshing: true,
        intelligence: {
          id: existing.id,
          googlePlaceId: existing.googlePlaceId,
          propertyName: existing.propertyName,
          signalCount: existing.signalCount,
          antiSignalCount: existing.antiSignalCount,
          reliabilityScore: existing.reliabilityScore,
          lastEnrichedAt: existing.lastEnrichedAt,
        },
      });
    }

    if (existing?.status === 'enriching') {
      // Pipeline already running
      return NextResponse.json({
        status: 'enriching',
        intelligence: {
          id: existing.id,
          googlePlaceId: existing.googlePlaceId,
          propertyName: existing.propertyName,
        },
      });
    }

    // 2. No intelligence exists (or previous run failed) — create and trigger
    const intel = existing
      ? await prisma.placeIntelligence.update({
          where: { id: existing.id },
          data: { status: 'pending', propertyName },
        })
      : await prisma.placeIntelligence.create({
          data: {
            googlePlaceId,
            propertyName,
            status: 'pending',
            signals: '[]',
          },
        });

    await inngest.send({
      name: 'pipeline/run',
      data: {
        googlePlaceId,
        propertyName,
        placeIntelligenceId: intel.id,
        trigger: 'user_import',
        triggeredByUserId: userId,
      },
    });

    return NextResponse.json({
      status: 'queued',
      intelligence: {
        id: intel.id,
        googlePlaceId: intel.googlePlaceId,
        propertyName: intel.propertyName,
      },
    });
  } catch (error) {
    console.error('Intelligence lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup intelligence' },
      { status: 500 }
    );
  }
}
