import { StateCreator } from 'zustand';
import { TripDay, ImportedPlace } from '@/types';
import { debouncedTripSave } from './tripHelpers';
import type { TripState } from './types';

// ═══════════════════════════════════════════
// History snapshot type
// ═══════════════════════════════════════════

interface TripSnapshot {
  days: TripDay[];
  pool: ImportedPlace[];
  currentDay: number;
  /** Human-readable label for the action that was taken (shown in tooltip) */
  label: string;
}

// ═══════════════════════════════════════════
// History slice state
// ═══════════════════════════════════════════

export interface TripHistoryState {
  /** Undo stack — most recent snapshot on top */
  _undoStack: TripSnapshot[];
  /** Redo stack — populated when undo is used */
  _redoStack: TripSnapshot[];
  /** Max number of undo steps to keep */
  _maxHistory: number;

  /** Capture a snapshot of the current trip before a mutation */
  pushSnapshot: (label: string) => void;
  /** Undo the last action */
  undo: () => void;
  /** Redo the last undone action */
  redo: () => void;
  /** Whether undo is available */
  canUndo: () => boolean;
  /** Whether redo is available */
  canRedo: () => boolean;
  /** Get the label of the action that would be undone */
  undoLabel: () => string | null;
  /** Clear all history (e.g. when switching trips) */
  clearHistory: () => void;
}

// ═══════════════════════════════════════════
// History slice factory
// ═══════════════════════════════════════════

export const createHistorySlice: StateCreator<TripState, [], [], TripHistoryState> = (set, get) => ({
  _undoStack: [],
  _redoStack: [],
  _maxHistory: 30,

  pushSnapshot: (label) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    // Deep clone the relevant state to avoid reference sharing
    const snapshot: TripSnapshot = {
      days: JSON.parse(JSON.stringify(trip.days)),
      pool: JSON.parse(JSON.stringify(trip.pool)),
      currentDay: state.currentDay,
      label,
    };

    set(s => ({
      _undoStack: [...s._undoStack, snapshot].slice(-s._maxHistory),
      // Any new action clears the redo stack
      _redoStack: [],
    }));
  },

  undo: () => {
    const state = get();
    const { _undoStack } = state;
    if (_undoStack.length === 0) return;

    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    // Save current state to redo stack before reverting
    const currentSnapshot: TripSnapshot = {
      days: JSON.parse(JSON.stringify(trip.days)),
      pool: JSON.parse(JSON.stringify(trip.pool)),
      currentDay: state.currentDay,
      label: _undoStack[_undoStack.length - 1].label,
    };

    // Pop the most recent snapshot
    const prevSnapshot = _undoStack[_undoStack.length - 1];

    set(s => ({
      trips: s.trips.map(t =>
        t.id === s.currentTripId
          ? { ...t, days: prevSnapshot.days, pool: prevSnapshot.pool }
          : t
      ),
      currentDay: prevSnapshot.currentDay,
      _undoStack: s._undoStack.slice(0, -1),
      _redoStack: [...s._redoStack, currentSnapshot],
    }));

    // Persist the restored state
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool } : {};
    });
  },

  redo: () => {
    const state = get();
    const { _redoStack } = state;
    if (_redoStack.length === 0) return;

    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    // Save current state to undo stack before redoing
    const currentSnapshot: TripSnapshot = {
      days: JSON.parse(JSON.stringify(trip.days)),
      pool: JSON.parse(JSON.stringify(trip.pool)),
      currentDay: state.currentDay,
      label: _redoStack[_redoStack.length - 1].label,
    };

    // Pop the most recent redo snapshot
    const nextSnapshot = _redoStack[_redoStack.length - 1];

    set(s => ({
      trips: s.trips.map(t =>
        t.id === s.currentTripId
          ? { ...t, days: nextSnapshot.days, pool: nextSnapshot.pool }
          : t
      ),
      currentDay: nextSnapshot.currentDay,
      _undoStack: [...s._undoStack, currentSnapshot],
      _redoStack: s._redoStack.slice(0, -1),
    }));

    // Persist the restored state
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool } : {};
    });
  },

  canUndo: () => get()._undoStack.length > 0,
  canRedo: () => get()._redoStack.length > 0,
  undoLabel: () => {
    const stack = get()._undoStack;
    return stack.length > 0 ? stack[stack.length - 1].label : null;
  },
  clearHistory: () => set({ _undoStack: [], _redoStack: [] }),
});
