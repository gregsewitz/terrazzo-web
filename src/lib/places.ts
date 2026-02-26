import { cachedPlacesCall } from '@/lib/places-cache';

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

// Field mask — all fields needed across search and import flows
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.regularOpeningHours,places.location,places.photos,places.primaryType,places.primaryTypeDisplayName';

export interface PlaceSearchResult {
  id: string;
  displayName: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
}

/**
 * Search for a single place — cached with 5-min TTL.
 * Used for detailed lookups (import, save, enrichment).
 */
export async function searchPlace(
  query: string,
  locationBias?: string | { lat: number; lng: number; radiusMeters?: number }
): Promise<PlaceSearchResult | null> {
  const extras = locationBias
    ? typeof locationBias === 'string'
      ? { bias: locationBias }
      : { lat: locationBias.lat, lng: locationBias.lng, r: locationBias.radiusMeters || 5000 }
    : undefined;

  return cachedPlacesCall(
    'single',
    query,
    () => _fetchSinglePlace(query, locationBias),
    extras,
  );
}

/**
 * Search for multiple places (up to 5) — cached with 5-min TTL.
 * Used for autocomplete-style search in the Add Bar.
 */
export async function searchPlaces(
  query: string,
  maxResults: number = 5
): Promise<PlaceSearchResult[]> {
  return cachedPlacesCall(
    'multi',
    query,
    () => _fetchMultiplePlaces(query, maxResults),
    { max: maxResults },
  );
}

// ─── Raw API calls (uncached) ────────────────────────────────────────────────

async function _fetchSinglePlace(
  query: string,
  locationBias?: string | { lat: number; lng: number; radiusMeters?: number }
): Promise<PlaceSearchResult | null> {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const body: Record<string, unknown> = {
    textQuery: typeof locationBias === 'string' ? `${query} ${locationBias}` : query,
    maxResultCount: 1,
    languageCode: 'en',
  };

  // Use proper locationBias with lat/lng circle for precise matching
  if (typeof locationBias === 'object' && locationBias.lat && locationBias.lng) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: locationBias.radiusMeters || 5000.0,
      },
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('Places API error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  return data.places?.[0] || null;
}

async function _fetchMultiplePlaces(
  query: string,
  maxResults: number
): Promise<PlaceSearchResult[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: maxResults,
    languageCode: 'en',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('Places API error:', response.status, await response.text());
    return [];
  }

  const data = await response.json();
  return data.places || [];
}

// ─── Utilities (unchanged) ───────────────────────────────────────────────────

export function getPhotoUrl(photoName: string, maxWidth: number = 400): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${PLACES_API_KEY}`;
}

/**
 * Map Google Places type to our internal PlaceType.
 * Shared between import route and quick-add search.
 */
export function mapGoogleTypeToPlaceType(googleType?: string): string {
  if (!googleType) return 'activity';
  const type = googleType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food')) return 'restaurant';
  if (type.includes('bar') || type.includes('night_club') || type.includes('pub')) return 'bar';
  if (type.includes('cafe') || type.includes('coffee') || type.includes('bakery')) return 'cafe';
  if (type.includes('hotel') || type.includes('lodging') || type.includes('resort')) return 'hotel';
  if (type.includes('museum') || type.includes('art_gallery') || type.includes('church') || type.includes('landmark')) return 'museum';
  if (type.includes('store') || type.includes('shop') || type.includes('market')) return 'shop';
  if (type.includes('park') || type.includes('neighborhood') || type.includes('locality')) return 'neighborhood';
  return 'activity';
}

export function priceLevelToString(priceLevel?: string): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  };
  return map[priceLevel || ''] || '';
}
