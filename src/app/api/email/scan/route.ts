import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchConfirmationEmails, fetchMessageBodies } from '@/lib/nylas';
import { parseEmailBatch } from '@/lib/email-parser';
import { matchReservationsToTrips } from '@/lib/trip-matcher';
import { searchPlace } from '@/lib/places';
import { RESERVATION_SEARCH_QUERIES } from '@/types/email';

/**
 * Background worker: parse a batch of messages and create EmailReservation records.
 * Updates the EmailScan record with progress as it goes.
 */
async function parseMessagesInBackground(
  scanId: string,
  userId: string,
  grantId: string,
  messageIds: string[]
) {
  const BATCH_SIZE = 15;
  let totalParsed = 0;
  let totalReservations = 0;

  try {
    // Update status to 'parsing'
    await prisma.emailScan.update({
      where: { id: scanId },
      data: { status: 'parsing' },
    });

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);

      try {
        // Fetch full message bodies from Nylas
        const messages = await fetchMessageBodies(grantId, batch, 5);

        // Parse with Claude
        const parseResults = await parseEmailBatch(messages, 3);

        // Process results into EmailReservation records
        const reservationsToCreate: Parameters<typeof prisma.emailReservation.create>[0]['data'][] = [];

        for (const result of parseResults) {
          if (result.skipped || result.reservations.length === 0) continue;

          for (const res of result.reservations) {
            if (res.confidence < 0.4) continue;

            let googlePlaceId: string | undefined;
            if (res.placeName && res.location && res.placeType !== 'flight') {
              try {
                const placeResult = await searchPlace(`${res.placeName} ${res.location}`);
                if (placeResult) googlePlaceId = placeResult.id;
              } catch { /* best-effort */ }
            }

            reservationsToCreate.push({
              userId,
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

        // Create records
        for (const data of reservationsToCreate) {
          await prisma.emailReservation.create({ data });
        }

        totalParsed += messages.length;
        totalReservations += reservationsToCreate.length;

        // Update progress in DB
        await prisma.emailScan.update({
          where: { id: scanId },
          data: {
            emailsParsed: totalParsed,
            reservationsFound: totalReservations,
          },
        });

        console.log(`[email-scan] Batch ${Math.floor(i / BATCH_SIZE) + 1}: parsed ${messages.length} → ${reservationsToCreate.length} reservations`);
      } catch (batchErr) {
        console.error(`[email-scan] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchErr);
      }
    }

    // Match reservations to trips
    try {
      const createdReservations = await prisma.emailReservation.findMany({
        where: { emailScanId: scanId },
      });

      if (createdReservations.length > 0) {
        const trips = await prisma.trip.findMany({
          where: { userId },
          select: { id: true, name: true, location: true, startDate: true, endDate: true, destinations: true, days: true },
        });

        const matches = matchReservationsToTrips(
          createdReservations.map((r) => ({
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
    } catch (matchErr) {
      console.error('[email-scan] Trip matching failed:', matchErr);
    }

    // Mark as completed
    await prisma.emailScan.update({
      where: { id: scanId },
      data: {
        status: 'completed',
        emailsParsed: totalParsed,
        reservationsFound: totalReservations,
        completedAt: new Date(),
      },
    });

    console.log(`[email-scan] Complete: ${totalParsed} parsed → ${totalReservations} reservations`);
  } catch (error) {
    console.error('[email-scan] Background parse failed:', error);
    await prisma.emailScan.update({
      where: { id: scanId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Parse failed',
        completedAt: new Date(),
      },
    }).catch(() => {});
  }
}

/**
 * POST /api/email/scan
 *
 * Triggers a scan + parse pipeline. Returns immediately after finding emails,
 * then parses them in the background. Poll GET /api/email/scan/[scanId] for progress.
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const scanType = body.scanType || 'full';
    const sinceDays = body.sinceDays || (scanType === 'incremental' ? 30 : 365);

    // ── Resolve Nylas grant ──────────────────────────────────────────────
    const grant = await prisma.nylasGrant.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    let resolvedGrant = grant;

    if (!resolvedGrant) {
      const cookieGrantId = request.cookies.get('nylas_grant_id')?.value;
      if (!cookieGrantId) {
        return NextResponse.json(
          { error: 'No email account connected. Please connect Gmail first.' },
          { status: 400 }
        );
      }

      resolvedGrant = await prisma.nylasGrant.upsert({
        where: { grantId: cookieGrantId },
        create: { userId: user.id, grantId: cookieGrantId, email: user.email || '', provider: 'google' },
        update: { userId: user.id },
      });
    }

    // ── Create scan record ───────────────────────────────────────────────
    const receivedAfter = Math.floor(Date.now() / 1000) - (sinceDays * 86400);

    const scan = await prisma.emailScan.create({
      data: {
        userId: user.id,
        nylasGrantId: resolvedGrant.id,
        status: 'scanning',
        scanType,
        scanFrom: new Date(receivedAfter * 1000),
        scanTo: new Date(),
      },
    });

    // ── Search for emails (this part we wait for) ────────────────────────
    const { messages, queriesRun } = await searchConfirmationEmails(
      resolvedGrant.grantId,
      RESERVATION_SEARCH_QUERIES,
      { limit: 25, receivedAfter }
    );

    // Update scan with email count
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: { emailsFound: messages.length },
    });

    // ── Kick off parsing in background (fire-and-forget) ────────────────
    if (messages.length > 0) {
      const messageIds = messages.map(m => m.id);
      // Don't await — let it run in the background
      parseMessagesInBackground(scan.id, user.id, resolvedGrant.grantId, messageIds)
        .catch(err => console.error('[email-scan] Background parse error:', err));

      // Update status to parsing (background will set to completed when done)
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { status: 'parsing' },
      });
    } else {
      // No emails found — mark as completed immediately
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { status: 'completed', completedAt: new Date() },
      });
    }

    // ── Return immediately ───────────────────────────────────────────────
    return NextResponse.json({
      scanId: scan.id,
      status: messages.length > 0 ? 'parsing' : 'completed',
      emailsFound: messages.length,
      queriesRun,
    });
  } catch (error) {
    console.error('Email scan error:', error);
    return NextResponse.json({ error: 'Failed to scan emails' }, { status: 500 });
  }
}

/**
 * GET /api/email/scan
 *
 * Returns the user's scan history with reservation counts.
 */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const scans = await prisma.emailScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { reservations: true } },
        reservations: {
          orderBy: { reservationDate: 'asc' },
          select: {
            id: true, status: true, placeName: true, placeType: true,
            location: true, reservationDate: true, provider: true,
            confidence: true, matchedTripName: true,
          },
        },
      },
    });

    return NextResponse.json({
      scans: scans.map((s) => ({
        id: s.id,
        status: s.status,
        scanType: s.scanType,
        emailsFound: s.emailsFound,
        emailsParsed: s.emailsParsed,
        reservationsFound: s._count.reservations,
        scanFrom: s.scanFrom?.toISOString(),
        scanTo: s.scanTo?.toISOString(),
        createdAt: s.createdAt.toISOString(),
        completedAt: s.completedAt?.toISOString(),
        reservations: s.reservations,
      })),
    });
  } catch (error) {
    console.error('Email scan history error:', error);
    return NextResponse.json({ error: 'Failed to fetch scan history' }, { status: 500 });
  }
}
