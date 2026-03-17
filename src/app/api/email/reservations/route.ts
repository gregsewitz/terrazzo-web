import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { CACHE_PRIVATE_REVALIDATE, withCache } from '@/lib/cache-policy';

/**
 * GET /api/email/reservations
 *
 * Returns the user's staged reservations (the "inbox").
 * Supports filtering by status and placeType.
 *
 * Query params:
 *   status? = pending | confirmed | dismissed | all (default: pending)
 *   type?   = restaurant | hotel | flight | activity | all (default: all)
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = rateLimit(ip + ':email-reservations', { maxRequests: 20, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();
  const user = await getUser(request);
  if (!user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const statusFilter = searchParams.get('status') || 'pending';
  const typeFilter = searchParams.get('type') || 'all';

  try {
    const where: Record<string, unknown> = { userId: user.id };
    if (statusFilter !== 'all') where.status = statusFilter;
    if (typeFilter !== 'all') where.placeType = typeFilter;

    // Fetch reservations and status counts in parallel (avoids 3 separate COUNT queries)
    const [reservations, statusCounts] = await Promise.all([
      prisma.emailReservation.findMany({
        where,
        orderBy: [
          { reservationDate: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.emailReservation.groupBy({
        by: ['status'],
        where: { userId: user.id },
        _count: true,
      }),
    ]);

    const counts = { pending: 0, confirmed: 0, dismissed: 0 };
    for (const group of statusCounts) {
      const status = group.status as keyof typeof counts;
      if (status in counts) counts[status] = group._count;
    }

    return NextResponse.json({
      reservations: reservations.map((r: any) => ({
        id: r.id,
        status: r.status,
        reviewedAt: r.reviewedAt?.toISOString(),

        // Email provenance
        emailSubject: r.emailSubject,
        emailFrom: r.emailFrom,
        emailFromName: r.emailFromName,
        emailDate: r.emailDate.toISOString(),

        // Place data
        placeName: r.placeName,
        placeType: r.placeType,
        location: r.location,
        googlePlaceId: r.googlePlaceId,

        // Booking details
        reservationDate: r.reservationDate?.toISOString(),
        reservationTime: r.reservationTime,
        partySize: r.partySize,
        confirmationNumber: r.confirmationNumber,
        provider: r.provider,

        // Type-specific
        flightNumber: r.flightNumber,
        departureAirport: r.departureAirport,
        arrivalAirport: r.arrivalAirport,
        departureTime: r.departureTime,
        arrivalTime: r.arrivalTime,
        checkInDate: r.checkInDate?.toISOString(),
        checkOutDate: r.checkOutDate?.toISOString(),
        activityDetails: r.activityDetails,

        // Matching
        confidence: r.confidence,
        matchedTripId: r.matchedTripId,
        matchedTripName: r.matchedTripName,
        suggestedDayNumber: r.suggestedDayNumber,
        suggestedSlotId: r.suggestedSlotId,

        // Library link
        savedPlaceId: r.savedPlaceId,

        createdAt: r.createdAt.toISOString(),
      })),
      counts,
    }, {
      headers: withCache({}, CACHE_PRIVATE_REVALIDATE),
    });
  } catch (error) {
    console.error('Fetch reservations error:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}
