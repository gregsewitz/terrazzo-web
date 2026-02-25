import type { Shortlist } from '@/types';
import { StateCreator } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { dbWrite, DEFAULT_SHORTLIST_ID, deriveCities } from './savedHelpers';
import type { SavedState } from './savedTypes';

// ═══════════════════════════════════════════
// Shortlist slice state
// ═══════════════════════════════════════════

export interface SavedShortlistState {
  // Core data
  shortlists: Shortlist[];

  // UI state
  activeView: 'shortlists' | 'library';

  // Actions
  setActiveView: (view: 'shortlists' | 'library') => void;
  toggleStar: (id: string) => void;
  createShortlist: (name: string, emoji?: string, description?: string) => string;
  /** Returns a promise that resolves to the real (server-assigned) shortlist ID */
  createShortlistAsync: (name: string, emoji?: string, description?: string) => Promise<string>;
  deleteShortlist: (id: string) => void;
  updateShortlist: (id: string, updates: Partial<Pick<Shortlist, 'name' | 'emoji' | 'description'>>) => void;
  addPlaceToShortlist: (shortlistId: string, placeId: string) => void;
  removePlaceFromShortlist: (shortlistId: string, placeId: string) => void;
  createSmartShortlist: (name: string, emoji: string, query: string, filterTags: string[], placeIds?: string[]) => string;
}

// ═══════════════════════════════════════════
// Shortlist slice factory
// ═══════════════════════════════════════════

export const createShortlistSlice: StateCreator<SavedState, [], [], SavedShortlistState> = (set, get) => ({
  shortlists: [],
  activeView: 'shortlists',

  setActiveView: (view) => set({ activeView: view }),

  toggleStar: (id) => {
    const state = get();
    const favShortlist = state.shortlists.find(s => s.isDefault);
    if (!favShortlist) return;

    const isCurrentlyFavorited = favShortlist.placeIds.includes(id);
    const newPlaceIds = isCurrentlyFavorited
      ? favShortlist.placeIds.filter(pid => pid !== id)
      : [...favShortlist.placeIds, id];

    set({
      myPlaces: state.myPlaces.map((p) =>
        p.id === id ? { ...p, isShortlisted: !isCurrentlyFavorited } : p
      ),
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
    });

    // Write-through: update place + favorites shortlist
    dbWrite(`/api/places/${id}`, 'PATCH', { isShortlisted: !isCurrentlyFavorited });
    if (favShortlist.id !== DEFAULT_SHORTLIST_ID) {
      dbWrite(`/api/shortlists/${favShortlist.id}`, 'PATCH', { placeIds: newPlaceIds });
    }
  },

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
    // Create in DB and sync the real ID back to the store
    (async () => {
      try {
        const res = await apiFetch('/api/shortlists', {
          method: 'POST',
          body: JSON.stringify({ name, emoji: emoji || 'pin', description }),
        });
        const realId = res?.shortlist?.id;
        if (realId && realId !== newId) {
          set((state) => ({
            shortlists: state.shortlists.map(sl =>
              sl.id === newId ? { ...sl, id: realId } : sl
            ),
          }));
        }
      } catch (err) {
        console.error('[createShortlist] Failed to create on server:', err);
      }
    })();
    return newId;
  },

  createShortlistAsync: async (name, emoji, description) => {
    const tempId = `shortlist-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => ({
      shortlists: [
        ...state.shortlists,
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
      const res = await apiFetch('/api/shortlists', {
        method: 'POST',
        body: JSON.stringify({ name, emoji: emoji || 'pin', description }),
      });
      const realId = res?.shortlist?.id;
      if (realId && realId !== tempId) {
        set((state) => ({
          shortlists: state.shortlists.map(sl =>
            sl.id === tempId ? { ...sl, id: realId } : sl
          ),
        }));
        return realId;
      }
      return tempId;
    } catch (err) {
      console.error('[createShortlistAsync] Failed to create on server:', err);
      return tempId;
    }
  },

  deleteShortlist: (id) => {
    const state = get();
    const sl = state.shortlists.find(s => s.id === id);
    if (sl?.isDefault) return; // Prevent deleting Favorites
    set({ shortlists: state.shortlists.filter(s => s.id !== id) });
    dbWrite(`/api/shortlists/${id}`, 'DELETE');
  },

  updateShortlist: (id, updates) => {
    set((state) => ({
      shortlists: state.shortlists.map(sl =>
        sl.id === id
          ? { ...sl, ...updates, updatedAt: new Date().toISOString() }
          : sl
      ),
    }));
    dbWrite(`/api/shortlists/${id}`, 'PATCH', updates);
  },

  addPlaceToShortlist: (shortlistId, placeId) => {
    set((state) => {
      return {
        shortlists: state.shortlists.map(sl => {
          if (sl.id !== shortlistId) return sl;
          if (sl.placeIds.includes(placeId)) return sl;
          const newPlaceIds = [...sl.placeIds, placeId];
          return {
            ...sl,
            placeIds: newPlaceIds,
            cities: deriveCities(newPlaceIds, state.myPlaces),
            updatedAt: new Date().toISOString(),
          };
        }),
        myPlaces: shortlistId === DEFAULT_SHORTLIST_ID
          ? state.myPlaces.map(p => p.id === placeId ? { ...p, isShortlisted: true } : p)
          : state.myPlaces,
      };
    });
    // Write-through
    const sl = get().shortlists.find(s => s.id === shortlistId);
    if (sl) dbWrite(`/api/shortlists/${shortlistId}`, 'PATCH', { placeIds: sl.placeIds });
    if (shortlistId === DEFAULT_SHORTLIST_ID) {
      dbWrite(`/api/places/${placeId}`, 'PATCH', { isShortlisted: true });
    }
  },

  removePlaceFromShortlist: (shortlistId, placeId) => {
    set((state) => {
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
        myPlaces: shortlistId === DEFAULT_SHORTLIST_ID
          ? state.myPlaces.map(p => p.id === placeId ? { ...p, isShortlisted: false } : p)
          : state.myPlaces,
      };
    });
    // Write-through
    const sl = get().shortlists.find(s => s.id === shortlistId);
    if (sl) dbWrite(`/api/shortlists/${shortlistId}`, 'PATCH', { placeIds: sl.placeIds });
    if (shortlistId === DEFAULT_SHORTLIST_ID) {
      dbWrite(`/api/places/${placeId}`, 'PATCH', { isShortlisted: false });
    }
  },

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
    // Create in DB and sync the real ID back to the store
    (async () => {
      try {
        const res = await apiFetch('/api/shortlists', {
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
        const realId = res?.shortlist?.id;
        if (realId && realId !== newId) {
          set((state) => ({
            shortlists: state.shortlists.map(sl =>
              sl.id === newId ? { ...sl, id: realId } : sl
            ),
          }));
        }
      } catch (err) {
        console.error('[createSmartShortlist] Failed to create on server:', err);
      }
    })();
    return newId;
  },
});
