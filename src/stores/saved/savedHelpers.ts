import type { ImportedPlace, Shortlist } from '@/types';
import { dbSave } from '@/lib/db-save';

// ═══════════════════════════════════════════
// DB write wrapper
// ═══════════════════════════════════════════

/** DB write with retry + error surfacing (replaces fire-and-forget) */
export function dbWrite(url: string, method: string, body?: unknown) {
  dbSave(url, method, body);
}

// ═══════════════════════════════════════════
// Shortlist helpers
// ═══════════════════════════════════════════

export const DEFAULT_SHORTLIST_ID = 'shortlist-favorites';

export function deriveCities(placeIds: string[], allPlaces: ImportedPlace[]): string[] {
  const cities = new Set<string>();
  placeIds.forEach(id => {
    const place = allPlaces.find(p => p.id === id);
    if (place) {
      // Take first part of location (city name)
      const city = place.location.split(',')[0].trim();
      cities.add(city);
    }
  });
  return Array.from(cities);
}

export function createDefaultShortlist(placeIds: string[]): Shortlist {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_SHORTLIST_ID,
    name: 'Favorites',
    description: 'Your personal picks',
    emoji: 'star',
    placeIds,
    cities: [],
    isDefault: true,
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildShortlists(allPlaces: ImportedPlace[]): Shortlist[] {
  const now = new Date().toISOString();
  const favoritePlaceIds = allPlaces.filter(p => p.isShortlisted).map(p => p.id);
  const defaultShortlist = createDefaultShortlist(favoritePlaceIds);
  defaultShortlist.cities = deriveCities(favoritePlaceIds, allPlaces);

  const curated: Shortlist[] = [
    { id: 'sl-scandi-design-hotels', name: 'Scandi design hotels', description: 'The best design-forward stays in Scandinavia', emoji: 'hotel', placeIds: ['sc-1', 'sc-8', 'sc-19'], cities: deriveCities(['sc-1', 'sc-8', 'sc-19'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-mexico-city-musts', name: 'Mexico City musts', description: 'The definitive CDMX hit list', emoji: 'restaurant', placeIds: ['mx-3', 'mx-2', 'mx-11', 'mx-14', 'mx-17', 'mx-9', 'mx-4', 'mx-8', 'mx-1'], cities: deriveCities(['mx-3'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-paris-neo-bistro', name: 'Paris neo-bistro crawl', description: 'The new wave of Paris dining', emoji: 'food', placeIds: ['pa-8', 'pa-3', 'pa-13', 'pa-16', 'pa-14', 'pa-11'], cities: deriveCities(['pa-8'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-cocktail-bars', name: 'Best cocktail bars', description: 'No-menu, speakeasy, mezcal — the good stuff', emoji: 'bar', placeIds: ['saved-3', 'saved-12', 'sc-7', 'sc-14', 'pa-7', 'pa-19', 'mx-9', 'mx-12'], cities: deriveCities(['saved-3', 'sc-7', 'pa-7', 'mx-9'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-lizzie-recs', name: "Everything Lizzie recommended", description: "Lizzie N. has impeccable taste", emoji: 'friend', placeIds: allPlaces.filter(p => p.friendAttribution?.name === 'Lizzie N.').map(p => p.id), cities: deriveCities(allPlaces.filter(p => p.friendAttribution?.name === 'Lizzie N.').map(p => p.id), allPlaces), isSmartCollection: true, query: 'everything Lizzie recommended', filterTags: ['person: Lizzie'], createdAt: now, updatedAt: now },
    { id: 'sl-sicily-road-trip', name: 'Sicily road trip', description: 'Island hopping from Palermo to Taormina', emoji: 'discover', placeIds: ['si-1', 'si-2', 'si-3', 'si-5', 'si-4', 'si-9', 'si-14', 'si-17', 'si-11', 'si-12', 'si-6'], cities: deriveCities(['si-1', 'si-2', 'si-3', 'si-5', 'si-9'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-museums-worth-it', name: 'Museums worth the trip', description: 'Art, history, and architecture that deliver', emoji: 'museum', placeIds: ['saved-7', 'saved-11', 'pa-5', 'pa-17', 'mx-4', 'mx-18', 'si-4'], cities: deriveCities(['saved-7', 'saved-11', 'pa-5', 'mx-4', 'si-4'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-coffee-ritual', name: 'Coffee ritual', description: 'Specialty roasters and neighborhood cafés', emoji: 'cafe', placeIds: ['sc-4', 'sc-13', 'pa-4', 'pa-10', 'pa-15', 'pa-18', 'mx-5', 'mx-20', 'si-9'], cities: deriveCities(['sc-4', 'pa-4', 'mx-5', 'si-9'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-neighborhoods-to-wander', name: 'Neighborhoods to wander', description: 'Drop a pin and just walk', emoji: 'location', placeIds: ['sc-5', 'sc-11', 'pa-6', 'mx-8', 'si-5', 'si-12'], cities: deriveCities(['sc-5', 'pa-6', 'mx-8', 'si-5'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
    { id: 'sl-splurge-nights', name: 'Splurge nights', description: 'When you want the full experience', emoji: 'star', placeIds: ['saved-9', 'sc-2', 'saved-6', 'pa-8', 'mx-3', 'si-3', 'si-1', 'sc-1'], cities: deriveCities(['saved-9', 'sc-2', 'pa-8', 'mx-3', 'si-3'], allPlaces), isSmartCollection: false, createdAt: now, updatedAt: now },
  ];

  return [defaultShortlist, ...curated];
}
