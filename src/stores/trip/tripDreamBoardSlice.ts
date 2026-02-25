import { DreamBoardEntry } from '@/types';
import { StateCreator } from 'zustand';
import { updateCurrentTrip, debouncedTripSave } from './tripHelpers';
import type { TripState } from './types';

// ═══════════════════════════════════════════
// Dream Board slice state
// ═══════════════════════════════════════════

export interface TripDreamBoardState {
  addDreamBoardEntry: (entry: Omit<DreamBoardEntry, 'id' | 'createdAt'>) => void;
  updateDreamBoardEntry: (entryId: string, updates: Partial<DreamBoardEntry>) => void;
  removeDreamBoardEntry: (entryId: string) => void;
  toggleDreamBoardPin: (entryId: string) => void;
}

// ═══════════════════════════════════════════
// Dream Board slice factory
// ═══════════════════════════════════════════

export const createDreamBoardSlice: StateCreator<TripState, [], [], TripDreamBoardState> = (set, get) => ({
  addDreamBoardEntry: (entry) => {
    const newEntry: DreamBoardEntry = {
      ...entry,
      id: `db-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: [...(trip.dreamBoard || trip.scratchpad || []), newEntry],
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { dreamBoard: t.dreamBoard || t.scratchpad } : {};
    });
  },

  updateDreamBoardEntry: (entryId, updates) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: (trip.dreamBoard || trip.scratchpad || []).map(e =>
          e.id === entryId ? { ...e, ...updates } : e
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { dreamBoard: t.dreamBoard || t.scratchpad } : {};
    });
  },

  removeDreamBoardEntry: (entryId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: (trip.dreamBoard || trip.scratchpad || []).filter(e => e.id !== entryId),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { dreamBoard: t.dreamBoard || t.scratchpad } : {};
    });
  },

  toggleDreamBoardPin: (entryId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: (trip.dreamBoard || trip.scratchpad || []).map(e =>
          e.id === entryId ? { ...e, pinned: !e.pinned } : e
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { dreamBoard: t.dreamBoard || t.scratchpad } : {};
    });
  },

});
