import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import type { InteractionEventType, InteractionSurface, InteractionMetadata } from '@/types/interactions';
import { INTERACTION_WEIGHTS } from '@/types/interactions';

/**
 * POST /api/interactions
 *
 * Logs a user×property interaction event. Fire-and-forget on the client side;
 * this endpoint does minimal validation and writes directly to the
 * interaction_events table.
 *
 * Body: {
 *   googlePlaceId: string,
 *   eventType: InteractionEventType,
 *   surface: InteractionSurface,
 *   sessionId?: string,
 *   metadata?: InteractionMetadata
 * }
 */
export async function POST(req: NextRequest) {
  // Rate limit: 120 events per minute per IP (interactions are high-frequency)
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':interactions', { maxRequests: 120, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  // Auth — interactions require a logged-in user
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      googlePlaceId,
      eventType,
      surface,
      sessionId,
      metadata,
    } = body as {
      googlePlaceId: string;
      eventType: InteractionEventType;
      surface: InteractionSurface;
      sessionId?: string;
      metadata?: InteractionMetadata;
    };

    // Validate required fields
    if (!googlePlaceId || !eventType || !surface) {
      return NextResponse.json(
        { error: 'Missing required fields: googlePlaceId, eventType, surface' },
        { status: 400 },
      );
    }

    // Validate event type
    if (!(eventType in INTERACTION_WEIGHTS)) {
      return NextResponse.json(
        { error: `Unknown event type: ${eventType}` },
        { status: 400 },
      );
    }

    // Recompute weight server-side (don't trust client-sent weight)
    const signalWeight = INTERACTION_WEIGHTS[eventType];

    // Write to database
    await prisma.$executeRawUnsafe(
      `INSERT INTO interaction_events
        (user_id, google_place_id, event_type, signal_weight, surface, session_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      user.id,
      googlePlaceId,
      eventType,
      signalWeight,
      surface,
      sessionId || null,
      metadata ? JSON.stringify(metadata) : null,
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[interactions] Failed to log event:', err);
    // Return 200 anyway — interaction logging should never cause client errors
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
