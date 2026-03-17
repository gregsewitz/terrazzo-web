import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

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

    const reservations = await prisma.emailReservation.findMany({
      where,
      orderBy: [
        { reservationDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

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
      counts: {
        pending: await prisma.emailReservation.count({ where: { userId: user.id, status: 'pending' } }),
        confirmed: await prisma.emailReservation.count({ where: { userId: user.id, status: 'confirmed' } }),
        dismissed: await prisma.emailReservation.count({ where: { userId: user.id, status: 'dismissed' } }),
      },
    });
  } catch (error) {
    console.error('Fetch reservations error:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}
