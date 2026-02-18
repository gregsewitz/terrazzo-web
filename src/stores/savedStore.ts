import { create } from 'zustand';
import { ImportedPlace, PlaceRating, PlaceType, GhostSourceType, GooglePlaceData, Shortlist } from '@/types';
import {
  DEMO_ALL_PLACES,
  DEMO_HISTORY as IMPORTED_HISTORY,
} from '@/data/demoSaved';

export type ViewMode = 'myPlaces' | 'history';

export interface HistoryItem {
  id: string;
  name: string;
  type: PlaceType;
  location: string;
  detectedFrom: 'OpenTable' | 'Resy' | 'Hotels.com';
  detectedDate: string;
  ghostSource: GhostSourceType;
  rating?: PlaceRating;
  google?: GooglePlaceData;
}

export interface Collection {
  id: string;
  name: string;
  count: number;
  emoji: string;
  isSmartCollection: boolean;
  query?: string;
  filterTags?: string[];
}

// ═══════════════════════════════════════════
// Shortlist helpers
// ═══════════════════════════════════════════

const DEFAULT_SHORTLIST_ID = 'shortlist-favorites';

function deriveCities(placeIds: string[], allPlaces: ImportedPlace[]): string[] {
  const cities = new Set<string>();
  placeIds.forEach(id => {
    const place = allPlaces.find(p => p.id === id);
    if (place) {
      // Take first part of location (city name)
      const city = place.location.split(',')[0].trim();
      cities.add(city);
    }
  });
  return Array.from(cities);
}

