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

