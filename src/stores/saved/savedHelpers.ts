import type { ImportedPlace, Collection } from '@/types';
import { dbSave } from '@/lib/db-save';
import { getDisplayLocation } from '@/lib/place-display';

// ═══════════════════════════════════════════
// DB write wrapper
// ═══════════════════════════════════════════

/** DB write with retry + error surfacing (replaces fire-and-forget) */
export function dbWrite(url: string, method: string, body?: unknown) {
  dbSave(url, method, body);
}

// ═══════════════════════════════════════════
// Collection helpers
// ═══════════════════════════════════════════

export function deriveCities(placeIds: string[], allPlaces: ImportedPlace[]): string[] {
  const cities = new Set<string>();
  placeIds.forEach(id => {
    const place = allPlaces.find(p => p.id === id);
    if (place) {
      // Take first part of location (city name), filtering out bad data
      const city = getDisplayLocation(place.location, place.name, place.google?.address);
      if (city) cities.add(city);
    }
  });
  return Array.from(cities);
}

/** Build collections from places. Returns empty array — demo collections have been removed. */
export function buildCollections(_allPlaces: ImportedPlace[]): Collection[] {
  return [];
}
