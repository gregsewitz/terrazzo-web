import { create } from 'zustand';
import type { SavedState } from './saved/savedTypes';
import { createPlacesSlice } from './saved/savedPlacesSlice';
import { createShortlistSlice } from './saved/savedShortlistSlice';
import { createHistorySlice } from './saved/savedHistorySlice';
import { createHydrationSlice } from './saved/savedHydrationSlice';

// ═══════════════════════════════════════════
// Composed saved store (single store with all slices)
// ═══════════════════════════════════════════

export const useSavedStore = create<SavedState>((...args) => ({
  ...createPlacesSlice(...args),
  ...createShortlistSlice(...args),
  ...createHistorySlice(...args),
  ...createHydrationSlice(...args),
}));

// ═══════════════════════════════════════════
// Re-exports for backward compatibility
// ═══════════════════════════════════════════

export type { SavedState, DBSavedPlace, DBShortlist, ViewMode, HistoryItem } from './saved/savedTypes';

// ═══════════════════════════════════════════
// Lazy demo data loader
// ═══════════════════════════════════════════

let _demoLoaded = false;

/** Lazily load demo data into the saved store. Safe to call multiple times. */
export async function initSavedDemoData() {
  if (_demoLoaded) return;
  _demoLoaded = true;
  const { DEMO_ALL_PLACES, DEMO_HISTORY } = await import('@/data/demoSaved');
  const { buildShortlists } = await import('./saved/savedHelpers');
  const allPlaces = [...DEMO_ALL_PLACES];
  useSavedStore.setState({
    myPlaces: allPlaces,
    history: DEMO_HISTORY as any[],
    shortlists: buildShortlists(allPlaces),
  });
}
