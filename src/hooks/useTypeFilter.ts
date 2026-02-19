import { useState, useCallback, useMemo } from 'react';
import type { PlaceType } from '@/types';

export type FilterType = 'all' | PlaceType;

/**
 * Shared hook for place-type filter state.
 * Encapsulates the toggle-on/toggle-off pattern used across
 * BrowseAllOverlay, PicksStrip, and TripMyPlaces.
 */
export function useTypeFilter(initial: FilterType = 'all') {
  const [filter, setFilter] = useState<FilterType>(initial);

  /** Toggle a type on, or back to 'all' if already active */
  const toggle = useCallback(
    (type: FilterType) => setFilter((f) => (f === type ? 'all' : type)),
    [],
  );

  /** Predicate — does an item pass the current filter? */
  const matches = useCallback(
    (item: { type: PlaceType }) => filter === 'all' || item.type === filter,
    [filter],
  );

  return { filter, setFilter, toggle, matches } as const;
}
