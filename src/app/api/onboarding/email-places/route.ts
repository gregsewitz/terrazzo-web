/**
 * GET /api/onboarding/email-places
 *
 * Returns past hotel & restaurant reservations from the user's email history
 * (parsed by Nylas) formatted as PropertyExemplar-compatible objects for
 * the gap-fill-reactions phase.
 *
 * Only returns reservations where:
 *  - placeType is 'hotel' or 'restaurant' (or 'bar', 'cafe')
 *  - effective date is in the past
 *  - googlePlaceId is resolved
 *  - status is not 'dismissed'
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Fetch past hotel/restaurant reservations with resolved Google Place IDs
    const reservations = await prisma.emailReservation.findMany({
      where: {
        userId: user.id,
        placeType: { in: ['hotel', 'restaurant', 'bar', 'cafe'] },
        googlePlaceId: { not: null },
        status: { not: 'dismissed' },
        // Past: effective date < today
        // For hotels use checkInDate, for restaurants use reservationDate
        OR: [
          { reservationDate: { lt: now } },
          { checkInDate: { lt: now } },
        ],
      },
      orderBy: [
        // Most recent first — more memorable for the user
        { reservationDate: 'desc' },
      ],
      take: 20, // Cap at 20 to avoid overwhelming
    });

    // Deduplicate by googlePlaceId (user may have visited same place multiple times)
    const seen = new Set<string>();
    const unique = reservations.filter((r) => {
      if (!r.googlePlaceId || seen.has(r.googlePlaceId)) return false;
      seen.add(r.googlePlaceId);
      return true;
    });

    // Map to PropertyExemplar-compatible shape
    const places = unique.map((r) => ({
      googlePlaceId: r.googlePlaceId!,
      propertyName: r.placeName,
      placeType: r.placeType,
      locationHint: r.location || null,
      domainScore: r.confidence, // Reuse confidence as a proxy
      // Extra metadata for the UI
      reservationId: r.id,
      provider: r.provider,
      visitDate: r.reservationDate?.toISOString() || r.checkInDate?.toISOString() || null,
    }));

    return NextResponse.json({
      places,
      total: places.length,
      scanComplete: true, // TODO: check if email scan is still running
    });
  } catch (error) {
    console.error('[email-places] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch email places' }, { status: 500 });
  }
}
