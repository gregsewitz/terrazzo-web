import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchPlace } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { Prisma } from '@prisma/client';
import type { ReactionId } from '@/types';

/**
 * POST /api/email/reservations/batch-confirm
 *
 * Batch-confirm selected email reservations:
 *   1. Create SavedPlace in user's library for each
 *   2. Fire-and-forget enrichment pipeline per place
 *   3. Optionally link places to trip pool
 *   4. Optionally attach ratings
 *
 * Body:
 *   {
 *     reservationIds: string[];
 *     tripLinks: Record<string, { tripId: string; dayNumber?: number; slotId?: string }>;
 *     ratings: Record<string, ReactionId>;
 *   }
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { reservationIds, tripLinks = {}, ratings = {} } = body as {
      reservationIds: string[];
      tripLinks: Record<string, { tripId: string; dayNumber?: number; slotId?: string }>;
      ratings: Record<string, ReactionId>;
    };

    if (!reservationIds?.length) {
      return NextResponse.json({ error: 'No reservation IDs provided' }, { status: 400 });
    }

    // Fetch all reservations (verify ownership)
    const reservations = await prisma.emailReservation.findMany({
      where: {
        id: { in: reservationIds },
        userId: user.id,
        status: 'pending',
      },
    });

    if (reservations.length === 0) {
      return NextResponse.json({ error: 'No pending reservations found' }, { status: 404 });
    }

    const savedPlaceIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    let enrichmentTriggered = 0;

    // Group trip-linked items by tripId for batch pool update
    const tripPoolItems: Record<string, Array<{
      id: string;
      name: string;
      type: string;
      location: string;
      googlePlaceId?: string;
      libraryPlaceId: string;
      source: { type: string; name: string };
      status: 'available';
      dayNumber?: number;
      slotId?: string;
    }>> = {};

    // Process each reservation
    const results = await Promise.allSettled(
      reservations.map(async (reservation) => {
        // 1. Resolve googlePlaceId if missing (best-effort)
        let googlePlaceId = reservation.googlePlaceId;
        let googleData: Record<string, unknown> | null = null;

        if (!googlePlaceId && reservation.placeType !== 'flight') {
          try {
            const searchQuery = `${reservation.placeName} ${reservation.location || ''}`.trim();
            const placeResult = await searchPlace(searchQuery, undefined, reservation.placeName);
            if (placeResult) {
              googlePlaceId = placeResult.id;
              googleData = placeResult as unknown as Record<string, unknown>;
              console.log(`[batch-confirm] Resolved "${reservation.placeName}" → ${placeResult.id}`);
            } else {
              console.warn(`[batch-confirm] searchPlace returned null for "${searchQuery}"`);
            }
          } catch (searchErr) {
            console.error(`[batch-confirm] searchPlace failed for "${reservation.placeName}":`, searchErr);
          }
        }

        // 2. Build rating if provided
        const reactionId = ratings[reservation.id];
        const ratingData = reactionId ? {
          reaction: reactionId,
          ratedAt: new Date().toISOString(),
        } : undefined;

        // 3. Create or reuse SavedPlace
        //    - With googlePlaceId: dedup via unique constraint (userId, googlePlaceId)
        //    - Without googlePlaceId: dedup by (userId, name, location) to avoid
        //      creating duplicates from multiple emails about the same rental
        let savedPlace: { id: string };

        const sourceEntry = {
          type: 'email',
          name: `${reservation.provider || 'Email'}: ${reservation.emailSubject}`,
          importedAt: new Date().toISOString(),
        };

        if (googlePlaceId) {
          savedPlace = await prisma.savedPlace.upsert({
            where: {
              userId_googlePlaceId: { userId: user.id, googlePlaceId },
            },
            create: {
              userId: user.id,
              name: reservation.placeName,
              type: reservation.placeType,
              location: reservation.location || '',
              googlePlaceId,
              googleData: (googleData as Prisma.InputJsonValue) || undefined,
              source: {
                type: 'email',
                name: reservation.provider || reservation.emailFromName || reservation.emailFrom,
              },
              ghostSource: 'email',
              intentStatus: 'booked',
              timing: reservation.reservationDate
                ? new Date(reservation.reservationDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : undefined,
              importSources: [sourceEntry],
              userContext: buildUserContext(reservation),
              ...(ratingData ? { rating: ratingData as unknown as Prisma.InputJsonValue } : {}),
            },
            update: {
              // Re-import: update enrichment data, preserve user edits
              deletedAt: null,
              ...(googleData ? { googleData: googleData as Prisma.InputJsonValue } : {}),
            },
          });
        } else {
          // No googlePlaceId — check for existing by name+location to avoid duplicates
          const existing = await prisma.savedPlace.findFirst({
            where: {
              userId: user.id,
              name: { equals: reservation.placeName, mode: 'insensitive' },
              location: reservation.location || '',
              googlePlaceId: null,
              deletedAt: null,
            },
            select: { id: true },
          });

          if (existing) {
            savedPlace = existing;
            console.log(`[batch-confirm] Reusing existing SavedPlace for "${reservation.placeName}" (no googlePlaceId)`);
          } else {
            savedPlace = await prisma.savedPlace.create({
              data: {
                userId: user.id,
                name: reservation.placeName,
                type: reservation.placeType,
                location: reservation.location || '',
                googlePlaceId: null,
                source: {
                  type: 'email',
                  name: reservation.provider || reservation.emailFromName || reservation.emailFrom,
                },
                ghostSource: 'email',
                intentStatus: 'booked',
                timing: reservation.reservationDate
                  ? new Date(reservation.reservationDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : undefined,
                importSources: [sourceEntry],
                userContext: buildUserContext(reservation),
                ...(ratingData ? { rating: ratingData as unknown as Prisma.InputJsonValue } : {}),
              },
            });
          }
        }

        savedPlaceIds.push(savedPlace.id);

        // 4. Update EmailReservation status
        await prisma.emailReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'confirmed',
            reviewedAt: new Date(),
            savedPlaceId: savedPlace.id,
            googlePlaceId: googlePlaceId || reservation.googlePlaceId,
          },
        });

        // 5. Fire-and-forget enrichment
        if (googlePlaceId) {
          ensureEnrichment(googlePlaceId, reservation.placeName, user.id, 'email_batch_import', reservation.placeType || undefined)
            .then(() => { enrichmentTriggered++; })
            .catch(err => console.error(`[batch-confirm] enrichment error for ${reservation.placeName}:`, err));
        }

        // 6. Collect trip pool items
        const tripLink = tripLinks[reservation.id];
        if (tripLink?.tripId) {
          if (!tripPoolItems[tripLink.tripId]) tripPoolItems[tripLink.tripId] = [];
          tripPoolItems[tripLink.tripId].push({
            id: `email-${reservation.id}-${Date.now()}`,
            name: reservation.placeName,
            type: reservation.placeType,
            location: reservation.location || '',
            googlePlaceId: googlePlaceId || undefined,
            libraryPlaceId: savedPlace.id,
            source: { type: 'email', name: reservation.provider || 'Email' },
            status: 'available' as const,
            dayNumber: tripLink.dayNumber,
            slotId: tripLink.slotId,
          });
        }

        return savedPlace.id;
      })
    );

    // Count errors
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        errors.push({
          id: reservations[i].id,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    // 7. Add items to trip pools (batch per trip)
    for (const [tripId, items] of Object.entries(tripPoolItems)) {
      try {
        const trip = await prisma.trip.findFirst({
          where: { id: tripId, userId: user.id },
          select: { id: true, pool: true },
        });

        if (trip) {
          const existingPool = (trip.pool as unknown[] || []) as Array<Record<string, unknown>>;
          const newPool = [...existingPool, ...items];

          await prisma.trip.update({
            where: { id: tripId },
            data: { pool: newPool as unknown as Prisma.InputJsonValue },
          });
        }
      } catch (err) {
        console.error(`[batch-confirm] Failed to add items to trip ${tripId}:`, err);
        // Don't fail the batch — trip linking is best-effort
      }
    }

    return NextResponse.json({
      confirmed: savedPlaceIds.length,
      savedPlaceIds,
      enrichmentTriggered,
      errors,
    });
  } catch (error) {
    console.error('Batch confirm error:', error);
    return NextResponse.json({ error: 'Batch confirm failed' }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildUserContext(reservation: {
  placeType: string;
  reservationTime: string | null;
  partySize: number | null;
  confirmationNumber: string | null;
  flightNumber: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  activityDetails: string | null;
}): string {
  const parts: string[] = [];

  if (reservation.confirmationNumber) {
    parts.push(`Confirmation: ${reservation.confirmationNumber}`);
  }
  if (reservation.partySize) {
    parts.push(`Party of ${reservation.partySize}`);
  }
  if (reservation.reservationTime) {
    parts.push(`Time: ${reservation.reservationTime}`);
  }
  if (reservation.flightNumber) {
    parts.push(`Flight ${reservation.flightNumber}`);
    if (reservation.departureAirport && reservation.arrivalAirport) {
      parts.push(`${reservation.departureAirport} → ${reservation.arrivalAirport}`);
    }
  }
  if (reservation.checkInDate && reservation.checkOutDate) {
    const nights = Math.ceil(
      (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    parts.push(`${nights} night${nights > 1 ? 's' : ''}`);
  }
  if (reservation.activityDetails) {
    parts.push(reservation.activityDetails);
  }

  return parts.join(' · ');
}
