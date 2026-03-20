import type { ImportedPlace } from '@/types';
import type { SortDirection } from '@/components/ui/FilterSortBar';

/**
 * Generic directional comparator — wraps any compare fn and flips
 * the result when direction is opposite to the sort's natural order.
 *
 * `naturalDirection` is the direction the raw comparator already sorts in.
 * E.g. matchScore sorts descending naturally (higher = better).
 */
function directional(
  cmp: (a: ImportedPlace, b: ImportedPlace) => number,
  naturalDirection: SortDirection,
  currentDirection: SortDirection,
): (a: ImportedPlace, b: ImportedPlace) => number {
  if (naturalDirection === currentDirection) return cmp;
  return (a, b) => -cmp(a, b);
}

/** Pre-built comparators with their natural sort direction */
const COMPARATORS: Record<string, { fn: (a: ImportedPlace, b: ImportedPlace) => number; natural: SortDirection }> = {
  match:  { fn: (a, b) => b.matchScore - a.matchScore, natural: 'desc' },
  recent: { fn: (a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''), natural: 'desc' },
  name:   { fn: (a, b) => a.name.localeCompare(b.name), natural: 'asc' },
  type:   { fn: (a, b) => a.type.localeCompare(b.type), natural: 'asc' },
  source: { fn: (a, b) => (a.source?.type || '').localeCompare(b.source?.type || ''), natural: 'asc' },
};

/**
 * Sort an array of places by the given sort key and direction.
 * Returns a new sorted array (does not mutate).
 */
export function sortPlaces(
  places: ImportedPlace[],
  sortBy: string,
  direction: SortDirection,
): ImportedPlace[] {
  const sorted = [...places];
  const entry = COMPARATORS[sortBy];
  if (!entry) return sorted;
  sorted.sort(directional(entry.fn, entry.natural, direction));
  return sorted;
}

/**
 * Returns the "natural" default direction for a given sort key.
 * Useful for resetting direction when the sort key changes.
 */
export function defaultDirectionFor(sortBy: string): SortDirection {
  return COMPARATORS[sortBy]?.natural ?? 'desc';
}
