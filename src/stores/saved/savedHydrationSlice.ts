import type { ImportedPlace, PlaceRating, GhostSourceType, Shortlist } from '@/types';
import { StateCreator } from 'zustand';
import { createDefaultShortlist, deriveCities } from './savedHelpers';
import type { SavedState, DBSavedPlace, DBShortlist } from './savedTypes';

// ═══════════════════════════════════════════
// Hydration slice state
// ═══════════════════════════════════════════

export interface SavedHydrationState {
  // DB hydration
  hydrateFromDB: (places: DBSavedPlace[], shortlists: DBShortlist[]) => void;
}

// ═══════════════════════════════════════════
// Hydration slice factory
// ═══════════════════════════════════════════

export const createHydrationSlice: StateCreator<SavedState, [], [], SavedHydrationState> = (set, get) => ({
  hydrateFromDB: (dbPlaces, dbShortlists) => {
    // Map DB places → store ImportedPlace format
    const places: ImportedPlace[] = dbPlaces.map(dp => ({
      id: dp.id,
      name: dp.name,
      type: (dp.type || 'restaurant') as ImportedPlace['type'],
      location: dp.location || '',
      source: dp.source
        ? (dp.source as unknown as ImportedPlace['source'])
        : { type: 'email' as const, name: dp.ghostSource || 'manual' },
      matchScore: dp.matchScore || 0,
      matchBreakdown: (dp.matchBreakdown as ImportedPlace['matchBreakdown']) || { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: dp.tasteNote || '',
      status: 'available' as const,
      ghostSource: (dp.ghostSource || 'manual') as GhostSourceType,
      isShortlisted: dp.isShortlisted,
      rating: dp.rating as PlaceRating | undefined,
      friendAttribution: dp.friendAttribution as ImportedPlace['friendAttribution'],
      terrazzoInsight: dp.terrazzoInsight as ImportedPlace['terrazzoInsight'],
      enrichment: dp.enrichment as ImportedPlace['enrichment'],
      google: dp.googleData as ImportedPlace['google'],
      userContext: dp.userContext || undefined,
      timing: dp.timing || undefined,
      travelWith: dp.travelWith || undefined,
      intentStatus: dp.intentStatus as ImportedPlace['intentStatus'],
      savedDate: dp.savedDate || undefined,
      addedAt: dp.createdAt || dp.savedDate || undefined,
      importBatchId: dp.importBatchId || undefined,
      whatToOrder: dp.whatToOrder || undefined,
      tips: dp.tips || undefined,
      alsoKnownAs: dp.alsoKnownAs || undefined,
    }));

    // Map DB shortlists → store Shortlist format
    const shortlists: Shortlist[] = dbShortlists.map(ds => ({
      id: ds.id,
      name: ds.name,
      description: ds.description || undefined,
      emoji: ds.emoji || 'pin',
      placeIds: Array.isArray(ds.placeIds) ? ds.placeIds : [],
      cities: deriveCities(Array.isArray(ds.placeIds) ? ds.placeIds : [], places),
      isDefault: ds.isDefault,
      isSmartCollection: ds.isSmartCollection,
      query: ds.query || undefined,
      filterTags: Array.isArray(ds.filterTags) ? ds.filterTags : undefined,
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
    }));

    // Ensure there's always a default Favorites shortlist
    if (!shortlists.some(s => s.isDefault)) {
      const favoritePlaceIds = places.filter(p => p.isShortlisted).map(p => p.id);
      shortlists.unshift(createDefaultShortlist(favoritePlaceIds));
    }

    set({ myPlaces: places, shortlists, history: [] });
  },
});
