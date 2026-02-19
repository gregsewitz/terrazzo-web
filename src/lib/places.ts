const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

interface PlaceSearchResult {
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

export async function searchPlace(
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
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.regularOpeningHours,places.location,places.photos,places.primaryType,places.primaryTypeDisplayName',
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

export function getPhotoUrl(photoName: string, maxWidth: number = 400): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${PLACES_API_KEY}`;
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
