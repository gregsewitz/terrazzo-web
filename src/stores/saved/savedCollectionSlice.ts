import type { Collection } from '@/types';
import { StateCreator } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { dbWrite, deriveCities } from './savedHelpers';
import { isPerriandIconName } from '@/components/icons/PerriandIcons';
import type { SavedState } from './savedTypes';

/** Sanitize emoji to a valid Perriand icon name, defaulting to 'pin' */
function safeEmoji(raw?: string): string {
  return raw && isPerriandIconName(raw) ? raw : 'pin';
}

// ── Temp → Real ID resolution ─────────────────────────────────────────
// Tracks optimistic client IDs that haven't been confirmed by the server
// yet. Entries are cleaned up once the real ID arrives.
const _pendingCollectionIds = new Set<string>();

/**
 * Resolve a collection ID that might be a stale temp ID.
 * After createCollection(Async) swaps temp → real in the store,
 * callers that captured the temp ID will no longer find it.
 * This helper falls back to finding by other means.
 */
function resolveCollectionInStore(
  collections: Collection[],
  id: string,
): Collection | undefined {
  // Fast path: exact match (works for real IDs and pre-swap temp IDs)
  const exact = collections.find(c => c.id === id);
  if (exact) return exact;
  // If the ID looks like a temp ID that was already swapped, we can't
  // reliably find it. Return undefined — the caller should skip the write
  // (the ID swap handler will re-PATCH with the correct data).
  return undefined;
}

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

  createCollection: (name, emoji, description) => {
    const validEmoji = safeEmoji(emoji);
    const newId = `collection-${Date.now()}`;
    const now = new Date().toISOString();
    _pendingCollectionIds.add(newId);
    set((state) => ({
      collections: [
        ...state.collections,
        {
          id: newId,
          name,
          emoji: validEmoji,
          description,
          placeIds: [],
          cities: [],
          isSmartCollection: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    // Create in DB and sync the real ID back to the store.
    // After swap, re-PATCH the collection if it gained placeIds while
    // still using the temp ID (fixes the race where adds happen before
    // the server responds).
    (async () => {
      try {
        const res = await apiFetch<{ collection?: { id: string } }>('/api/collections', {
          method: 'POST',
          body: JSON.stringify({ name, emoji: validEmoji, description }),
        });
        const realId = res?.collection?.id;
        if (realId && realId !== newId) {
          // Capture placeIds that may have accumulated under the temp ID
          const preSwap = get().collections.find(c => c.id === newId);
          const placeIds = preSwap?.placeIds ?? [];

          set((state) => ({
            collections: state.collections.map(sl =>
              sl.id === newId ? { ...sl, id: realId } : sl
            ),
          }));
          _pendingCollectionIds.delete(newId);

          // If places were added while the temp ID was active, persist
          // them now under the real server ID.
          if (placeIds.length > 0) {
            dbWrite(`/api/collections/${realId}`, 'PATCH', { placeIds });
          }
        } else {
          _pendingCollectionIds.delete(newId);
        }
      } catch (err) {
        _pendingCollectionIds.delete(newId);
        console.error('[createCollection] Failed to create on server:', err);
      }
    })();
    return newId;
  },

  createCollectionAsync: async (name, emoji, description) => {
    const validEmoji = safeEmoji(emoji);
    const tempId = `collection-${Date.now()}`;
    const now = new Date().toISOString();

    // Track this temp ID so addPlaceToCollection/removePlaceFromCollection
    // skip DB writes while the server round-trip is in flight.
    _pendingCollectionIds.add(tempId);

    set((state) => ({
      collections: [
        ...state.collections,
        {
          id: tempId,
          name,
          emoji: validEmoji,
          description,
          placeIds: [],
          cities: [],
          isSmartCollection: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    try {
      const res = await apiFetch<{ collection?: { id: string } }>('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ name, emoji: validEmoji, description }),
      });
      const realId = res?.collection?.id;
      if (realId && realId !== tempId) {
        // Check if places were added during the await
        const preSwap = get().collections.find(c => c.id === tempId);
        const placeIds = preSwap?.placeIds ?? [];

        set((state) => ({
          collections: state.collections.map(sl =>
            sl.id === tempId ? { ...sl, id: realId } : sl
          ),
        }));
        _pendingCollectionIds.delete(tempId);

        // If places accumulated under the temp ID, persist them under the real ID
        if (placeIds.length > 0) {
          dbWrite(`/api/collections/${realId}`, 'PATCH', { placeIds });
        }

        return realId;
      }
      _pendingCollectionIds.delete(tempId);
      return tempId;
    } catch (err) {
      _pendingCollectionIds.delete(tempId);
      console.error('[createCollectionAsync] Failed to create on server:', err);
      return tempId;
    }
  },

  deleteCollection: (id) => {
    set({ collections: get().collections.filter(s => s.id !== id) });
    dbWrite(`/api/collections/${id}`, 'DELETE');
  },

  updateCollection: (id, updates) => {
    const sanitized = updates.emoji !== undefined
      ? { ...updates, emoji: safeEmoji(updates.emoji) }
      : updates;
    set((state) => ({
      collections: state.collections.map(sl =>
        sl.id === id
          ? { ...sl, ...sanitized, updatedAt: new Date().toISOString() }
          : sl
      ),
    }));
    dbWrite(`/api/collections/${id}`, 'PATCH', sanitized);
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
    // Write-through — use the collection's actual ID (may differ from
    // param if the temp → real swap already happened).
    const sl = resolveCollectionInStore(get().collections, collectionId);
    if (sl) {
      // If the collection still has a pending temp ID, skip the write —
      // the createCollection ID-swap handler will re-PATCH.
      if (!_pendingCollectionIds.has(sl.id)) {
        dbWrite(`/api/collections/${sl.id}`, 'PATCH', { placeIds: sl.placeIds });
      }
    }
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
    // Write-through — use the collection's actual ID
    const sl = resolveCollectionInStore(get().collections, collectionId);
    if (sl) {
      if (!_pendingCollectionIds.has(sl.id)) {
        dbWrite(`/api/collections/${sl.id}`, 'PATCH', { placeIds: sl.placeIds });
      }
    }
  },

  createSmartCollection: (name, emoji, query, filterTags, placeIds) => {
    const validEmoji = safeEmoji(emoji);
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
          emoji: validEmoji,
          placeIds: resolvedIds,
          cities: deriveCities(resolvedIds, state.myPlaces),
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
            emoji: validEmoji,
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
