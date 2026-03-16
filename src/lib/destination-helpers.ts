/**
 * Helpers for extracting destination (city/region) info from Google Places results
 * and assigning brand-palette colors to destinations.
 */

// ─── Brand destination palette ───
// Single source of truth for destination colors across the app.
// 7 brand colors that cycle for multi-city trips.

export type DestColor = { bg: string; accent: string; text: string };

const DEST_PALETTE: DestColor[] = [
  { bg: 'rgba(238,113,109,0.08)', accent: '#ee716d', text: '#c44a46' }, // Coral
  { bg: 'rgba(58,128,136,0.08)',  accent: '#3a8088', text: '#2a6068' }, // Dark Teal
  { bg: 'rgba(224,165,1,0.08)',   accent: '#e0a501', text: '#b08401' }, // Ochre
  { bg: 'rgba(107,124,78,0.08)',  accent: '#6B7C4E', text: '#4a5a30' }, // Olive
  { bg: 'rgba(56,105,164,0.08)',  accent: '#3869a4', text: '#2a4f7a' }, // Periwinkle
  { bg: 'rgba(231,168,161,0.08)', accent: '#e7a8a1', text: '#c08078' }, // Peach
  { bg: 'rgba(146,206,214,0.08)', accent: '#92ced6', text: '#5a9aa4' }, // Teal
];

/** Get a destination color by index (cycles through brand palette). */
export function getDestColor(index: number): DestColor {
  return DEST_PALETTE[index % DEST_PALETTE.length];
}

/**
 * Get a deterministic brand-palette color from a destination name.
 * Hashes the name so the same destination always gets the same color.
 */
export function generateDestColor(name: string): DestColor {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return DEST_PALETTE[Math.abs(hash) % DEST_PALETTE.length];
}

// ─── Google Places helpers ───

const GEO_TYPES = new Set([
  'locality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'country',
  'political',
  'colloquial_area',
  'natural_feature',
]);

/** Returns true if the Google Place is a city, region, or country (not a specific POI). */
export function isGeographicPlace(googleTypes?: string[]): boolean {
  if (!googleTypes || googleTypes.length === 0) return false;
  return googleTypes.some(t => GEO_TYPES.has(t));
}

/**
 * Extract the destination (city/region) name from a Google Places result.
 *
 * - If the result IS a city/region → return its name directly.
 * - If the result is a specific place (hotel, restaurant) → extract the city
 *   from address_components, falling back to the first comma-separated part.
 */
export function extractDestinationFromGooglePlace(
  placeName: string,
  googleTypes?: string[],
  addressComponents?: google.maps.GeocoderAddressComponent[],
): string {
  // Geographic place → use its name as-is
  if (isGeographicPlace(googleTypes)) {
    return placeName;
  }

  // Specific POI → extract city from address components
  if (addressComponents && addressComponents.length > 0) {
    const locality = addressComponents.find(ac =>
      ac.types.includes('locality'),
    );
    if (locality) return locality.long_name;

    const admin2 = addressComponents.find(ac =>
      ac.types.includes('administrative_area_level_2'),
    );
    if (admin2) return admin2.long_name;

    const admin1 = addressComponents.find(ac =>
      ac.types.includes('administrative_area_level_1'),
    );
    if (admin1) return admin1.long_name;
  }

  // Fallback: first part before comma in the place name or address
  const parts = placeName.split(',');
  return parts[0]?.trim() || placeName;
}
