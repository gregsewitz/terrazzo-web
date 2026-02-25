import type { ImportedPlace, PlaceRating, PlaceType, GhostSourceType, GooglePlaceData, Shortlist } from '@/types';

// ═══════════════════════════════════════════
// DB types (shapes returned by API routes)
// ═══════════════════════════════════════════

export interface DBSavedPlace {
  id: string;
  googlePlaceId?: string | null;
  name: string;
  type: string;
  location?: string | null;
  source?: Record<string, unknown> | null;
  ghostSource?: string | null;
  friendAttribution?: Record<string, unknown> | null;
  userContext?: string | null;
  timing?: string | null;
  travelWith?: string | null;
  intentStatus?: string | null;
  savedDate?: string | null;
  importBatchId?: string | null;
  rating?: Record<string, unknown> | null;
  isShortlisted: boolean;
  matchScore?: number | null;
  matchBreakdown?: Record<string, number> | null;
  tasteNote?: string | null;
  terrazzoInsight?: Record<string, unknown> | null;
  enrichment?: Record<string, unknown> | null;
  whatToOrder?: string[] | null;
  tips?: string[] | null;
  alsoKnownAs?: string | null;
  googleData?: Record<string, unknown> | null;
  placeIntelligenceId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DBShortlist {
  id: string;
  name: string;
  description?: string | null;
  emoji: string;
  isDefault: boolean;
  isSmartCollection: boolean;
  query?: string | null;
  filterTags?: string[] | null;
  placeIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════
// UI state types
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// Combined state interface
// ═══════════════════════════════════════════

export interface SavedState {
  // Core data
  myPlaces: ImportedPlace[];
  history: HistoryItem[];
  shortlists: Shortlist[];

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
  toggleStar: (id: string) => void;
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

  // DB hydration
  hydrateFromDB: (places: DBSavedPlace[], shortlists: DBShortlist[]) => void;
}
