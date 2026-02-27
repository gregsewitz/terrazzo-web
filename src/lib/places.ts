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
    maxResultCount: 3, // Fetch top 3 to pick best name match
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
  const places: PlaceSearchResult[] = data.places || [];
  if (places.length === 0) return null;

  // Extract the place name portion of the query (before the first comma = location)
  const queryNamePart = query.split(',')[0].trim().toLowerCase();
  // Separate "category" words from "proper name" words
  const CATEGORY_WORDS = new Set(['hotel', 'restaurant', 'bar', 'cafe', 'café', 'resort', 'inn', 'hostel', 'bistro', 'pizzeria', 'trattoria', 'brasserie', 'tavern', 'pub', 'lodge', 'motel', 'spa', 'club', 'house', 'the']);
  const allQueryWords = queryNamePart.split(/\s+/).filter(w => w.length > 1);
  const properNameWords = allQueryWords.filter(w => !CATEGORY_WORDS.has(w));
  // Use proper name words for matching (fall back to all words if everything is a category word)
  const queryNameWords = properNameWords.length > 0 ? properNameWords : allQueryWords;

  // Detect if the query implies a specific venue type
  const queryImpliesLodging = allQueryWords.some(w => ['hotel', 'resort', 'inn', 'hostel', 'lodge', 'motel'].includes(w));
  const queryImpliesFood = allQueryWords.some(w => ['restaurant', 'bistro', 'pizzeria', 'trattoria', 'brasserie', 'tavern', 'cafe', 'café'].includes(w));
  const queryImpliesDrink = allQueryWords.some(w => ['bar', 'pub', 'club'].includes(w));

  // Google types that are NOT venues (used to reject wrong-type results)
  const NON_VENUE_TYPES = new Set(['park', 'neighborhood', 'locality', 'sublocality', 'route', 'street_address', 'administrative_area_level_1', 'administrative_area_level_2', 'country', 'postal_code', 'natural_feature', 'political', 'premise']);

  // Score each result by name similarity + type compatibility
  const scored = places.map(place => {
    const name = (place.displayName?.text || '').toLowerCase();
    const resultWords = name.split(/\s+/).filter(w => w.length > 1);
    const resultType = (place.primaryType || '').toLowerCase();

    // Count how many proper-name query words appear in the result name
    let queryWordsMatched = 0;
    for (const word of queryNameWords) {
      if (name.includes(word)) queryWordsMatched++;
    }

    // Calculate match ratio: what % of the proper-name words were found?
    const matchRatio = queryNameWords.length > 0 ? queryWordsMatched / queryNameWords.length : 0;

    // Base score from match ratio
    let score = matchRatio * 10;

    // Bonus: result name words that appear in query (bidirectional check)
    for (const word of resultWords) {
      if (word.length > 2 && !CATEGORY_WORDS.has(word) && queryNamePart.includes(word)) {
        score += 0.5;
      }
    }

    // Big bonus for near-exact or containment matches
    if (name.includes(queryNamePart)) score += 15;

    // Penalty: result is a generic geo type when we searched for a venue
    if (NON_VENUE_TYPES.has(resultType) && (queryImpliesLodging || queryImpliesFood || queryImpliesDrink)) {
      score -= 8;
    }

    // Penalty: result type contradicts the queried type
    const resultIsLodging = resultType.includes('hotel') || resultType.includes('lodging') || resultType.includes('resort');
    const resultIsFood = resultType.includes('restaurant') || resultType.includes('food') || resultType.includes('cafe') || resultType.includes('bakery');
    const resultIsDrink = resultType.includes('bar') || resultType.includes('night_club');
    if (queryImpliesLodging && !resultIsLodging && (resultIsFood || resultIsDrink)) score -= 3;
    if (queryImpliesFood && !resultIsFood && resultIsLodging) score -= 3;

    return { place, score, matchRatio, resultType };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Reject if the best result doesn't match enough of the proper name
  // At least 50% of proper-name words must appear, OR score must be high from exact containment
  if (best.matchRatio < 0.5 && best.score < 5) {
    console.warn(`[places] Rejected results for "${query}" — low match ratio (${best.matchRatio.toFixed(2)}). Best: "${best.place.displayName?.text}" (type: ${best.resultType}, score: ${best.score.toFixed(1)})`);
    return null;
  }

  // Reject if result is a generic geo feature and we searched for a venue
  if (best.score < 0 || (NON_VENUE_TYPES.has(best.resultType) && best.matchRatio < 1.0)) {
    console.warn(`[places] Rejected "${best.place.displayName?.text}" (type: ${best.resultType}) for query "${query}" — wrong type`);
    return null;
  }

  if (best.place !== places[0]) {
    console.log(`[places] Reranked: query="${query}" → picked "${best.place.displayName?.text}" (ratio=${best.matchRatio.toFixed(2)}, type=${best.resultType}, score=${best.score.toFixed(1)}) over "${places[0].displayName?.text}"`);
  }

  return best.place;
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

/**
 * Get a single place by its Google Place ID — no text search needed.
 * Uses the Places API (New) `places/{id}` endpoint for a direct lookup.
 * Cached with 5-min TTL via cachedPlacesCall.
 */
export async function getPlaceById(
  googlePlaceId: string
): Promise<PlaceSearchResult | null> {
  return cachedPlacesCall(
    'single',
    `id:${googlePlaceId}`,
    () => _fetchPlaceById(googlePlaceId),
  );
}

async function _fetchPlaceById(
  googlePlaceId: string
): Promise<PlaceSearchResult | null> {
  // The Places API (New) field mask for single-place lookup uses slightly different paths
  const detailFieldMask = 'id,displayName,formattedAddress,rating,userRatingCount,priceLevel,types,regularOpeningHours,location,photos,primaryType,primaryTypeDisplayName';

  const url = `https://places.googleapis.com/v1/places/${googlePlaceId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': detailFieldMask,
    },
  });

  if (!response.ok) {
    console.error(`[places] getPlaceById error for ${googlePlaceId}:`, response.status, await response.text());
    return null;
  }

  const place = await response.json();
  // The detail endpoint returns the place directly (not wrapped in { places: [] })
  return place?.id ? place : null;
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
