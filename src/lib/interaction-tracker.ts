import type {
  InteractionEventType,
  InteractionSurface,
  InteractionMetadata,
} from '@/types/interactions';
import {
  INTERACTION_WEIGHTS,
} from '@/types/interactions';

// ─── Interaction Tracker ────────────────────────────────────────────────────
//
// Fire-and-forget interaction logging. Follows the same pattern as
// logTripActivity() in src/lib/trip-access.ts — never blocks the UI,
// silently drops on failure.
//
// Client-side usage:
//   trackInteraction('save_to_library', 'ChIJ...', 'library');
//   trackInteraction('rate_love', 'ChIJ...', 'place_detail', { reaction: 'loved', ratingTags: ['Beautiful space'] });
//   trackInteraction('add_to_trip', 'ChIJ...', 'trip', { tripId: 'abc', tripDay: 2, slotId: 'afternoon' });
//
// Server-side usage (in API routes):
//   logInteraction(userId, 'save_to_library', 'ChIJ...', 'library');
//
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get the signal weight for an event type.
 */
export function getSignalWeight(eventType: InteractionEventType): number {
  return INTERACTION_WEIGHTS[eventType];
}

// ─── Client-Side Tracker ───

let _sessionId: string | null = null;

function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return _sessionId;
}

/**
 * Client-side: fire-and-forget interaction logging.
 * Sends to POST /api/interactions. Never throws, never blocks.
 *
 * @example
 *   // User opens a place detail page
 *   trackInteraction('property_view', 'ChIJabc123', 'library');
 *
 *   // User saves a place from the discover feed
 *   trackInteraction('save_to_library', 'ChIJabc123', 'discover');
 *
 *   // User rates a place
 *   trackInteraction('rate_love', 'ChIJabc123', 'place_detail', {
 *     reaction: 'loved', ratingTags: ['Life-changing dish'], returnIntent: 'absolutely'
 *   });
 *
 *   // User adds a place to a trip
 *   trackInteraction('add_to_trip', 'ChIJabc123', 'trip', {
 *     tripId: 'clx123', tripDay: 2, slotId: 'afternoon'
 *   });
 *
 *   // User dismisses a ghost suggestion on the trip map
 *   trackInteraction('ghost_dismiss', 'ChIJabc123', 'trip_map', { tripId: 'clx123' });
 */
export function trackInteraction(
  eventType: InteractionEventType,
  googlePlaceId: string,
  surface: InteractionSurface,
  metadata?: InteractionMetadata,
): void {
  const signalWeight = getSignalWeight(eventType);

  // Fire and forget — never await, never block UI
  fetch('/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googlePlaceId,
      eventType,
      signalWeight,
      surface,
      sessionId: getSessionId(),
      metadata,
    }),
  }).catch(() => {
    // Silently ignore — interaction logging must never break the app
  });
}

// ─── Dwell Time Tracker ───
// Tracks time spent on a place detail page.
// Call startDwellTracker on mount, stopDwellTracker on unmount.
// Used in /places/[googlePlaceId]/page.tsx (PlaceDetailContent).

const dwellTimers = new Map<string, { startTime: number; surface: InteractionSurface }>();
const DWELL_THRESHOLD_MS = 30_000; // 30s minimum for a "dwell" event

export function startDwellTracker(
  googlePlaceId: string,
  surface: InteractionSurface,
): void {
  dwellTimers.set(googlePlaceId, { startTime: Date.now(), surface });
}

export function stopDwellTracker(googlePlaceId: string): void {
  const timer = dwellTimers.get(googlePlaceId);
  if (!timer) return;

  const dwellMs = Date.now() - timer.startTime;
  dwellTimers.delete(googlePlaceId);

  if (dwellMs >= DWELL_THRESHOLD_MS) {
    trackInteraction('property_dwell', googlePlaceId, timer.surface, {
      dwellSeconds: Math.round(dwellMs / 1000),
    });
  }
}

// ─── Return Visit Detection ───
// Counts how many times a user visits the same place detail page in a session.
// Uses sessionStorage so it resets when the browser tab closes.

const VISIT_COUNT_PREFIX = 'terrazzo_visits_';

export function trackPropertyVisit(
  googlePlaceId: string,
  surface: InteractionSurface,
): void {
  if (typeof window === 'undefined') return;

  const key = `${VISIT_COUNT_PREFIX}${googlePlaceId}`;
  const prev = parseInt(sessionStorage.getItem(key) || '0', 10);
  const count = prev + 1;
  sessionStorage.setItem(key, String(count));

  // Always log the base view
  trackInteraction('property_view', googlePlaceId, surface);

  // Log return visit on 2nd+ view
  if (count > 1) {
    trackInteraction('return_visit', googlePlaceId, surface, {
      visitCount: count,
    });
  }
}

// ─── Server-Side Logger ───
// Moved to src/lib/interaction-tracker-server.ts to avoid pulling prisma/pg
// into client bundles. Import from there in API routes.
