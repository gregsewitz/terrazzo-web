import { DreamBoardEntry, DreamBoardEntryType } from '@/types';
import { StateCreator } from 'zustand';
import { updateCurrentTrip, debouncedTripSave } from './tripHelpers';
import type { TripState } from './types';
import { migrateEntryType, detectEntryType } from '@/components/dream-board/helpers';

// ═══════════════════════════════════════════
// Dream Board slice state
// ═══════════════════════════════════════════

export interface TripDreamBoardState {
  addDreamBoardEntry: (entry: Omit<DreamBoardEntry, 'id' | 'createdAt'>) => void;
  addDreamBoardText: (content: string, section?: string) => void;
  addDreamBoardChecklist: (title: string, items?: string[], section?: string) => void;
  addDreamBoardDivider: (label: string) => void;
  updateDreamBoardEntry: (entryId: string, updates: Partial<DreamBoardEntry>) => void;
  removeDreamBoardEntry: (entryId: string) => void;
  toggleDreamBoardPin: (entryId: string) => void;
  moveDreamBoardEntry: (entryId: string, targetSection?: string) => void;
  getDreamBoardEntries: () => DreamBoardEntry[];
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function genId(): string {
  return `db-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Read dream board entries with legacy type migration */
function readEntries(trip: { dreamBoard?: DreamBoardEntry[]; scratchpad?: DreamBoardEntry[] }): DreamBoardEntry[] {
  const raw = trip.dreamBoard || trip.scratchpad || [];
  return raw.map(e => ({
    ...e,
    type: migrateEntryType(e.type) as DreamBoardEntryType,
  }));
}

/** Persist dream board to server */
function persistDreamBoard(tripId: string, get: () => TripState) {
  debouncedTripSave(tripId, () => {
    const t = get().trips.find(tr => tr.id === tripId);
    return t ? { dreamBoard: readEntries(t) } : {};
  });
}

// ═══════════════════════════════════════════
// Dream Board slice factory
// ═══════════════════════════════════════════

export const createDreamBoardSlice: StateCreator<TripState, [], [], TripDreamBoardState> = (set, get) => ({
  // ── Generic add ──
  addDreamBoardEntry: (entry) => {
    const newEntry: DreamBoardEntry = {
      ...entry,
      id: genId(),
      createdAt: new Date().toISOString(),
    };
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: [...readEntries(trip), newEntry],
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Freeform text add with smart URL detection ──
  addDreamBoardText: (content, section) => {
    const type = detectEntryType(content);
    const newEntry: DreamBoardEntry = {
      id: genId(),
      type,
      content,
      ...(section && { section }),
      createdAt: new Date().toISOString(),
    };
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: [...readEntries(trip), newEntry],
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Checklist add ──
  addDreamBoardChecklist: (title, items, section) => {
    const newEntry: DreamBoardEntry = {
      id: genId(),
      type: 'checklist',
      content: '',
      title: title || 'Checklist',
      items: (items || []).map(t => ({ text: t, done: false })),
      ...(section && { section }),
      createdAt: new Date().toISOString(),
    };
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: [...readEntries(trip), newEntry],
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Section divider add ──
  addDreamBoardDivider: (label) => {
    const newEntry: DreamBoardEntry = {
      id: genId(),
      type: 'divider',
      content: '',
      title: label,
      createdAt: new Date().toISOString(),
    };
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: [...readEntries(trip), newEntry],
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Update ──
  updateDreamBoardEntry: (entryId, updates) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: readEntries(trip).map(e =>
          e.id === entryId ? { ...e, ...updates } : e
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Remove (cleans up section children when removing a divider) ──
  removeDreamBoardEntry: (entryId) => {
    set(state =>
      updateCurrentTrip(state, trip => {
        const entries = readEntries(trip);
        const entry = entries.find(e => e.id === entryId);
        const updated = entry?.type === 'divider'
          ? entries
              .filter(e => e.id !== entryId)
              .map(e => e.section === entryId ? { ...e, section: undefined } : e)
          : entries.filter(e => e.id !== entryId);
        return { ...trip, dreamBoard: updated };
      })
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Toggle pin ──
  toggleDreamBoardPin: (entryId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: readEntries(trip).map(e =>
          e.id === entryId ? { ...e, pinned: !e.pinned } : e
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Move entry to a different section ──
  moveDreamBoardEntry: (entryId, targetSection) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        dreamBoard: readEntries(trip).map(e =>
          e.id === entryId ? { ...e, section: targetSection } : e
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) persistDreamBoard(tripId, get);
  },

  // ── Read with migration ──
  getDreamBoardEntries: () => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    return trip ? readEntries(trip) : [];
  },
});
