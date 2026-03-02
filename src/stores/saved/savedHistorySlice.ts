import type { ImportedPlace } from '@/types';
import { StateCreator } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { dbWrite } from './savedHelpers';
import type { SavedState, HistoryItem } from './savedTypes';

// ═══════════════════════════════════════════
// History slice state
// ═══════════════════════════════════════════

export interface SavedHistoryState {
  // Core data
  history: HistoryItem[];

  // Actions
  promoteFromHistory: (id: string) => void;
  archiveToHistory: (id: string) => void;
  addHistoryItems: (items: HistoryItem[]) => void;
}

// ═══════════════════════════════════════════
// History slice factory
// ═══════════════════════════════════════════

export const createHistorySlice: StateCreator<SavedState, [], [], SavedHistoryState> = (set, get) => ({
  history: [],

  promoteFromHistory: (id) => {
    const state = get();
    const histItem = state.history.find((h) => h.id === id);
    if (!histItem) return;

    const clientId = `promoted-${id}`;
    const newPlace: ImportedPlace = {
      id: clientId,
      name: histItem.name,
      type: histItem.type,
      location: histItem.location,
      source: { type: 'email', name: `Promoted from ${histItem.detectedFrom}` },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0, Rhythm: 0.5, CulturalEngagement: 0.5 },
      tasteNote: '',
      status: 'available',
      ghostSource: 'manual',
    };

    set({
      myPlaces: [newPlace, ...state.myPlaces],
      history: state.history.filter((h) => h.id !== id),
    });

    // Save to server and swap the client ID → server ID (same pattern as addPlace).
    (async () => {
      try {
        const res = await apiFetch<{ place?: { id: string } }>('/api/places/save', {
          method: 'POST',
          body: JSON.stringify({
            name: newPlace.name,
            type: newPlace.type,
            location: newPlace.location,
            ghostSource: 'manual',
            matchScore: 0,
            matchBreakdown: newPlace.matchBreakdown,
          }),
        });
        const realId = res?.place?.id;
        if (realId && realId !== clientId) {
          const affectedCollectionIds: string[] = [];
          set((s) => {
            const updatedCollections = s.collections.map(c => {
              if (!c.placeIds.includes(clientId)) return c;
              affectedCollectionIds.push(c.id);
              return { ...c, placeIds: c.placeIds.map(pid => pid === clientId ? realId : pid) };
            });
            return {
              myPlaces: s.myPlaces.map(p => p.id === clientId ? { ...p, id: realId } : p),
              collections: updatedCollections,
            };
          });
          affectedCollectionIds.forEach(cid => {
            const col = get().collections.find(c => c.id === cid);
            if (col) dbWrite(`/api/collections/${cid}`, 'PATCH', { placeIds: col.placeIds });
          });
        }
      } catch (err) {
        console.error('[promoteFromHistory] Failed to save on server:', err);
      }
    })();
  },

  archiveToHistory: (id) => {
    const state = get();
    const place = state.myPlaces.find((p) => p.id === id);
    if (!place) return;

    const historyItem: HistoryItem = {
      id: `hist-archived-${id}`,
      name: place.name,
      type: place.type,
      location: place.location,
      detectedFrom: (place.source?.name as HistoryItem['detectedFrom']) || 'OpenTable',
      detectedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      ghostSource: place.ghostSource || 'manual',
    };

    // Also strip the place from any collections (local cleanup so state
    // is consistent even if the server DELETE is delayed or fails).
    const affectedCollectionIds: string[] = [];
    const updatedCollections = state.collections.map(c => {
      if (!c.placeIds.includes(id)) return c;
      affectedCollectionIds.push(c.id);
      return { ...c, placeIds: c.placeIds.filter(pid => pid !== id) };
    });

    set({
      myPlaces: state.myPlaces.filter((p) => p.id !== id),
      collections: updatedCollections,
      history: [historyItem, ...state.history],
    });

    // Write-through: remove archived place from DB
    dbWrite(`/api/places/${id}`, 'DELETE');

    // Re-PATCH affected collections so the server also removes the reference
    affectedCollectionIds.forEach(cid => {
      const col = get().collections.find(c => c.id === cid);
      if (col) dbWrite(`/api/collections/${cid}`, 'PATCH', { placeIds: col.placeIds });
    });
  },

  addHistoryItems: (items) => set((state) => {
    const existingNames = new Set(state.history.map(h => h.name.toLowerCase()));
    const newItems = items.filter(item => !existingNames.has(item.name.toLowerCase()));
    return {
      history: [...newItems, ...state.history],
    };
  }),
});
