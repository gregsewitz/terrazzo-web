import { Trip, ImportedPlace } from '@/types';
import { TYPE_BRAND_COLORS } from '@/constants/placeTypes';
import { COLOR } from '@/constants/theme';

/**
 * Get all places from a trip (both scheduled and pooled)
 */
export function getAllPlaces(trip: Trip): ImportedPlace[] {
  const placed = trip.days.flatMap(d => d.slots.flatMap(s => s.places));
  return [...placed, ...trip.pool];
}

/**
 * Format a date string to long format (e.g., "March 17, 2026")
 */
export function formatDateLong(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string to short format (e.g., "Mar 17")
 */
export function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Generate a Google Places photo URL from a placeId
 */
export function placePhotoUrl(placeId?: string, maxWidth = 800): string | null {
  if (!placeId) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  // Use Place Photos (New) — proxy through Next route or direct
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${placeId}&key=${key}`;
}

/**
 * Generate a brand-palette gradient based on place type (used when no photo available)
 */
export function placeholderGradient(type: string): string {
  const brandHex = TYPE_BRAND_COLORS[type as keyof typeof TYPE_BRAND_COLORS] || COLOR.navy;
  return `linear-gradient(135deg, ${brandHex}18 0%, ${brandHex}30 100%)`;
}

/**
 * Place type labels for editorial copy
 */
export const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  bar: 'Bar',
  cafe: 'Café',
  museum: 'Museum',
  activity: 'Activity',
  neighborhood: 'Neighborhood',
  shop: 'Shop',
};
