/**
 * Pure, client-safe place display helpers.
 *
 * Extracts meaningful display strings from place data,
 * handling cases where location fields contain the place name
 * (from imports that didn't resolve a proper address) or are empty.
 */

/**
 * Extract a meaningful location label for display in place cards.
 *
 * Returns the first segment of the location (before the first comma),
 * but only if it's a real location — not the place name repeated.
 *
 * Falls back to extracting a city from formattedAddress when
 * the location field is empty or duplicates the name.
 *
 * @param location - The place's location field (may be empty, an address, or the place name)
 * @param name - The place's display name (used to detect duplicates)
 * @param formattedAddress - Optional Google formattedAddress as a fallback source
 * @returns A short location string (e.g. "Venice") or empty string if no meaningful location
 */
export function getDisplayLocation(
  location: string | undefined | null,
  name: string,
  formattedAddress?: string | null,
): string {
  const loc = location?.trim() || '';
  const firstSegment = loc.split(',')[0].trim();

  // Check if the first segment is meaningful:
  // - Not empty
  // - Not the same as the place name (case-insensitive)
  // - Not a substring match (e.g. "Bar Alla Toletta" location = "Bar Alla Toletta")
  if (
    firstSegment &&
    firstSegment.toLowerCase() !== name.toLowerCase() &&
    !name.toLowerCase().includes(firstSegment.toLowerCase()) &&
    !firstSegment.toLowerCase().includes(name.toLowerCase())
  ) {
    return firstSegment;
  }

  // Fallback: try to extract a city from formattedAddress
  // Google addresses are typically: "Street, City, Region, Country"
  // We want the city part (usually 2nd or 3rd segment from the end)
  if (formattedAddress) {
    const parts = formattedAddress.split(',').map((s) => s.trim());
    if (parts.length >= 3) {
      // For addresses like "Calle Larga XXII Marzo, Venice, Metropolitan City of Venice, Italy"
      // Return "Venice" (second-to-last meaningful segment)
      return parts[parts.length - 3] || parts[parts.length - 2] || '';
    }
    if (parts.length === 2) {
      return parts[0]; // "Venice, Italy" → "Venice"
    }
  }

  return '';
}
