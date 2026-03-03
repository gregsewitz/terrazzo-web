import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { fetchMessageBodies } from '@/lib/nylas';
import { parseEmailBatch } from '@/lib/email-parser';
import { matchReservationsToTrips } from '@/lib/trip-matcher';
import { searchPlace } from '@/lib/places';

/**
 * POST /api/email/parse
 *
 * Takes a scan ID and list of message IDs, fetches full bodies via Nylas,
 * parses them with Claude, resolves Google Places, matches to trips,
 * and stores results as EmailReservation records in the staging inbox.
 *
 * Body:
 *   { scanId: string, messageIds: string[] }
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const { scanId, messageIds } = await request.json();

    if (!scanId || !messageIds?.length) {
      return NextResponse.json(
        { error: 'scanId and messageIds are required' },
        { status: 400 }
      );
    }

    // ── Validate scan belongs to user ────────────────────────────────────
    const scan = await prisma.emailScan.findFirst({
      where: { id: scanId, userId: user.id },
      include: { nylasGrant: true },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // ── Fetch full message bodies from Nylas ─────────────────────────────
    const messages = await fetchMessageBodies(scan.nylasGrant.grantId, messageIds, 5);

    // ── Parse emails with Claude ─────────────────────────────────────────
    const parseResults = await parseEmailBatch(messages, 3);

    // ── Resolve Google Places for each extracted reservation ─────────────
    const reservationsToCreate: Parameters<typeof prisma.emailReservation.create>[0]['data'][] = [];

    for (const result of parseResults) {
      if (result.skipped || result.reservations.length === 0) continue;

      for (const res of result.reservations) {
        // Skip low-confidence extractions
        if (res.confidence < 0.4) continue;

        // Try to resolve Google Place ID
        let googlePlaceId: string | undefined;
        if (res.placeName && res.location && res.placeType !== 'flight') {
          try {
            const placeResult = await searchPlace(`${res.placeName} ${res.location}`);
            if (placeResult) {
              googlePlaceId = placeResult.id;
            }
          } catch {
            // Google Places lookup is best-effort
          }
        }

        reservationsToCreate.push({
          userId: user.id,
          emailScanId: scanId,
          nylasMessageId: result.nylasMessageId,
          emailSubject: result.emailSubject,
          emailFrom: result.emailFrom,
          emailFromName: result.emailFromName || null,
          emailDate: new Date(result.emailDate),
          placeName: res.placeName,
          placeType: res.placeType,
          location: res.location || null,
          googlePlaceId: googlePlaceId || null,
          reservationDate: res.reservationDate ? new Date(res.reservationDate) : null,
          reservationTime: res.reservationTime || null,
          partySize: res.partySize || null,
          confirmationNumber: res.confirmationNumber || null,
          provider: res.provider || null,
          flightNumber: res.flightNumber || null,
          departureAirport: res.departureAirport || null,
          arrivalAirport: res.arrivalAirport || null,
          departureTime: res.departureTime || null,
          arrivalTime: res.arrivalTime || null,
          checkInDate: res.checkInDate ? new Date(res.checkInDate) : null,
          checkOutDate: res.checkOutDate ? new Date(res.checkOutDate) : null,
          activityDetails: res.activityDetails || null,
          confidence: res.confidence,
          rawExtraction: JSON.parse(JSON.stringify(res)),
          status: 'pending',
        });
      }
    }

    // ── Batch create reservation records ──────────────────────────────────
    const created: string[] = [];
    for (const data of reservationsToCreate) {
      const record = await prisma.emailReservation.create({ data });
      created.push(record.id);
    }

    // ── Match reservations to existing trips ─────────────────────────────
    if (created.length > 0) {
      const reservations = await prisma.emailReservation.findMany({
        where: { id: { in: created } },
      });

      const trips = await prisma.trip.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          destinations: true,
          days: true,
        },
      });

      const matches = matchReservationsToTrips(
        reservations.map((r) => ({
          id: r.id,
          placeName: r.placeName,
          placeType: r.placeType,
          location: r.location,
          reservationDate: r.reservationDate?.toISOString() || null,
          reservationTime: r.reservationTime,
          checkInDate: r.checkInDate?.toISOString() || null,
          checkOutDate: r.checkOutDate?.toISOString() || null,
          departureAirport: r.departureAirport,
          arrivalAirport: r.arrivalAirport,
        })),
        trips.map((t) => ({
          id: t.id,
          name: t.name,
          location: t.location,
          startDate: t.startDate ? (t.startDate instanceof Date ? t.startDate.toISOString() : String(t.startDate)) : null,
          endDate: t.endDate ? (t.endDate instanceof Date ? t.endDate.toISOString() : String(t.endDate)) : null,
          destinations: (t.destinations as string[]) || [],
          days: t.days as unknown as { dayNumber: number; date?: string; destination?: string }[],
        }))
      );

      // Update reservations with trip match data
      for (const match of matches) {
        await prisma.emailReservation.update({
          where: { id: match.reservationId },
          data: {
            matchedTripId: match.tripId,
            matchedTripName: match.tripName,
            suggestedDayNumber: match.dayNumber,
            suggestedSlotId: match.slotId,
          },
        });
      }
    }

    // ── Update scan record ───────────────────────────────────────────────
    await prisma.emailScan.update({
      where: { id: scanId },
      data: {
        emailsParsed: messages.length,
        reservationsFound: created.length,
      },
    });

    // ── Return staged reservations ───────────────────────────────────────
    const stagedReservations = await prisma.emailReservation.findMany({
      where: { id: { in: created } },
      orderBy: { reservationDate: 'asc' },
    });

    return NextResponse.json({
      scanId,
      parsed: messages.length,
      reservationsCreated: created.length,
      reservations: stagedReservations.map((r) => ({
        id: r.id,
        status: r.status,
        placeName: r.placeName,
        placeType: r.placeType,
        location: r.location,
        reservationDate: r.reservationDate?.toISOString(),
        reservationTime: r.reservationTime,
        partySize: r.partySize,
        confirmationNumber: r.confirmationNumber,
        provider: r.provider,
        confidence: r.confidence,
        emailSubject: r.emailSubject,
        emailFrom: r.emailFrom,
        emailDate: r.emailDate.toISOString(),
        matchedTripId: r.matchedTripId,
        matchedTripName: r.matchedTripName,
        suggestedDayNumber: r.suggestedDayNumber,
        suggestedSlotId: r.suggestedSlotId,
        flightNumber: r.flightNumber,
        departureAirport: r.departureAirport,
        arrivalAirport: r.arrivalAirport,
        checkInDate: r.checkInDate?.toISOString(),
        checkOutDate: r.checkOutDate?.toISOString(),
        activityDetails: r.activityDetails,
      })),
    });
  } catch (error) {
    console.error('Email parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse emails' },
      { status: 500 }
    );
  }
}
