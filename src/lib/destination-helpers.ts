/**
 * Helpers for extracting destination (city/region) info from Google Places results.
 */

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

/**
 * Generate a deterministic color palette from a destination name.
 * Used as fallback when destination isn't in the static DEST_COLORS map.
 */
export function generateDestColor(name: string): { bg: string; accent: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  // Pick from a curated set of hues that look good as destination colors
  const hues = [15, 35, 140, 175, 210, 260, 300, 330];
  const hue = hues[Math.abs(hash) % hues.length];
  const sat = 35 + (Math.abs(hash >> 4) % 20); // 35-55%

  return {
    bg: `hsl(${hue}, ${sat}%, 93%)`,
    accent: `hsl(${hue}, ${sat + 10}%, 45%)`,
    text: `hsl(${hue}, ${sat - 10}%, 30%)`,
  };
}
