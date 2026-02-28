import type { ImportedPlace, PlaceRating, PlaceType } from '@/types';
import { StateCreator } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { dbWrite } from './savedHelpers';
import type { SavedState } from './savedTypes';

// ═══════════════════════════════════════════
// Pending place ID tracking
// ═══════════════════════════════════════════

/**
 * Tracks client-side place IDs that haven't been confirmed by the server yet.
 * Any mutation (rate, edit, etc.) targeting a pending ID queues a callback
 * that receives the resolved (real) server ID once the swap completes.
 */
export const _pendingPlaceIds = new Map<string, Array<(resolvedId: string) => void>>();

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
    const clientId = place.id;

    // Local dedup: if a place with the same Google Place ID already exists
    // in the store, skip adding a duplicate (server also upserts on this).
    const googlePlaceId = place.google?.placeId;
    if (googlePlaceId) {
      const existing = get().myPlaces.find(p => p.google?.placeId === googlePlaceId);
      if (existing) return;
    }

    set((state) => ({ myPlaces: [stamped, ...state.myPlaces] }));

    // Mark this client ID as pending — mutations (ratePlace, etc.) will
    // queue their server writes until the real ID arrives.
    _pendingPlaceIds.set(clientId, []);

    // Save to DB and sync server-assigned ID back to store + collections.
    // Uses direct apiFetch (not fire-and-forget dbWrite) so we can read
    // the real ID from the response and update references everywhere.
    (async () => {
      try {
        const res = await apiFetch<{ place?: { id: string } }>('/api/places/save', {
          method: 'POST',
          body: JSON.stringify({
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
          }),
        });

        const realId = res?.place?.id;
        if (realId && realId !== clientId) {
          // Swap the client-side ID → server ID in myPlaces AND any
          // collection that already references the old client ID.
          const affectedCollectionIds: string[] = [];

          set((state) => {
            const updatedCollections = state.collections.map(c => {
              if (!c.placeIds.includes(clientId)) return c;
              affectedCollectionIds.push(c.id);
              return {
                ...c,
                placeIds: c.placeIds.map(pid => pid === clientId ? realId : pid),
              };
            });

            return {
              myPlaces: state.myPlaces.map(p =>
                p.id === clientId ? { ...p, id: realId } : p
              ),
              collections: updatedCollections,
            };
          });

          // Re-PATCH any collections whose placeIds changed so the DB
          // gets the corrected server IDs (not the stale client IDs).
          affectedCollectionIds.forEach(cid => {
            const col = get().collections.find(c => c.id === cid);
            if (col) {
              dbWrite(`/api/collections/${cid}`, 'PATCH', { placeIds: col.placeIds });
            }
          });

          // Also update trip pool items that reference the old client ID
          // via libraryPlaceId (cross-store, lazy-imported to avoid circular deps).
          try {
            const { useTripStore } = await import('../tripStore');
            const tripState = useTripStore.getState();
            let tripsDirty = false;
            const updatedTrips = tripState.trips.map(trip => {
              let poolDirty = false;
              const updatedPool = trip.pool.map(p => {
                if (p.libraryPlaceId === clientId || p.id === clientId) {
                  poolDirty = true;
                  return {
                    ...p,
                    id: p.id === clientId ? realId : p.id,
                    libraryPlaceId: realId,
                  };
                }
                return p;
              });
              if (!poolDirty) return trip;
              tripsDirty = true;
              return { ...trip, pool: updatedPool };
            });
            if (tripsDirty) {
              useTripStore.setState({ trips: updatedTrips });
              // Debounced saves for affected trips will pick up the new IDs
              // on their next fire — no need to force-save here.
            }
          } catch {
            // Trip store not available (e.g. during SSR) — skip silently
          }
        }

        // Flush any queued mutations (e.g. ratePlace called while pending)
        // now that the real ID is in the store.
        const finalId = realId || clientId;
        const queued = _pendingPlaceIds.get(clientId);
        _pendingPlaceIds.delete(clientId);
        if (queued) {
          queued.forEach(fn => fn(finalId));
        }
      } catch (err) {
        // On failure, still flush queued mutations — the place stays in
        // the store with its client ID, so mutations can still try.
        const queued = _pendingPlaceIds.get(clientId);
        _pendingPlaceIds.delete(clientId);
        if (queued) {
          queued.forEach(fn => fn(clientId));
        }
        console.error('[addPlace] Failed to save on server:', err);
      }
    })();
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
    // Update the store optimistically (always immediate).
    set((state) => ({
      myPlaces: state.myPlaces.map((p) =>
        p.id === id ? { ...p, rating } : p
      ),
    }));

    // If this place still has a pending temp ID, queue the server write
    // until addPlace completes the ID swap and flushes the queue.
    // The callback receives the resolved (real) server ID.
    const pendingQueue = _pendingPlaceIds.get(id);
    if (pendingQueue) {
      pendingQueue.push((resolvedId) => {
        dbWrite(`/api/places/${resolvedId}`, 'PATCH', { rating });
      });
      return;
    }

    dbWrite(`/api/places/${id}`, 'PATCH', { rating });
  },
});