function createDefaultShortlist(placeIds: string[]): Shortlist {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_SHORTLIST_ID,
    name: 'Favorites',
    description: 'Your personal picks',
    emoji: 'star',
    placeIds,
    cities: [],
    isDefault: true,
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ═══════════════════════════════════════════
// Build initial shortlists — curated from actual places
// ═══════════════════════════════════════════

const allPlaces = [...DEMO_ALL_PLACES];
const favoritePlaceIds = allPlaces.filter(p => p.isShortlisted).map(p => p.id);
const defaultShortlist = createDefaultShortlist(favoritePlaceIds);
defaultShortlist.cities = deriveCities(favoritePlaceIds, allPlaces);

const now = new Date().toISOString();

const CURATED_SHORTLISTS: Shortlist[] = [
  {
    id: 'sl-scandi-design-hotels',
    name: 'Scandi design hotels',
    description: 'The best design-forward stays in Scandinavia',
    emoji: 'hotel',
    placeIds: ['sc-1', 'sc-8', 'sc-19'],
    cities: deriveCities(['sc-1', 'sc-8', 'sc-19'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-mexico-city-musts',
    name: 'Mexico City musts',
    description: 'The definitive CDMX hit list',
    emoji: 'restaurant',
    placeIds: ['mx-3', 'mx-2', 'mx-11', 'mx-14', 'mx-17', 'mx-9', 'mx-4', 'mx-8', 'mx-1'],
    cities: deriveCities(['mx-3'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-paris-neo-bistro',
    name: 'Paris neo-bistro crawl',
    description: 'The new wave of Paris dining',
    emoji: 'food',
    placeIds: ['pa-8', 'pa-3', 'pa-13', 'pa-16', 'pa-14', 'pa-11'],
    cities: deriveCities(['pa-8'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-cocktail-bars',
    name: 'Best cocktail bars',
    description: 'No-menu, speakeasy, mezcal — the good stuff',
    emoji: 'bar',
    placeIds: ['saved-3', 'saved-12', 'sc-7', 'sc-14', 'pa-7', 'pa-19', 'mx-9', 'mx-12'],
    cities: deriveCities(['saved-3', 'sc-7', 'pa-7', 'mx-9'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-lizzie-recs',
    name: "Everything Lizzie recommended",
    description: "Lizzie N. has impeccable taste",
    emoji: 'friend',
    placeIds: allPlaces.filter(p => p.friendAttribution?.name === 'Lizzie N.').map(p => p.id),
    cities: deriveCities(
      allPlaces.filter(p => p.friendAttribution?.name === 'Lizzie N.').map(p => p.id),
      allPlaces,
    ),
    isSmartCollection: true,
    query: 'everything Lizzie recommended',
    filterTags: ['person: Lizzie'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-sicily-road-trip',
    name: 'Sicily road trip',
    description: 'Island hopping from Palermo to Taormina',
    emoji: 'discover',
    placeIds: ['si-1', 'si-2', 'si-3', 'si-5', 'si-4', 'si-9', 'si-14', 'si-17', 'si-11', 'si-12', 'si-6'],
    cities: deriveCities(['si-1', 'si-2', 'si-3', 'si-5', 'si-9'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-museums-worth-it',
    name: 'Museums worth the trip',
    description: 'Art, history, and architecture that deliver',
    emoji: 'museum',
    placeIds: ['saved-7', 'saved-11', 'pa-5', 'pa-17', 'mx-4', 'mx-18', 'si-4'],
    cities: deriveCities(['saved-7', 'saved-11', 'pa-5', 'mx-4', 'si-4'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-coffee-ritual',
    name: 'Coffee ritual',
    description: 'Specialty roasters and neighborhood cafés',
    emoji: 'cafe',
    placeIds: ['sc-4', 'sc-13', 'pa-4', 'pa-10', 'pa-15', 'pa-18', 'mx-5', 'mx-20', 'si-9'],
    cities: deriveCities(['sc-4', 'pa-4', 'mx-5', 'si-9'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-neighborhoods-to-wander',
    name: 'Neighborhoods to wander',
    description: 'Drop a pin and just walk',
    emoji: 'location',
    placeIds: ['sc-5', 'sc-11', 'pa-6', 'mx-8', 'si-5', 'si-12'],
    cities: deriveCities(['sc-5', 'pa-6', 'mx-8', 'si-5'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sl-splurge-nights',
    name: 'Splurge nights',
    description: 'When you want the full experience',
    emoji: 'star',
    placeIds: ['saved-9', 'sc-2', 'saved-6', 'pa-8', 'mx-3', 'si-3', 'si-1', 'sc-1'],
    cities: deriveCities(['saved-9', 'sc-2', 'pa-8', 'mx-3', 'si-3'], allPlaces),
    isSmartCollection: false,
    createdAt: now,
    updatedAt: now,
  },
];

const INITIAL_SHORTLISTS: Shortlist[] = [defaultShortlist, ...CURATED_SHORTLISTS];

// ═══════════════════════════════════════════
// Store
// ═══════════════════════════════════════════

interface SavedState {
  // Core data
  myPlaces: ImportedPlace[];  // kept as "myPlaces" for backward compat across consumers
  history: HistoryItem[];
  shortlists: Shortlist[];

  // Legacy (kept for imports that reference it)
  collections: Collection[];

  // UI state
  viewMode: ViewMode;
  activeView: 'shortlists' | 'library';
  typeFilter: PlaceType | 'all';
  searchQuery: string;
  cityFilter: string | 'all';

  // Library actions
  setViewMode: (mode: ViewMode) => void;
  setActiveView: (view: 'shortlists' | 'library') => void;
  setTypeFilter: (filter: PlaceType | 'all') => void;
  setSearchQuery: (query: string) => void;
  setCityFilter: (city: string | 'all') => void;
  addPlace: (place: ImportedPlace) => void;
  removePlace: (id: string) => void;
  ratePlace: (id: string, rating: PlaceRating) => void;

  // Shortlist actions
  toggleStar: (id: string) => void;  // add/remove from Favorites shortlist + sync isShortlisted
  createShortlist: (name: string, emoji?: string, description?: string) => string;
  deleteShortlist: (id: string) => void;
  updateShortlist: (id: string, updates: Partial<Pick<Shortlist, 'name' | 'emoji' | 'description'>>) => void;
  addPlaceToShortlist: (shortlistId: string, placeId: string) => void;
  removePlaceFromShortlist: (shortlistId: string, placeId: string) => void;
  createSmartShortlist: (name: string, emoji: string, query: string, filterTags: string[], placeIds?: string[]) => string;

  // History actions
  promoteFromHistory: (id: string) => void;
  archiveToHistory: (id: string) => void;
  addHistoryItems: (items: HistoryItem[]) => void;

  // Legacy collection action (for imports)
  addCollection: (collection: Omit<Collection, 'id'>) => void;
}

export const useSavedStore = create<SavedState>((set, get) => ({
  myPlaces: allPlaces,
  history: IMPORTED_HISTORY,
  shortlists: INITIAL_SHORTLISTS,
  collections: [] as Collection[],

  // UI state
  viewMode: 'myPlaces',
  activeView: 'shortlists',
  typeFilter: 'all',
  searchQuery: '',
  cityFilter: 'all',

  // ─── UI Actions ───
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveView: (view) => set({ activeView: view }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCityFilter: (city) => set({ cityFilter: city }),

  // ─── Library Actions ───
  addPlace: (place) => set((state) => ({
    myPlaces: [place, ...state.myPlaces],
  })),

  removePlace: (id) => set((state) => ({
    myPlaces: state.myPlaces.filter((p) => p.id !== id),
    // Also remove from all shortlists
    shortlists: state.shortlists.map(sl => ({
      ...sl,
      placeIds: sl.placeIds.filter(pid => pid !== id),
    })),
  })),

  ratePlace: (id, rating) => set((state) => ({
    myPlaces: state.myPlaces.map((p) =>
      p.id === id ? { ...p, rating } : p
    ),
  })),

  // ─── Shortlist Actions ───
  toggleStar: (id) => set((state) => {
    const favShortlist = state.shortlists.find(s => s.isDefault);
    if (!favShortlist) return state;

    const isCurrentlyFavorited = favShortlist.placeIds.includes(id);
    const newPlaceIds = isCurrentlyFavorited
      ? favShortlist.placeIds.filter(pid => pid !== id)
      : [...favShortlist.placeIds, id];

    return {
      // Sync isShortlisted on the place (backward compat for ghost injection, PicksStrip, etc.)
      myPlaces: state.myPlaces.map((p) =>
        p.id === id ? { ...p, isShortlisted: !isCurrentlyFavorited } : p
      ),
      // Update Favorites shortlist
      shortlists: state.shortlists.map(sl =>
        sl.isDefault
          ? {
              ...sl,
              placeIds: newPlaceIds,
              cities: deriveCities(newPlaceIds, state.myPlaces),
              updatedAt: new Date().toISOString(),
            }
          : sl
      ),
    };
  }),

  createShortlist: (name, emoji, description) => {
    const newId = `shortlist-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => ({
      shortlists: [
        ...state.shortlists,
        {
          id: newId,
          name,
          emoji: emoji || 'pin',
          description,
          placeIds: [],
          cities: [],
          isDefault: false,
          isSmartCollection: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    return newId;
  },

  deleteShortlist: (id) => set((state) => ({
    // Prevent deleting the default Favorites shortlist
    shortlists: state.shortlists.filter(sl => sl.id !== id || sl.isDefault),
  })),

  updateShortlist: (id, updates) => set((state) => ({
    shortlists: state.shortlists.map(sl =>
      sl.id === id
        ? { ...sl, ...updates, updatedAt: new Date().toISOString() }
        : sl
    ),
  })),

  addPlaceToShortlist: (shortlistId, placeId) => set((state) => {
    return {
      shortlists: state.shortlists.map(sl => {
        if (sl.id !== shortlistId) return sl;
        if (sl.placeIds.includes(placeId)) return sl; // already in shortlist
        const newPlaceIds = [...sl.placeIds, placeId];
        return {
          ...sl,
          placeIds: newPlaceIds,
          cities: deriveCities(newPlaceIds, state.myPlaces),
          updatedAt: new Date().toISOString(),
        };
      }),
      // If adding to Favorites, also sync isShortlisted
      myPlaces: shortlistId === DEFAULT_SHORTLIST_ID
        ? state.myPlaces.map(p => p.id === placeId ? { ...p, isShortlisted: true } : p)
        : state.myPlaces,
    };
  }),

  removePlaceFromShortlist: (shortlistId, placeId) => set((state) => {
    return {
      shortlists: state.shortlists.map(sl => {
        if (sl.id !== shortlistId) return sl;
        const newPlaceIds = sl.placeIds.filter(pid => pid !== placeId);
        return {
          ...sl,
          placeIds: newPlaceIds,
          cities: deriveCities(newPlaceIds, state.myPlaces),
          updatedAt: new Date().toISOString(),
        };
      }),
      // If removing from Favorites, also sync isShortlisted
      myPlaces: shortlistId === DEFAULT_SHORTLIST_ID
        ? state.myPlaces.map(p => p.id === placeId ? { ...p, isShortlisted: false } : p)
        : state.myPlaces,
    };
  }),

  createSmartShortlist: (name, emoji, query, filterTags, placeIds) => {
    const newId = `shortlist-smart-${Date.now()}`;
    const now = new Date().toISOString();
    const state = get();

    // Use pre-resolved placeIds if provided, otherwise fall back to tag-based resolution
    const resolvedIds = placeIds && placeIds.length > 0
      ? placeIds
      : state.myPlaces
          .filter(p => {
            return filterTags.some(tag => {
              const [key, val] = tag.split(':').map(s => s.trim().toLowerCase());
              if (key === 'location') return p.location.toLowerCase().includes(val);
              if (key === 'type') return p.type === val;
              if (key === 'source' && val === 'friend') return !!p.friendAttribution;
              if (key === 'person') return p.friendAttribution?.name.toLowerCase().includes(val);
              if (key === 'reaction' && val === 'saved') return p.isShortlisted;
              return false;
            });
          })
          .map(p => p.id);

    set((state) => ({
      shortlists: [
        ...state.shortlists,
        {
          id: newId,
          name,
          emoji,
          placeIds: resolvedIds,
          cities: deriveCities(resolvedIds, state.myPlaces),
          isDefault: false,
          isSmartCollection: true,
          query,
          filterTags,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    return newId;
  },

  // ─── History Actions ───
  promoteFromHistory: (id) => set((state) => {
    const histItem = state.history.find((h) => h.id === id);
    if (!histItem) return state;

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

    return {
      myPlaces: [newPlace, ...state.myPlaces],
      history: state.history.filter((h) => h.id !== id),
    };
  }),

  archiveToHistory: (id) => set((state) => {
    const place = state.myPlaces.find((p) => p.id === id);
    if (!place) return state;

    const historyItem: HistoryItem = {
      id: `hist-archived-${id}`,
      name: place.name,
      type: place.type,
      location: place.location,
      detectedFrom: (place.source?.name as HistoryItem['detectedFrom']) || 'OpenTable',
      detectedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      ghostSource: place.ghostSource || 'manual',
    };

    return {
      myPlaces: state.myPlaces.filter((p) => p.id !== id),
      history: [historyItem, ...state.history],
    };
  }),

  addHistoryItems: (items) => set((state) => {
    const existingNames = new Set(state.history.map(h => h.name.toLowerCase()));
    const newItems = items.filter(item => !existingNames.has(item.name.toLowerCase()));
    return {
      history: [...newItems, ...state.history],
    };
  }),

  // Legacy: still used by ImportDrawer — now also creates a shortlist
  addCollection: (collection) => set((state) => {
    const newId = `col-${Date.now()}`;
    const now = new Date().toISOString();

    // Create matching shortlist
    const newShortlist: Shortlist = {
      id: `shortlist-${newId}`,
      name: collection.name,
      emoji: collection.emoji,
      placeIds: [],
      cities: [],
      isSmartCollection: collection.isSmartCollection,
      query: collection.query,
      filterTags: collection.filterTags,
      createdAt: now,
      updatedAt: now,
    };

    return {
      collections: [{ ...collection, id: newId }, ...state.collections],
      shortlists: [...state.shortlists, newShortlist],
    };
  }),
}));
