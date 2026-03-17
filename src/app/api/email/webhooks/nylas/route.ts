import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { fetchMessage } from '@/lib/nylas';
import { parseEmailForReservations } from '@/lib/email-parser';
import { matchReservationsToTrips } from '@/lib/trip-matcher';
import { resolveGooglePlaceId } from '@/lib/resolve-place';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { RESERVATION_SEARCH_QUERIES } from '@/types/email';
import { EMAIL_CONFIDENCE_THRESHOLD } from '@/lib/constants';

/**
 * GET /api/email/webhooks/nylas
 *
 * Nylas webhook challenge verification.
 * When registering a webhook, Nylas sends a GET request with a `challenge`
 * query parameter. We must return the challenge value as plain text with 200.
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (!challenge) {
    return new Response('Missing challenge parameter', { status: 400 });
  }

  // Return the challenge as plain text, no extra data, no chunked encoding
  return new Response(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ─── Sender/subject patterns for quick filtering ─────────────────────────────

// Build a set of known sender domains from RESERVATION_SEARCH_QUERIES
const KNOWN_SENDER_DOMAINS: string[] = [];
const SUBJECT_PATTERNS: RegExp[] = [];

for (const { query } of RESERVATION_SEARCH_QUERIES) {
  // Extract "from:domain.com" patterns
  const fromMatch = query.match(/from:(\S+)/);
  if (fromMatch) {
    KNOWN_SENDER_DOMAINS.push(fromMatch[1].toLowerCase());
  }
}

// Generic subject keywords that suggest a reservation email
const RESERVATION_SUBJECT_KEYWORDS = [
  'reservation confirmed',
  'reservation confirmation',
  'booking confirmed',
  'booking confirmation',
  'your reservation',
  'your booking',
  'confirmation number',
  'your itinerary',
  'e-ticket',
  'eticket',
  'boarding pass',
  'check-in',
  'trip confirmation',
  'travel confirmation',
];

/**
 * Quick check if a message is likely a reservation email.
 * Uses sender domain + subject keyword matching.
 * This avoids calling Claude for every single incoming email.
 */
