import { Trip, ImportedPlace, TripDay, DEFAULT_TIME_SLOTS, TripCreationData } from '@/types';
import { StateCreator } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { dbWrite } from './tripHelpers';
import type { TripState } from './types';

// ═══════════════════════════════════════════
// DB types (shapes returned by API routes)
// ═══════════════════════════════════════════

export interface DBTrip {
  id: string;
  name: string;
  location: string;
  destinations?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  groupSize?: number | null;
  groupType?: string | null;
  days: TripDay[];
  pool?: ImportedPlace[] | null;
  conversationHistory?: unknown;
  status?: string | null;
}

// ═══════════════════════════════════════════
// Lazy demo data loader
// ═══════════════════════════════════════════

let _tripDemoLoaded = false;

/** Lazily load demo trip data. Safe to call multiple times. */
export async function initTripDemoData() {
  if (_tripDemoLoaded) return;
  _tripDemoLoaded = true;
  // Import the store dynamically to avoid circular dependencies
  const { useTripStore } = await import('../tripStore');
  const { ALL_DEMO_TRIPS } = await import('@/data/demoTrips');
  useTripStore.setState({
    trips: [...ALL_DEMO_TRIPS],
    currentTripId: 'demo-stockholm-copenhagen',
  });
}

// ═══════════════════════════════════════════
// Core slice state
// ═══════════════════════════════════════════

export interface TripCoreState {
  trips: Trip[];
  currentTripId: string | null;
  currentDay: number;

  // Getters
  currentTrip: () => Trip | undefined;
  poolItems: () => ImportedPlace[];
  unsortedCount: () => number;

  // Core actions
  setCurrentTrip: (id: string) => void;
  setCurrentDay: (day: number) => void;
  createTrip: (data: TripCreationData) => string;
  /** Returns a promise that resolves to the real (server-assigned) trip ID */
  createTripAsync: (data: TripCreationData) => Promise<string>;
  graduateToPlanning: (startDate: string, endDate: string, dayAllocation?: Record<string, number>) => void;
  hydrateFromDB: (trips: DBTrip[]) => void;
}

// ═══════════════════════════════════════════
// Core slice factory
// ═══════════════════════════════════════════

