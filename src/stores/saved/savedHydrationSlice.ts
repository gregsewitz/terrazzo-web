import type { ImportedPlace, PlaceRating, GhostSourceType, Collection } from '@/types';
import { StateCreator } from 'zustand';
import { deriveCities, dbWrite } from './savedHelpers';
import { isPerriandIconName } from '@/components/icons/PerriandIcons';
import type { SavedState, DBSavedPlace, DBCollection } from './savedTypes';

// ═══════════════════════════════════════════
// Hydration slice state
// ═══════════════════════════════════════════

export interface SavedHydrationState {
  // DB hydration
  hydrateFromDB: (places: DBSavedPlace[], collections: DBCollection[]) => void;
}

// ═══════════════════════════════════════════
// Hydration slice factory
// ═══════════════════════════════════════════

export const createHydrationSlice: StateCreator<SavedState, [], [], SavedHydrationState> = (set, get) => ({
  hydrateFromDB: (dbPlaces, dbCollections) => {
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

    // Build a set of valid place IDs for fast lookup
    const validPlaceIds = new Set(places.map(p => p.id));

    // Map DB collections → store Collection format
    // Filter placeIds to only include IDs that exist in myPlaces (prune orphans)
    // Sanitize emoji to valid Perriand icon names only
    const collections: Collection[] = dbCollections.map(ds => {
      const rawIds: string[] = Array.isArray(ds.placeIds) ? ds.placeIds : [];
      const prunedIds = rawIds.filter(pid => validPlaceIds.has(pid));
      const hadOrphans = prunedIds.length !== rawIds.length;
      const rawEmoji = ds.emoji || 'pin';
      const emoji = isPerriandIconName(rawEmoji) ? rawEmoji : 'pin';
      const emojiChanged = emoji !== rawEmoji;

      // Write-back pruned placeIds and/or sanitized emoji to Supabase
      if (hadOrphans || emojiChanged) {
        const patch: Record<string, unknown> = {};
        if (hadOrphans) patch.placeIds = prunedIds;
        if (emojiChanged) patch.emoji = emoji;
        dbWrite(`/api/collections/${ds.id}`, 'PATCH', patch);
      }

      return {
        id: ds.id,
        name: ds.name,
        description: ds.description || undefined,
        emoji,
        placeIds: prunedIds,
        cities: deriveCities(prunedIds, places),
        isSmartCollection: ds.isSmartCollection,
        query: ds.query || undefined,
        filterTags: Array.isArray(ds.filterTags) ? ds.filterTags : undefined,
        createdAt: ds.createdAt,
        updatedAt: ds.updatedAt,
      };
    });

    set({ myPlaces: places, collections, history: [] });
  },
});