function isLikelyReservation(fromEmail: string, subject: string): boolean {
  const lowerFrom = fromEmail.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // Check if sender matches known reservation platforms
  if (KNOWN_SENDER_DOMAINS.some((domain) => lowerFrom.includes(domain))) {
    return true;
  }

  // Check subject for reservation-like keywords
  if (RESERVATION_SUBJECT_KEYWORDS.some((kw) => lowerSubject.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * POST /api/email/webhooks/nylas
 *
 * Receives real-time webhook notifications from Nylas.
 * Handles message.created and message.created.truncated events.
 *
 * Flow:
 *   1. Verify HMAC signature
 *   2. Extract message metadata from payload
 *   3. Quick-filter: is this likely a reservation email?
 *   4. If yes: fetch full body, parse with Claude, create EmailReservation
 */
export async function POST(request: NextRequest) {
  // ── 0. Rate limit (defense-in-depth, especially when HMAC is disabled) ─
  const ip = getClientIp(request.headers);
  const rl = rateLimit(ip + ':nylas-webhook', { maxRequests: 60, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  // ── 1. Verify HMAC signature ───────────────────────────────────────────
  const webhookSecret = process.env.NYLAS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get('x-nylas-signature');
    if (!signature) {
      console.warn('[nylas-webhook] Missing x-nylas-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const rawBody = await request.text();
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[nylas-webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the body manually since we already consumed it
    try {
      const payload = JSON.parse(rawBody);
      return handleWebhookEvent(payload);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // If no webhook secret configured, still accept (dev mode) but log a warning
  console.warn('[nylas-webhook] No NYLAS_WEBHOOK_SECRET configured — accepting without verification');
  try {
    const payload = await request.json();
    return handleWebhookEvent(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

// ─── Webhook Event Handler ────────────────────────────────────────────────────

interface NylasWebhookPayload {
  specversion: string;
  type: string; // 'message.created' | 'message.created.truncated' | 'message.updated' etc.
  id: string;
  time: number;
  webhook_delivery_attempt: number;
  data: {
    application_id: string;
    object: {
      object: string; // 'message'
      id: string;       // Nylas message ID
      grant_id: string; // Nylas grant ID
      subject?: string;
      from?: { email: string; name?: string }[];
      to?: { email: string; name?: string }[];
      date?: number;
      snippet?: string;
      body?: string; // May be absent if truncated
    };
  };
}

async function handleWebhookEvent(payload: NylasWebhookPayload) {
  const { type, data } = payload;

  // Only process message creation events
  if (!type.startsWith('message.created') && !type.startsWith('message.updated')) {
    console.log(`[nylas-webhook] Ignoring event type: ${type}`);
    return NextResponse.json({ status: 'ignored', reason: `event type: ${type}` });
  }

  const msg = data.object;
  const grantId = msg.grant_id;
  const messageId = msg.id;
  const subject = msg.subject || '';
  const fromEmail = msg.from?.[0]?.email || '';
  const fromName = msg.from?.[0]?.name || '';

  console.log(`[nylas-webhook] ${type} — from: ${fromEmail}, subject: "${subject.slice(0, 80)}"`);

  // ── 2. Resolve the grant to a user ───────────────────────────────────────
  const grant = await prisma.nylasGrant.findUnique({
    where: { grantId },
  });

  if (!grant) {
    console.warn(`[nylas-webhook] Unknown grant_id: ${grantId}`);
    return NextResponse.json({ status: 'ignored', reason: 'unknown grant' });
  }

  // ── 3. Quick filter: is this likely a reservation? ───────────────────────
  if (!isLikelyReservation(fromEmail, subject)) {
    return NextResponse.json({ status: 'ignored', reason: 'not reservation-like' });
  }

  console.log(`[nylas-webhook] Likely reservation email detected — parsing...`);

  // ── 4. Check for duplicate (same Nylas message ID already processed) ─────
  const existing = await prisma.emailReservation.findFirst({
    where: {
      userId: grant.userId,
      nylasMessageId: messageId,
    },
  });

  if (existing) {
    console.log(`[nylas-webhook] Message ${messageId} already processed → skipping`);
    return NextResponse.json({ status: 'duplicate' });
  }

  // ── 5. Fetch full message body from Nylas ────────────────────────────────
  let fullMessage;
  try {
    fullMessage = await fetchMessage(grantId, messageId);
  } catch (err) {
    console.error(`[nylas-webhook] Failed to fetch message ${messageId}:`, err);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 502 });
  }

  // ── 6. Parse with Claude ─────────────────────────────────────────────────
  const parseResult = await parseEmailForReservations(fullMessage);

  if (parseResult.skipped || parseResult.reservations.length === 0) {
    console.log(`[nylas-webhook] No reservations extracted (skipped: ${parseResult.skipped}, reason: ${parseResult.skipReason})`);
    return NextResponse.json({ status: 'no_reservations', skipReason: parseResult.skipReason });
  }

  // ── 7. Create a webhook-driven "scan" record for provenance ──────────────
  const scan = await prisma.emailScan.create({
    data: {
      userId: grant.userId,
      nylasGrantId: grant.id,
      status: 'completed',
      scanType: 'webhook',
      emailsFound: 1,
      emailsParsed: 1,
      reservationsFound: parseResult.reservations.length,
      completedAt: new Date(),
    },
  });

  // ── 8. Create EmailReservation records ───────────────────────────────────
  const createdIds: string[] = [];

  for (const res of parseResult.reservations) {
    if (res.confidence < EMAIL_CONFIDENCE_THRESHOLD) continue;

    // Try to resolve Google Place ID
    const googlePlaceId = await resolveGooglePlaceId(
      res.placeName, res.location, res.placeType, 'nylas-webhook',
    );

    const record = await prisma.emailReservation.create({
      data: {
        userId: grant.userId,
        emailScanId: scan.id,
        nylasMessageId: messageId,
        emailSubject: parseResult.emailSubject,
        emailFrom: parseResult.emailFrom,
        emailFromName: parseResult.emailFromName || null,
        emailDate: new Date(parseResult.emailDate),
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
      },
    });
    createdIds.push(record.id);
  }

  // ── 9. Match reservations to existing trips ──────────────────────────────
  if (createdIds.length > 0) {
    try {
      const reservations = await prisma.emailReservation.findMany({
        where: { id: { in: createdIds } },
      });

      const trips = await prisma.trip.findMany({
        where: { userId: grant.userId },
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

      if (trips.length > 0) {
        const matches = matchReservationsToTrips(
          reservations.map((r: any) => ({
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
          trips.map((t: any) => ({
            id: t.id,
            name: t.name,
            location: t.location,
            startDate: t.startDate
              ? t.startDate instanceof Date ? t.startDate.toISOString() : String(t.startDate)
              : null,
            endDate: t.endDate
              ? t.endDate instanceof Date ? t.endDate.toISOString() : String(t.endDate)
              : null,
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
    } catch (err) {
      console.error('[nylas-webhook] Trip matching error:', err);
      // Non-fatal — reservation is still created
    }
  }

  console.log(`[nylas-webhook] ✓ Created ${createdIds.length} reservation(s) from webhook`);

  return NextResponse.json({
    status: 'processed',
    reservationsCreated: createdIds.length,
    reservationIds: createdIds,
  });
}
