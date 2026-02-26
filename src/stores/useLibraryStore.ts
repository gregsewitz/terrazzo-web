import { create } from 'zustand';
import type { SavedState } from './saved/savedTypes';
import { createPlacesSlice } from './saved/savedPlacesSlice';
import { createCollectionSlice } from './saved/savedCollectionSlice';
import { createHistorySlice } from './saved/savedHistorySlice';
import { createHydrationSlice } from './saved/savedHydrationSlice';

// ═══════════════════════════════════════════
// Library store — manages saved places, collections, and history
// (Formerly "savedStore"; renamed for clarity since this IS the library)
// ═══════════════════════════════════════════

export const useLibraryStore = create<SavedState>((...args) => ({
  ...createPlacesSlice(...args),
  ...createCollectionSlice(...args),
  ...createHistorySlice(...args),
  ...createHydrationSlice(...args),
}));

// ═══════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════

export type { SavedState, DBSavedPlace, DBCollection, ViewMode, HistoryItem } from './saved/savedTypes';

// ═══════════════════════════════════════════
// Lazy demo data loader
// ═══════════════════════════════════════════

let _demoLoaded = false;

/** Lazily load demo data into the library store. Safe to call multiple times. */
export async function initLibraryDemoData() {
  if (_demoLoaded) return;
  _demoLoaded = true;
  const { DEMO_ALL_PLACES, DEMO_HISTORY } = await import('@/data/demoSaved');
  const { buildCollections } = await import('./saved/savedHelpers');
  const allPlaces = [...DEMO_ALL_PLACES];
  useLibraryStore.setState({
    myPlaces: allPlaces,
    history: DEMO_HISTORY as any[],
    collections: buildCollections(allPlaces),
  });
}
