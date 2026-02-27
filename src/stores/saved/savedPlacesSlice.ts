import type { ImportedPlace, PlaceRating, PlaceType } from '@/types';
import { StateCreator } from 'zustand';
import { dbWrite } from './savedHelpers';
import type { SavedState } from './savedTypes';

// ═══════════════════════════════════════════
// Places slice state
// ═══════════════════════════════════════════

export interface SavedPlacesState {
  // Core data
  myPlaces: ImportedPlace[];

  // UI state
  viewMode: 'myPlaces' | 'history';
  typeFilter: PlaceType | 'all';
  searchQuery: string;
  cityFilter: string | 'all';

  // Actions
  setViewMode: (mode: 'myPlaces' | 'history') => void;
  setTypeFilter: (filter: PlaceType | 'all') => void;
  setSearchQuery: (query: string) => void;
  setCityFilter: (city: string | 'all') => void;
  addPlace: (place: ImportedPlace) => void;
  removePlace: (id: string) => void;
  ratePlace: (id: string, rating: PlaceRating) => void;
}

// ═══════════════════════════════════════════
// Places slice factory
// ═══════════════════════════════════════════

export const createPlacesSlice: StateCreator<SavedState, [], [], SavedPlacesState> = (set, get) => ({
  myPlaces: [],
  viewMode: 'myPlaces',
  typeFilter: 'all',
  searchQuery: '',
  cityFilter: 'all',

  setViewMode: (mode) => set({ viewMode: mode }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCityFilter: (city) => set({ cityFilter: city }),

  addPlace: (place) => {
    const stamped = { ...place, savedAt: place.savedAt || new Date().toISOString() };
    set((state) => ({ myPlaces: [stamped, ...state.myPlaces] }));
    // Write-through: save to DB
    dbWrite('/api/places/save', 'POST', {
      name: place.name,
      type: place.type,
      location: place.location,
      googlePlaceId: place.google?.placeId,
      source: place.source,
      ghostSource: place.ghostSource,
      friendAttribution: place.friendAttribution,
      matchScore: place.matchScore,
      matchBreakdown: place.matchBreakdown,
      tasteNote: place.tasteNote,
      googleData: place.google,
      terrazzoInsight: place.terrazzoInsight,
      enrichment: place.enrichment,
      whatToOrder: place.whatToOrder,
      tips: place.tips,
      alsoKnownAs: place.alsoKnownAs,
      importBatchId: place.importBatchId,
      travelWith: place.travelWith,
      userContext: place.userContext,
      timing: place.timing,
      intentStatus: place.intentStatus,
    });
  },

  removePlace: (id) => {
    // Strip ghost-prefixed IDs (e.g. "ghost-claude-xxx" → "xxx")
    const realId = id.replace(/^ghost-(?:claude|friend|maps)-/, '');
    set((state) => ({
      myPlaces: state.myPlaces.filter((p) => p.id !== realId),
      collections: state.collections.map(sl => ({
        ...sl,
        placeIds: sl.placeIds.filter(pid => pid !== realId),
      })),
    }));
    dbWrite(`/api/places/${realId}`, 'DELETE');
  },

  ratePlace: (id, rating) => {
    set((state) => ({
      myPlaces: state.myPlaces.map((p) =>
        p.id === id ? { ...p, rating } : p
      ),
    }));
    dbWrite(`/api/places/${id}`, 'PATCH', { rating });
  },
});
