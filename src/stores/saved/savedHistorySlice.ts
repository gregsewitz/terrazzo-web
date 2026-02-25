import type { ImportedPlace } from '@/types';
import { StateCreator } from 'zustand';
import { dbWrite } from './savedHelpers';
import type { SavedState, HistoryItem } from './savedTypes';

// ═══════════════════════════════════════════
// History slice state
// ═══════════════════════════════════════════

export interface SavedHistoryState {
  // Core data
  history: HistoryItem[];

  // Actions
  promoteFromHistory: (id: string) => void;
  archiveToHistory: (id: string) => void;
  addHistoryItems: (items: HistoryItem[]) => void;
}

// ═══════════════════════════════════════════
// History slice factory
// ═══════════════════════════════════════════

export const createHistorySlice: StateCreator<SavedState, [], [], SavedHistoryState> = (set, get) => ({
  history: [],

  promoteFromHistory: (id) => {
    const state = get();
    const histItem = state.history.find((h) => h.id === id);
    if (!histItem) return;

    const newPlace: ImportedPlace = {
      id: `promoted-${id}`,
      name: histItem.name,
      type: histItem.type,
      location: histItem.location,
      source: { type: 'email', name: `Promoted from ${histItem.detectedFrom}` },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: '',
      status: 'available',
      ghostSource: 'manual',
    };

    set({
      myPlaces: [newPlace, ...state.myPlaces],
      history: state.history.filter((h) => h.id !== id),
    });

    // Write-through: save promoted place to DB
    dbWrite('/api/places/save', 'POST', {
      name: newPlace.name,
      type: newPlace.type,
      location: newPlace.location,
      ghostSource: 'manual',
      matchScore: 0,
      matchBreakdown: newPlace.matchBreakdown,
    });
  },

  archiveToHistory: (id) => {
    const state = get();
    const place = state.myPlaces.find((p) => p.id === id);
    if (!place) return;

    const historyItem: HistoryItem = {
      id: `hist-archived-${id}`,
      name: place.name,
      type: place.type,
      location: place.location,
      detectedFrom: (place.source?.name as HistoryItem['detectedFrom']) || 'OpenTable',
      detectedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      ghostSource: place.ghostSource || 'manual',
    };

    set({
      myPlaces: state.myPlaces.filter((p) => p.id !== id),
      history: [historyItem, ...state.history],
    });

    // Write-through: remove archived place from DB
    dbWrite(`/api/places/${id}`, 'DELETE');
  },

  addHistoryItems: (items) => set((state) => {
    const existingNames = new Set(state.history.map(h => h.name.toLowerCase()));
    const newItems = items.filter(item => !existingNames.has(item.name.toLowerCase()));
    return {
      history: [...newItems, ...state.history],
    };
  }),
});
