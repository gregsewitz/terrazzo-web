import type {
  InteractionEventType,
  InteractionSurface,
  InteractionMetadata,
} from '@/types/interactions';
import { INTERACTION_WEIGHTS } from '@/types/interactions';
import { prisma } from '@/lib/prisma';

/**
 * Server-side: log an interaction directly to the database.
 * Fire-and-forget — same pattern as logTripActivity in trip-access.ts.
 *
 * @example
 *   import { logInteraction } from '@/lib/interaction-tracker-server';
 *   logInteraction(userId, 'save_to_library', 'ChIJ...', 'library');
 */
export function logInteraction(
  userId: string,
  eventType: InteractionEventType,
  googlePlaceId: string,
  surface: InteractionSurface,
  metadata?: InteractionMetadata,
): void {
  const signalWeight = INTERACTION_WEIGHTS[eventType];

  // Fire and forget — don't await
  prisma.$executeRawUnsafe(
    `INSERT INTO interaction_events (user_id, google_place_id, event_type, signal_weight, surface, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    userId,
    googlePlaceId,
    eventType,
    signalWeight,
    surface,
    metadata ? JSON.stringify(metadata) : null,
  ).catch(() => {
    // Silently ignore — interaction logging must never break the app
  });
}