export const createCoreSlice: StateCreator<TripState, [], [], TripCoreState> = (set, get) => ({
  trips: [],
  currentTripId: null,
  currentDay: 1,

  currentTrip: () => {
    const state = get();
    return state.trips.find(t => t.id === state.currentTripId);
  },

  poolItems: () => {
    const trip = get().currentTrip();
    return trip?.pool.filter(p => p.status === 'available') ?? [];
  },

  unsortedCount: () => get().poolItems().length,

  setCurrentTrip: (id) => set({ currentTripId: id }),
  setCurrentDay: (day) => set({ currentDay: day }),

  createTrip: (data: TripCreationData) => {
    const id = `trip-${Date.now()}`;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Calculate number of days from date range
    const start = new Date(data.startDate + 'T00:00:00');
    const end = new Date(data.endDate + 'T00:00:00');
    const numDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Build destination-to-day mapping
    // If dayAllocation provided, use it; otherwise distribute evenly
    const destOrder: string[] = [];
    if (data.dayAllocation && data.destinations.length > 1) {
      for (const dest of data.destinations) {
        const count = data.dayAllocation[dest] || 1;
        for (let d = 0; d < count; d++) destOrder.push(dest);
      }
      while (destOrder.length < numDays) destOrder.push(data.destinations[data.destinations.length - 1]);
      if (destOrder.length > numDays) destOrder.length = numDays;
    } else if (data.destinations.length > 1) {
      for (let i = 0; i < numDays; i++) {
        const destIdx = Math.min(Math.floor(i / (numDays / data.destinations.length)), data.destinations.length - 1);
        destOrder.push(data.destinations[destIdx] || data.destinations[0]);
      }
    } else {
      for (let i = 0; i < numDays; i++) destOrder.push(data.destinations[0]);
    }

    // For dreaming trips without dates, create a minimal placeholder structure
    const isDreaming = data.status === 'dreaming';

    // Generate day structure with empty time slots
    const days: TripDay[] = isDreaming
      ? [] // dreaming trips start with no day structure — it's a collection/mood board
      : Array.from({ length: numDays }, (_, i) => {
          const date = new Date(start);
          date.setDate(date.getDate() + i);

          return {
            dayNumber: i + 1,
            date: `${monthNames[date.getMonth()]} ${date.getDate()}`,
            dayOfWeek: dayNames[date.getDay()],
            destination: destOrder[i],
            slots: DEFAULT_TIME_SLOTS.map(s => ({
              ...s,
              places: [],
              ghostItems: [],
            })),
          };
        });

    const newTrip: Trip = {
      id,
      name: data.name,
      location: data.destinations.join(', '),
      startDate: data.startDate,
      endDate: data.endDate,
      destinations: data.destinations,
      geoDestinations: data.geoDestinations,
      travelContext: data.travelContext,
      groupSize: data.groupSize,
      status: data.status,
      days,
      pool: [],
    };

    set(state => ({
      trips: [...state.trips, newTrip],
      currentTripId: id,
      currentDay: 1,
    }));

    // Create in DB and sync the real ID back to the store
    const payload = {
      name: data.name,
      destinations: data.destinations,
      startDate: data.startDate,
      endDate: data.endDate,
      groupSize: data.groupSize,
      groupType: data.travelContext,
      days: days,
      pool: [],
      status: data.status || 'planning',
    };
    (async () => {
      try {
        const res = await apiFetch('/api/trips/mine', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const realId = res?.trip?.id;
        if (realId && realId !== id) {
          set((state) => ({
            trips: state.trips.map(t =>
              t.id === id ? { ...t, id: realId } : t
            ),
            currentTripId: state.currentTripId === id ? realId : state.currentTripId,
          }));
        }
      } catch (err) {
        console.error('[createTrip] Failed to create on server:', err);
      }
    })();

    return id;
  },

  createTripAsync: async (data: TripCreationData) => {
    // Reuse the sync version's logic for building the trip object
    const tempId = `trip-${Date.now()}`;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const start = new Date(data.startDate + 'T00:00:00');
    const end = new Date(data.endDate + 'T00:00:00');
    const numDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const destOrder: string[] = [];
    if (data.dayAllocation && data.destinations.length > 1) {
      for (const dest of data.destinations) {
        const count = data.dayAllocation[dest] || 1;
        for (let d = 0; d < count; d++) destOrder.push(dest);
      }
      while (destOrder.length < numDays) destOrder.push(data.destinations[data.destinations.length - 1]);
      if (destOrder.length > numDays) destOrder.length = numDays;
    } else if (data.destinations.length > 1) {
      for (let i = 0; i < numDays; i++) {
        const destIdx = Math.min(Math.floor(i / (numDays / data.destinations.length)), data.destinations.length - 1);
        destOrder.push(data.destinations[destIdx] || data.destinations[0]);
      }
    } else {
      for (let i = 0; i < numDays; i++) destOrder.push(data.destinations[0]);
    }

    const isDreaming = data.status === 'dreaming';
    const days: TripDay[] = isDreaming
      ? []
      : Array.from({ length: numDays }, (_, i) => {
          const date = new Date(start);
          date.setDate(date.getDate() + i);
          return {
            dayNumber: i + 1,
            date: `${monthNames[date.getMonth()]} ${date.getDate()}`,
            dayOfWeek: dayNames[date.getDay()],
            destination: destOrder[i],
            slots: DEFAULT_TIME_SLOTS.map(s => ({ ...s, places: [], ghostItems: [] })),
          };
        });

    const newTrip: Trip = {
      id: tempId,
      name: data.name,
      location: data.destinations.join(', '),
      startDate: data.startDate,
      endDate: data.endDate,
      destinations: data.destinations,
      geoDestinations: data.geoDestinations,
      travelContext: data.travelContext,
      groupSize: data.groupSize,
      status: data.status,
      days,
      pool: [],
    };

    set(state => ({
      trips: [...state.trips, newTrip],
      currentTripId: tempId,
      currentDay: 1,
    }));

    try {
      const res = await apiFetch('/api/trips/mine', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          destinations: data.destinations,
          startDate: data.startDate,
          endDate: data.endDate,
          groupSize: data.groupSize,
          groupType: data.travelContext,
          days,
          pool: [],
          status: data.status || 'planning',
        }),
      });
      const realId = res?.trip?.id;
      if (realId && realId !== tempId) {
        set((state) => ({
          trips: state.trips.map(t =>
            t.id === tempId ? { ...t, id: realId } : t
          ),
          currentTripId: state.currentTripId === tempId ? realId : state.currentTripId,
        }));
        return realId;
      }
      return tempId;
    } catch (err) {
      console.error('[createTripAsync] Failed to create on server:', err);
      return tempId;
    }
  },

  // Graduate a dreaming trip to planning — generates day structure from dates
  graduateToPlanning: (startDate, endDate, dayAllocation) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    set(state => {
      const trip = state.trips.find(t => t.id === state.currentTripId);
      if (!trip) return state;

      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const numDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const dests = trip.destinations || [trip.location];

      // Build destination order
      const destOrder: string[] = [];
      if (dayAllocation && dests.length > 1) {
        for (const dest of dests) {
          const count = dayAllocation[dest] || 1;
          for (let d = 0; d < count; d++) destOrder.push(dest);
        }
        while (destOrder.length < numDays) destOrder.push(dests[dests.length - 1]);
        if (destOrder.length > numDays) destOrder.length = numDays;
      } else if (dests.length > 1) {
        for (let i = 0; i < numDays; i++) {
          const destIdx = Math.min(Math.floor(i / (numDays / dests.length)), dests.length - 1);
          destOrder.push(dests[destIdx] || dests[0]);
        }
      } else {
        for (let i = 0; i < numDays; i++) destOrder.push(dests[0]);
      }

      const days: TripDay[] = Array.from({ length: numDays }, (_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        return {
          dayNumber: i + 1,
          date: `${monthNames[date.getMonth()]} ${date.getDate()}`,
          dayOfWeek: dayNames[date.getDay()],
          destination: destOrder[i],
          slots: DEFAULT_TIME_SLOTS.map(s => ({ ...s, places: [], ghostItems: [] })),
        };
      });

      return {
        trips: state.trips.map(t =>
          t.id === trip.id
            ? { ...t, status: 'planning' as const, startDate, endDate, days }
            : t
        ),
      };
    });

    const tripId = get().currentTripId;
    if (tripId) {
      const { debouncedTripSave } = require('./tripHelpers');
      debouncedTripSave(tripId, () => {
        const t = get().trips.find(tr => tr.id === tripId);
        return t ? { days: t.days, status: t.status, startDate, endDate } : {};
      });
    }
  },

  // ─── DB Hydration ───
  hydrateFromDB: (dbTrips) => {
    // Normalize DB DateTime to YYYY-MM-DD string (or undefined)
    const toDateStr = (d: string | null | undefined): string | undefined => {
      if (!d) return undefined;
      try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return undefined;
        return date.toISOString().split('T')[0];
      } catch { return undefined; }
    };

    const trips: Trip[] = dbTrips.map(dt => ({
      id: dt.id,
      name: dt.name,
      location: dt.location,
      startDate: toDateStr(dt.startDate),
      endDate: toDateStr(dt.endDate),
      destinations: Array.isArray(dt.destinations) ? dt.destinations : undefined,
      groupSize: dt.groupSize || undefined,
      status: (dt.status as Trip['status']) || 'planning',
      days: Array.isArray(dt.days) ? dt.days : [],
      pool: Array.isArray(dt.pool) ? dt.pool : [],
    }));

    set({
      trips,
      currentTripId: trips.length > 0 ? trips[0].id : null,
      currentDay: 1,
    });
  },
});
