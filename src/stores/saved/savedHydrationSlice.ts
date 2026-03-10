import type { ImportedPlace, PlaceRating, GhostSourceType, Collection } from '@/types';
import { StateCreator } from 'zustand';
import { deriveCities, dbWrite } from './savedHelpers';
import { isPerriandIconName } from '@/components/icons/PerriandIcons';
import { normalizeMatchScoreForDisplay } from '@/lib/taste-match-vectors';
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
      matchScore: dp.matchScore ? normalizeMatchScoreForDisplay(dp.matchScore) : 0,
      matchBreakdown: (dp.matchBreakdown as ImportedPlace['matchBreakdown']) || { Design: 0, Atmosphere: 0, Character: 0, Service: 0, FoodDrink: 0, Setting: 0, Wellness: 0, Sustainability: 0 },
      matchExplanation: dp.matchExplanation as ImportedPlace['matchExplanation'],
      tasteNote: dp.tasteNote || dp.intelligence?.description || '',
      status: 'available' as const,
      ghostSource: (dp.ghostSource || 'manual') as GhostSourceType,
      rating: dp.rating as PlaceRating | undefined,
      friendAttribution: dp.friendAttribution as ImportedPlace['friendAttribution'],
      terrazzoInsight: dp.terrazzoInsight as ImportedPlace['terrazzoInsight'],
      enrichment: dp.intelligence?.description
        ? { ...(dp.enrichment as ImportedPlace['enrichment'] || {}), confidence: (dp.enrichment as any)?.confidence ?? 1, description: dp.intelligence.description } as ImportedPlace['enrichment']
        : dp.enrichment as ImportedPlace['enrichment'],
      google: normalizeGoogleData(dp.intelligence?.googleData || dp.googleData, dp.googlePlaceId),
      userContext: dp.userContext || undefined,
      timing: dp.timing || undefined,
      travelWith: dp.travelWith || undefined,
      intentStatus: dp.intentStatus as ImportedPlace['intentStatus'],
      savedAt: dp.createdAt || undefined,
      importBatchId: dp.importBatchId || undefined,
      whatToOrder: (dp.intelligence?.whatToOrder || dp.whatToOrder || undefined) as string[] | undefined,
      tips: (dp.intelligence?.tips || dp.tips || undefined) as string[] | undefined,
      alsoKnownAs: dp.intelligence?.alsoKnownAs || dp.alsoKnownAs || undefined,
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

      // Write-back sanitized emoji to Supabase (safe — icon name fix only).
      // NOTE: We intentionally do NOT write-back pruned placeIds here.
      // Orphan pruning is a local-only safety measure. Writing back could
      // destroy data if the place IDs are legitimately stored on the server
      // but failed to load in this particular hydration (e.g. pagination,
      // transient error, or a race with ID swaps). The server is the source
      // of truth for placeIds — let it keep what it has.
      if (emojiChanged) {
        dbWrite(`/api/collections/${ds.id}`, 'PATCH', { emoji });
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

/**
 * Normalize the raw googleData JSON blob into the GooglePlaceData shape.
 *
 * The Google Places API returns `id` (e.g. "ChIJ...") but our GooglePlaceData
 * interface expects `placeId`. Hydration needs to bridge this gap so the
 * frontend can reliably read `item.google.placeId`.
 *
 * Also falls back to the DB column `googlePlaceId` if the JSON blob doesn't
 * have either field (e.g. for places that were backfilled before this fix).
 */
function normalizeGoogleData(
  raw: unknown,
  dbGooglePlaceId?: string | null,
): ImportedPlace['google'] {
  if (!raw || typeof raw !== 'object') {
    // No googleData blob at all — synthesize minimal google object from DB column
    return dbGooglePlaceId ? { placeId: dbGooglePlaceId } : undefined;
  }

  const data = raw as Record<string, unknown>;

  // If placeId is already set, return as-is
  if (data.placeId) return raw as ImportedPlace['google'];

  // Map `id` → `placeId` (Google API field name → our interface)
  if (data.id && typeof data.id === 'string') {
    return { ...data, placeId: data.id } as unknown as ImportedPlace['google'];
  }

  // Last resort: use the DB column
  if (dbGooglePlaceId) {
    return { ...data, placeId: dbGooglePlaceId } as unknown as ImportedPlace['google'];
  }

  return raw as ImportedPlace['google'];
}
