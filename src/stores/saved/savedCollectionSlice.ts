import type { Collection } from '@/types';
import { StateCreator } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { dbWrite, DEFAULT_COLLECTION_ID, deriveCities } from './savedHelpers';
import type { SavedState } from './savedTypes';

// ═══════════════════════════════════════════
// Collection slice state
// ═══════════════════════════════════════════

export interface SavedCollectionState {
  // Core data
  collections: Collection[];

  // UI state
  activeView: 'collections' | 'library';

  // Actions
  setActiveView: (view: 'collections' | 'library') => void;
  /** @deprecated isFavorited is no longer used — curation happens at import time */
  toggleStar: (id: string) => void;
  createCollection: (name: string, emoji?: string, description?: string) => string;
  /** Returns a promise that resolves to the real (server-assigned) collection ID */
  createCollectionAsync: (name: string, emoji?: string, description?: string) => Promise<string>;
  deleteCollection: (id: string) => void;
  updateCollection: (id: string, updates: Partial<Pick<Collection, 'name' | 'emoji' | 'description'>>) => void;
  addPlaceToCollection: (collectionId: string, placeId: string) => void;
  removePlaceFromCollection: (collectionId: string, placeId: string) => void;
  createSmartCollection: (name: string, emoji: string, query: string, filterTags: string[], placeIds?: string[]) => string;
}

// ═══════════════════════════════════════════
// Collection slice factory
// ═══════════════════════════════════════════

export const createCollectionSlice: StateCreator<SavedState, [], [], SavedCollectionState> = (set, get) => ({
  collections: [],
  activeView: 'collections',

  setActiveView: (view) => set({ activeView: view }),

  toggleStar: (id) => {
    const state = get();
    const favCollection = state.collections.find(s => s.isDefault);
    if (!favCollection) return;

    const isCurrentlyFavorited = favCollection.placeIds.includes(id);
    const newPlaceIds = isCurrentlyFavorited
      ? favCollection.placeIds.filter(pid => pid !== id)
      : [...favCollection.placeIds, id];

    set({
      myPlaces: state.myPlaces.map((p) =>
        p.id === id ? { ...p, isFavorited: !isCurrentlyFavorited } : p
      ),
      collections: state.collections.map(sl =>
        sl.isDefault
          ? {
              ...sl,
              placeIds: newPlaceIds,
              cities: deriveCities(newPlaceIds, state.myPlaces),
              updatedAt: new Date().toISOString(),
            }
          : sl
      ),
    });

    // Write-through: update place + favorites collection
    dbWrite(`/api/places/${id}`, 'PATCH', { isFavorited: !isCurrentlyFavorited });
    if (favCollection.id !== DEFAULT_COLLECTION_ID) {
      dbWrite(`/api/collections/${favCollection.id}`, 'PATCH', { placeIds: newPlaceIds });
    }
  },

  createCollection: (name, emoji, description) => {
    const newId = `collection-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => ({
      collections: [
        ...state.collections,
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
    // Create in DB and sync the real ID back to the store
    (async () => {
      try {
        const res = await apiFetch<{ collection?: { id: string } }>('/api/collections', {
          method: 'POST',
          body: JSON.stringify({ name, emoji: emoji || 'pin', description }),
        });
        const realId = res?.collection?.id;
        if (realId && realId !== newId) {
          set((state) => ({
            collections: state.collections.map(sl =>
              sl.id === newId ? { ...sl, id: realId } : sl
            ),
          }));
        }
      } catch (err) {
        console.error('[createCollection] Failed to create on server:', err);
      }
    })();
    return newId;
  },

  createCollectionAsync: async (name, emoji, description) => {
    const tempId = `collection-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => ({
      collections: [
        ...state.collections,
        {
          id: tempId,
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
    try {
      const res = await apiFetch<{ collection?: { id: string } }>('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ name, emoji: emoji || 'pin', description }),
      });
      const realId = res?.collection?.id;
      if (realId && realId !== tempId) {
        set((state) => ({
          collections: state.collections.map(sl =>
            sl.id === tempId ? { ...sl, id: realId } : sl
          ),
        }));
        return realId;
      }
      return tempId;
    } catch (err) {
      console.error('[createCollectionAsync] Failed to create on server:', err);
      return tempId;
    }
  },

  deleteCollection: (id) => {
    const state = get();
    const sl = state.collections.find(s => s.id === id);
    if (sl?.isDefault) return; // Prevent deleting Favorites
    set({ collections: state.collections.filter(s => s.id !== id) });
    dbWrite(`/api/collections/${id}`, 'DELETE');
  },

  updateCollection: (id, updates) => {
    set((state) => ({
      collections: state.collections.map(sl =>
        sl.id === id
          ? { ...sl, ...updates, updatedAt: new Date().toISOString() }
          : sl
      ),
    }));
    dbWrite(`/api/collections/${id}`, 'PATCH', updates);
  },

  addPlaceToCollection: (collectionId, placeId) => {
    set((state) => {
      return {
        collections: state.collections.map(sl => {
          if (sl.id !== collectionId) return sl;
          if (sl.placeIds.includes(placeId)) return sl;
          const newPlaceIds = [...sl.placeIds, placeId];
          return {
            ...sl,
            placeIds: newPlaceIds,
            cities: deriveCities(newPlaceIds, state.myPlaces),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    });
    // Write-through
    const sl = get().collections.find(s => s.id === collectionId);
    if (sl) dbWrite(`/api/collections/${collectionId}`, 'PATCH', { placeIds: sl.placeIds });
  },

  removePlaceFromCollection: (collectionId, placeId) => {
    set((state) => {
      return {
        collections: state.collections.map(sl => {
          if (sl.id !== collectionId) return sl;
          const newPlaceIds = sl.placeIds.filter(pid => pid !== placeId);
          return {
            ...sl,
            placeIds: newPlaceIds,
            cities: deriveCities(newPlaceIds, state.myPlaces),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    });
    // Write-through
    const sl = get().collections.find(s => s.id === collectionId);
    if (sl) dbWrite(`/api/collections/${collectionId}`, 'PATCH', { placeIds: sl.placeIds });
  },

  createSmartCollection: (name, emoji, query, filterTags, placeIds) => {
    const newId = `collection-smart-${Date.now()}`;
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
              if (key === 'reaction' && val === 'saved') return true; // all library places are now "saved"
              return false;
            });
          })
          .map(p => p.id);

    set((state) => ({
      collections: [
        ...state.collections,
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
    // Create in DB and sync the real ID back to the store
    (async () => {
      try {
        const res = await apiFetch<{ collection?: { id: string } }>('/api/collections', {
          method: 'POST',
          body: JSON.stringify({
            name,
            emoji,
            isSmartCollection: true,
            query,
            filterTags,
            placeIds: resolvedIds,
          }),
        });
        const realId = res?.collection?.id;
        if (realId && realId !== newId) {
          set((state) => ({
            collections: state.collections.map(sl =>
              sl.id === newId ? { ...sl, id: realId } : sl
            ),
          }));
        }
      } catch (err) {
        console.error('[createSmartCollection] Failed to create on server:', err);
      }
    })();
    return newId;
  },
});
