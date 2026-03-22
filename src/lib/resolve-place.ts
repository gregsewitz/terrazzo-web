/**
 * Shared place resolution utility.
 *
 * Centralizes the Google Places resolution logic that was duplicated across
 * email/parse, email/reservations/backfill-places, email/reservations/batch-confirm,
 * and email/webhooks/nylas routes.
 */

import { searchPlace } from '@/lib/places';

/** Place types that don't need Google Places resolution */
const SKIP_RESOLUTION_TYPES = new Set(['flight', 'rental']);

/**
 * Attempt to resolve a Google Place ID from a name + location pair.
 *
 * Skips resolution for flights and rentals (which have no fixed venue).
 * Returns the Google Place result object or null if no match / skipped.
 */
export async function resolveGooglePlace(
  placeName: string | null | undefined,
  location: string | null | undefined,
  placeType: string | null | undefined,
  logPrefix = 'resolve-place',
): Promise<{ id: string; [key: string]: unknown } | null> {
  // Skip if missing required fields or non-venue type
  if (!placeName || !location) return null;
  if (placeType && SKIP_RESOLUTION_TYPES.has(placeType)) return null;

  try {
    const searchQuery = `${placeName} ${location}`.trim();
    const placeResult = await searchPlace(searchQuery, undefined, placeName);

    if (placeResult) {
      console.log(`[${logPrefix}] Resolved "${placeName}" → ${placeResult.id}`);
      return placeResult as unknown as { id: string; [key: string]: unknown };
    }

    console.warn(`[${logPrefix}] No match for "${placeName}" (query: "${searchQuery}")`);
    return null;
  } catch (err) {
    console.error(`[${logPrefix}] searchPlace failed for "${placeName}":`, err);
    return null;
  }
}

/**
 * Convenience wrapper that returns just the Google Place ID string.
 */
export async function resolveGooglePlaceId(
  placeName: string | null | undefined,
  location: string | null | undefined,
  placeType: string | null | undefined,
  logPrefix = 'resolve-place',
): Promise<string | undefined> {
  const result = await resolveGooglePlace(placeName, location, placeType, logPrefix);
  return result?.id;
}
