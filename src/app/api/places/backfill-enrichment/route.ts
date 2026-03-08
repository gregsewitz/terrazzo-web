import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { User } from '@prisma/client';

/**
 * POST /api/places/backfill-enrichment
 *
 * Called when a user saves during the preview phase of a Maps import
 * (before enrichment completes). When enrichment finishes on the client,
 * this endpoint back-fills the DB records with googlePlaceId, type,
 * photo, taste data, etc.
 *
 * Matches by name + userId on recently-saved places (last 5 minutes)
 * since the original save happened with preview-quality data.
 */
export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const { updates } = await req.json() as {
    updates: Array<{
      name: string;
      location?: string;
      enriched: {
        id?: string; // store ID (may be server-assigned)
        type?: string;
        google?: Record<string, unknown>;
        matchScore?: number;
        matchBreakdown?: Record<string, unknown>;
        tasteNote?: string;
        terrazzoInsight?: string;
        enrichment?: Record<string, unknown>;
        whatToOrder?: string[];
        tips?: string[];
        alsoKnownAs?: string;
      };
    }>;
  };

  if (!Array.isArray(updates) || updates.length === 0) {
    return Response.json({ patched: 0 });
  }

  // Only look at places saved in the last 5 minutes
  const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);

  let patched = 0;

  for (const update of updates.slice(0, 100)) {
    const { name, enriched } = update;
    if (!name || !enriched) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleData = enriched.google as any;
    const googlePlaceId = googleData?.placeId;

    // Find the recently-saved place by name (preview-saved without googlePlaceId)
    const match = await prisma.savedPlace.findFirst({
      where: {
        userId: user.id,
        name: name,
        googlePlaceId: null, // Only match un-enriched records
        createdAt: { gte: recentCutoff },
        deletedAt: null,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!match) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toJson = (v: unknown) => v as any;

    // Update the record with enriched data
    await prisma.savedPlace.update({
      where: { id: match.id },
      data: {
        type: enriched.type || undefined,
        googlePlaceId: googlePlaceId || undefined,
        googleData: googleData ? toJson(googleData) : undefined,
        matchScore: enriched.matchScore ?? undefined,
        matchBreakdown: enriched.matchBreakdown ? toJson(enriched.matchBreakdown) : undefined,
        tasteNote: enriched.tasteNote || undefined,
        terrazzoInsight: enriched.terrazzoInsight || undefined,
        enrichment: enriched.enrichment ? toJson(enriched.enrichment) : undefined,
        whatToOrder: enriched.whatToOrder || undefined,
        tips: enriched.tips || undefined,
        alsoKnownAs: enriched.alsoKnownAs || undefined,
      },
    });

    // Now that we have a googlePlaceId, fire the enrichment pipeline
    if (googlePlaceId) {
      ensureEnrichment(googlePlaceId, name, user.id, 'user_import', enriched.type).catch(() => {});
    }

    patched++;
  }

  return Response.json({ patched });
});
