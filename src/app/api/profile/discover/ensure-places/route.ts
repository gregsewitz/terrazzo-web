/**
 * POST /api/profile/discover/ensure-places
 *
 * Lightweight endpoint to ensure enrichment is triggered for a batch of places.
 * Used by the client when falling back to hardcoded discover constants that may
 * not have PlaceIntelligence records yet.
 *
 * Accepts places with googlePlaceId (direct lookup) or name+location (fallback
 * resolution via Google Places API). This makes the system self-healing — even
 * hardcoded constants without googlePlaceIds get resolved and enriched on first use.
 *
 * Fire-and-forget pattern: returns immediately after kicking off enrichment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-auth-handler';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { searchPlace, mapGoogleTypeToPlaceType } from '@/lib/places';
import type { User } from '@prisma/client';

interface EnsurePlaceInput {
  googlePlaceId?: string;
  name?: string;
  location?: string;
  type?: string;
}

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  try {
    const { places } = (await req.json()) as { places: EnsurePlaceInput[] };

    if (!Array.isArray(places) || places.length === 0) {
      return NextResponse.json({ ok: true, triggered: 0, resolved: 0 });
    }

    // Cap at 30 places to prevent abuse
    const batch = places.slice(0, 30);
    let triggered = 0;
    let resolved = 0;

    const results = await Promise.allSettled(
      batch.map(async (place) => {
        let gid = place.googlePlaceId;

        // Self-heal: resolve via Google Places API when no googlePlaceId
        if (!gid && place.name) {
          const query = place.location ? `${place.name}, ${place.location}` : place.name;
          const googleResult = await searchPlace(query);
          if (googleResult) {
            gid = googleResult.id;
            resolved++;
          }
        }

        if (!gid) return null;

        const placeType = place.type
          ? (place.type as any)
          : undefined;

        const id = await ensureEnrichment(
          gid,
          place.name || '',
          user.id,
          'hardcoded_ensure',
          placeType,
        );

        if (id) triggered++;
        return id;
      }),
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.log(`[ensure-places] ${failed}/${batch.length} places failed to process`);
    }

    console.log(`[ensure-places] ${triggered} triggered, ${resolved} resolved via search (${batch.length} total)`);
    return NextResponse.json({ ok: true, triggered, resolved, total: batch.length });
  } catch (err) {
    console.error('[ensure-places] Error:', err);
    return NextResponse.json({ error: 'Failed to ensure places' }, { status: 500 });
  }
});
