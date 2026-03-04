import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchPlace, mapGoogleTypeToPlaceType } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';

/**
 * PATCH /api/email/reservations/[id]
 *
 * Update a staged reservation's status. Used for:
 *   - Confirming: creates a SavedPlace in the user's library
 *   - Dismissing: marks as dismissed
 *   - Editing: updates reservation details before confirming
 *
 * Body:
 *   { action: 'confirm' | 'dismiss' | 'edit', edits?: Partial<Reservation> }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const { action, edits } = body;

    // Verify ownership
    const reservation = await prisma.emailReservation.findFirst({
      where: { id, userId: user.id },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // ── DISMISS ──────────────────────────────────────────────────────────
    if (action === 'dismiss') {
      const updated = await prisma.emailReservation.update({
        where: { id },
        data: { status: 'dismissed', reviewedAt: new Date() },
      });
      return NextResponse.json({ id: updated.id, status: 'dismissed' });
    }

    // ── EDIT (update fields, keep pending) ───────────────────────────────
    if (action === 'edit' && edits) {
      const allowedFields = [
        'placeName', 'placeType', 'location', 'reservationDate', 'reservationTime',
        'partySize', 'confirmationNumber', 'provider', 'flightNumber',
        'departureAirport', 'arrivalAirport', 'departureTime', 'arrivalTime',
        'checkInDate', 'checkOutDate', 'activityDetails',
      ];
      const safeEdits: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in edits) {
          // Handle date fields
          if (['reservationDate', 'checkInDate', 'checkOutDate'].includes(key) && edits[key]) {
            safeEdits[key] = new Date(edits[key]);
          } else {
            safeEdits[key] = edits[key];
          }
        }
      }

      const updated = await prisma.emailReservation.update({
        where: { id },
        data: safeEdits,
      });
      return NextResponse.json({ id: updated.id, status: updated.status });
    }

    // ── CONFIRM → create SavedPlace ──────────────────────────────────────
    if (action === 'confirm') {
      // Resolve Google Place data if we don't have it yet
      let googleData: Record<string, unknown> | null = null;
      let googlePlaceId = reservation.googlePlaceId;

      if (!googlePlaceId && reservation.placeType !== 'flight') {
        try {
          const placeResult = await searchPlace(
            `${reservation.placeName} ${reservation.location || ''}`
          );
          if (placeResult) {
            googlePlaceId = placeResult.id;
            googleData = placeResult as unknown as Record<string, unknown>;
          }
        } catch {
          // Best effort
        }
      }

      // Create SavedPlace in user's library
      const savedPlace = await prisma.savedPlace.create({
        data: {
          userId: user.id,
          name: reservation.placeName,
          type: reservation.placeType,
          location: reservation.location || '',
          googlePlaceId: googlePlaceId || null,
          googleData: (googleData as import('@prisma/client').Prisma.InputJsonValue) || undefined,
          source: {
            type: 'email',
            name: reservation.provider || reservation.emailFromName || reservation.emailFrom,
            url: undefined,
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
          importSources: [
            {
              type: 'email',
              name: `${reservation.provider || 'Email'}: ${reservation.emailSubject}`,
              importedAt: new Date().toISOString(),
            },
          ],
          // Store reservation-specific data in userContext
          userContext: buildUserContext(reservation),
        },
      });

      // Update the EmailReservation with the link
      await prisma.emailReservation.update({
        where: { id },
        data: {
          status: 'confirmed',
          reviewedAt: new Date(),
          savedPlaceId: savedPlace.id,
          googlePlaceId: googlePlaceId || reservation.googlePlaceId,
        },
      });

      // Fire-and-forget enrichment
      if (googlePlaceId) {
        // Derive placeType from Google result if available, else from reservation
        const emailPlaceType = googleData
          ? mapGoogleTypeToPlaceType((googleData as any).primaryType)
          : reservation.placeType || undefined;
        ensureEnrichment(googlePlaceId, reservation.placeName, user.id, 'email_single_confirm', emailPlaceType)
          .catch(err => console.error('[email-confirm] enrichment error:', err));
      }

      return NextResponse.json({
        id: reservation.id,
        status: 'confirmed',
        savedPlaceId: savedPlace.id,
        matchedTripId: reservation.matchedTripId,
        matchedTripName: reservation.matchedTripName,
        suggestedDayNumber: reservation.suggestedDayNumber,
        suggestedSlotId: reservation.suggestedSlotId,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Reservation update error:', error);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
