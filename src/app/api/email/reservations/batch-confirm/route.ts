import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { resolveGooglePlace } from '@/lib/resolve-place';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { completeTasteFields } from '@/lib/taste-completion';
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
    const { reservationIds, tripLinks = {}, ratings = {}, collectionLinks = {} } = body as {
      reservationIds: string[];
      tripLinks: Record<string, { tripId: string; dayNumber?: number; slotId?: string }>;
      ratings: Record<string, ReactionId>;
      collectionLinks: Record<string, string>; // reservationId → collectionId
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
    const reservationToSavedPlace: Record<string, string> = {}; // reservationId → savedPlaceId
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
      reservationDate?: string; // ISO date for day matching
      reservationTime?: string; // "HH:mm" for slot matching
    }>> = {};

    // Process each reservation
    const results = await Promise.allSettled(
      reservations.map(async (reservation: any) => {
        // 1. Resolve googlePlaceId if missing (best-effort)
        let googlePlaceId = reservation.googlePlaceId;
        let googleData: Record<string, unknown> | null = null;

        if (!googlePlaceId) {
          const placeResult = await resolveGooglePlace(
            reservation.placeName, reservation.location, reservation.placeType, 'batch-confirm',
          );
          if (placeResult) {
            googlePlaceId = placeResult.id;
            googleData = placeResult as unknown as Record<string, unknown>;
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
              source: JSON.stringify({
                type: 'email',
                name: reservation.provider || reservation.emailFromName || reservation.emailFrom,
              }),
              intentStatus: 'booked',
              timing: reservation.reservationDate
                ? new Date(reservation.reservationDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : undefined,
              importSources: [{ ...sourceEntry, bookingDetails: buildUserContext(reservation) || undefined }],
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
                source: JSON.stringify({
                  type: 'email',
                  name: reservation.provider || reservation.emailFromName || reservation.emailFrom,
                }),
                intentStatus: 'booked',
                timing: reservation.reservationDate
                  ? new Date(reservation.reservationDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : undefined,
                importSources: [{ ...sourceEntry, bookingDetails: buildUserContext(reservation) || undefined }],
                ...(ratingData ? { rating: ratingData as unknown as Prisma.InputJsonValue } : {}),
              },
            });
          }
        }

        savedPlaceIds.push(savedPlace.id);
        reservationToSavedPlace[reservation.id] = savedPlace.id;

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
            reservationDate: reservation.reservationDate?.toISOString() || reservation.checkInDate?.toISOString() || undefined,
            reservationTime: reservation.reservationTime || reservation.departureTime || undefined,
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

    // 7. Add items to trip — place into day grid when possible, otherwise pool
    for (const [tripId, items] of Object.entries(tripPoolItems)) {
      try {
        const trip = await prisma.trip.findFirst({
          where: { id: tripId, userId: user.id },
          select: { id: true, pool: true, days: true },
        });

        if (trip) {
          const existingPool = (trip.pool as unknown[] || []) as Array<Record<string, unknown>>;
          const days = (trip.days as unknown[] || []) as Array<{
            dayNumber: number;
            date?: string;
            slots: Array<{
              id: string;
              label: string;
              time: string;
              places: Array<Record<string, unknown>>;
              quickEntries?: unknown[];
              ghostItems?: unknown[];
            }>;
          }>;

          // Build dedup sets from placed items across all day slots
          const placedGoogleIds = new Set<string>();
          const placedLibraryIds = new Set<string>();
          const placedNames = new Set<string>();
          for (const day of days) {
            for (const slot of (day.slots || [])) {
              for (const p of (slot.places || [])) {
                if (p.googlePlaceId) placedGoogleIds.add(p.googlePlaceId as string);
                if (p.libraryPlaceId) placedLibraryIds.add(p.libraryPlaceId as string);
                if (p.name) placedNames.add((p.name as string).toLowerCase());
              }
            }
          }

          // Dedup sets from pool
          const poolGoogleIds = new Set(existingPool.map(p => p.googlePlaceId).filter(Boolean) as string[]);
          const poolLibraryIds = new Set(existingPool.map(p => p.libraryPlaceId).filter(Boolean) as string[]);
          const poolNames = new Set(existingPool.map(p => (p.name as string || '').toLowerCase()).filter(Boolean));

          const dedupedItems = items.filter(item => {
            if (item.googlePlaceId) {
              if (poolGoogleIds.has(item.googlePlaceId) || placedGoogleIds.has(item.googlePlaceId)) {
                console.log(`[batch-confirm] Skipping "${item.name}" — already in trip (googlePlaceId match)`);
                return false;
              }
            }
            if (poolLibraryIds.has(item.libraryPlaceId) || placedLibraryIds.has(item.libraryPlaceId)) {
              console.log(`[batch-confirm] Skipping "${item.name}" — already in trip (libraryPlaceId match)`);
              return false;
            }
            if (poolNames.has(item.name.toLowerCase()) || placedNames.has(item.name.toLowerCase())) {
              console.log(`[batch-confirm] Skipping "${item.name}" — already in trip (name match)`);
              return false;
            }
            return true;
          });

          if (dedupedItems.length > 0) {
            // Build a date→dayIndex map for matching reservation dates to trip days
            const dateToDayIdx = new Map<string, number>();
            for (let i = 0; i < days.length; i++) {
              if (days[i].date) {
                // Normalize to YYYY-MM-DD
                const dateStr = days[i].date!.split('T')[0];
                dateToDayIdx.set(dateStr, i);
              }
            }

            const poolItems: Array<Record<string, unknown>> = [];
            let daysModified = false;

            for (const item of dedupedItems) {
              let placed = false;

              // Try to place into the correct day/slot if we have a reservation date
              if (item.reservationDate && dateToDayIdx.size > 0) {
                const itemDate = item.reservationDate.split('T')[0];
                const dayIdx = dateToDayIdx.get(itemDate);

                if (dayIdx !== undefined && days[dayIdx].slots?.length > 0) {
                  // Determine the best slot based on reservation time + place type
                  const slotId = inferSlotId(item.reservationTime || null, item.type);
                  const slotIdx = days[dayIdx].slots.findIndex(s => s.id === slotId);
                  const targetSlot = slotIdx >= 0 ? slotIdx : 0;

                  // Build an ImportedPlace-compatible object
                  const placeEntry = {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    location: item.location,
                    googlePlaceId: item.googlePlaceId || undefined,
                    libraryPlaceId: item.libraryPlaceId,
                    source: item.source,
                    matchScore: 0,
                    matchBreakdown: {},
                    status: 'available',
                    intentStatus: 'booked',
                    placedIn: { day: days[dayIdx].dayNumber, slot: days[dayIdx].slots[targetSlot].id },
                    ...(item.reservationTime ? { specificTime: item.reservationTime, specificTimeLabel: 'Reservation' } : {}),
                  };

                  days[dayIdx].slots[targetSlot].places.push(placeEntry as unknown as Record<string, unknown>);
                  daysModified = true;
                  placed = true;
                  console.log(`[batch-confirm] Placed "${item.name}" into day ${days[dayIdx].dayNumber}, slot ${days[dayIdx].slots[targetSlot].id}`);
                }
              }

              // If not placed into a day, add to pool
              if (!placed) {
                const { reservationDate: _rd, reservationTime: _rt, ...poolItem } = item;
                poolItems.push(poolItem);
              }
            }

            // Build the update data
            const updateData: Record<string, unknown> = {};
            if (poolItems.length > 0) {
              updateData.pool = [...existingPool, ...poolItems] as unknown as Prisma.InputJsonValue;
            }
            if (daysModified) {
              updateData.days = days as unknown as Prisma.InputJsonValue;
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.trip.update({
                where: { id: tripId },
                data: updateData,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[batch-confirm] Failed to add items to trip ${tripId}:`, err);
        // Don't fail the batch — trip linking is best-effort
      }
    }

    // 8. Add places to collections (per-reservation collection links)
    if (Object.keys(collectionLinks).length > 0) {
      // Group savedPlaceIds by collectionId
      const collectionPlaceGroups: Record<string, string[]> = {};
      for (const [resId, colId] of Object.entries(collectionLinks)) {
        const spId = reservationToSavedPlace[resId];
        if (!spId) continue;
        if (!collectionPlaceGroups[colId]) collectionPlaceGroups[colId] = [];
        collectionPlaceGroups[colId].push(spId);
      }

      // Batch-update each collection
      for (const [collectionId, placeIdsToAdd] of Object.entries(collectionPlaceGroups)) {
        try {
          const collection = await prisma.shortlist.findFirst({
            where: { id: collectionId, userId: user.id },
            select: { id: true, placeIds: true },
          });
          if (collection) {
            const existing = Array.isArray(collection.placeIds) ? collection.placeIds as string[] : [];
            const merged = [...new Set([...existing, ...placeIdsToAdd])];
            await prisma.shortlist.update({
              where: { id: collectionId },
              data: { placeIds: merged },
            });
          }
        } catch (err) {
          console.error(`[batch-confirm] Failed to add places to collection ${collectionId}:`, err);
        }
      }
    }

    // 9. Fire-and-forget: generate taste fields for all newly created places
    if (savedPlaceIds.length > 0) {
      const newlyCreated = await prisma.savedPlace.findMany({
        where: { id: { in: savedPlaceIds } },
        select: { id: true, name: true, type: true, location: true },
      });
      completeTasteFields(
        newlyCreated.map((p: any) => ({
          savedPlaceId: p.id,
          name: p.name,
          type: p.type,
          location: p.location || undefined,
        })),
        user.id,
      ).catch(err => console.error('[batch-confirm] taste completion error:', err));
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

/**
 * Infer the best time slot for a reservation based on its time and place type.
 * Slots: breakfast | morning | lunch | afternoon | dinner | evening
 */
function inferSlotId(time: string | null, placeType: string): string {
  // If we have a specific time, use it directly
  if (time) {
    const [h] = time.split(':').map(Number);
    if (h < 10) return 'breakfast';
    if (h < 12) return 'morning';
    if (h < 14) return 'lunch';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'dinner';
    return 'evening';
  }

  // Fall back to place type heuristics
  const t = placeType.toLowerCase();
  if (t === 'hotel' || t === 'accommodation' || t === 'rental') return 'afternoon'; // check-in
  if (t === 'flight') return 'morning'; // default for flights
  if (t === 'restaurant') return 'dinner'; // most restaurant bookings are dinner
  if (t === 'bar') return 'evening';
  if (t === 'cafe' || t === 'coffee') return 'morning';
  if (t === 'activity' || t === 'tour' || t === 'experience') return 'morning';
  return 'afternoon'; // generic fallback
}

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

  // Note: confirmation numbers are stored in importSources.bookingDetails
  // for reference but excluded from userContext (which shows on place cards).
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
