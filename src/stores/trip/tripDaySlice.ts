import { TripDay, DEFAULT_TIME_SLOTS, HotelInfo, TransportEvent, ImportedPlace } from '@/types';
import { StateCreator } from 'zustand';
import { updateCurrentTrip, debouncedTripSave } from './tripHelpers';
import type { TripState } from './types';

// ═══════════════════════════════════════════
// Day management slice state
// ═══════════════════════════════════════════

export interface TripDayState {
  setDayDestination: (dayNumber: number, destination: string) => void;
  reorderDays: (fromDayNumber: number, toDayNumber: number) => void;
  /** Remove a day from the trip, moving its placed items back to the pool */
  deleteDay: (dayNumber: number) => void;
  /** Insert a blank day before or after a given day */
  insertDay: (position: 'before' | 'after', refDayNumber: number) => void;
  /** Clone a day's structure (destination, hotel, transport) with empty slots, insert after */
  duplicateDay: (dayNumber: number) => void;
  /** Return all placed items to pool, keep destination/hotel/transport */
  clearDay: (dayNumber: number) => void;
  addDestinationToTrip: (destination: string, maybePlace?: ImportedPlace) => void;
  setDayHotel: (dayNumber: number, hotel: string) => void;
  setMultipleDaysHotel: (dayNumbers: number[], hotel: string) => void;
  setDayHotelInfo: (dayNumber: number, hotelInfo: HotelInfo | null) => void;
  setMultipleDaysHotelInfo: (dayNumbers: number[], hotelInfo: HotelInfo) => void;
  addTransport: (dayNumber: number, transport: Omit<TransportEvent, 'id'>) => void;
  updateTransport: (dayNumber: number, transportId: string, updates: Partial<TransportEvent>) => void;
  removeTransport: (dayNumber: number, transportId: string) => void;
}

// ═══════════════════════════════════════════
// Day management slice factory
// ═══════════════════════════════════════════

export const createDaySlice: StateCreator<TripState, [], [], TripDayState> = (set, get) => ({
  setDayDestination: (dayNumber, destination) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          d.dayNumber === dayNumber ? { ...d, destination } : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  reorderDays: (fromDayNumber, toDayNumber) => {
    if (fromDayNumber === toDayNumber) return;
    set(state =>
      updateCurrentTrip(state, trip => {
        const days = [...trip.days];
        const fromIdx = days.findIndex(d => d.dayNumber === fromDayNumber);
        const toIdx = days.findIndex(d => d.dayNumber === toDayNumber);
        if (fromIdx === -1 || toIdx === -1) return trip;
        // Remove from old position and insert at new position
        const [moved] = days.splice(fromIdx, 1);
        days.splice(toIdx, 0, moved);
        // Reassign dayNumbers sequentially (1-based) to keep them consistent
        const renumbered = days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
        return { ...trip, days: renumbered };
      })
    );
    // Update currentDay to follow the moved day
    const trip = get().trips.find(t => t.id === get().currentTripId);
    if (trip) {
      const movedDay = trip.days.find(d => d.dayNumber !== undefined);
      // currentDay should track to the new position of the moved day
      const fromIdx = fromDayNumber - 1;
      const toIdx = toDayNumber - 1;
      const currentDay = get().currentDay;
      if (currentDay === fromDayNumber) {
        set({ currentDay: toDayNumber });
      } else if (fromDayNumber < toDayNumber && currentDay > fromDayNumber && currentDay <= toDayNumber) {
        set({ currentDay: currentDay - 1 });
      } else if (fromDayNumber > toDayNumber && currentDay >= toDayNumber && currentDay < fromDayNumber) {
        set({ currentDay: currentDay + 1 });
      }
    }
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  deleteDay: (dayNumber) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip || trip.days.length <= 1) return; // never delete the last day

    const dayToDelete = trip.days.find(d => d.dayNumber === dayNumber);
    if (!dayToDelete) return;

    // Collect placed items from the deleted day → return to pool
    const returnedItems = dayToDelete.slots
      .flatMap(s => s.places)
      .map(p => ({ ...p, status: 'available' as const }));

    // Remove the day and renumber sequentially
    const remaining = trip.days
      .filter(d => d.dayNumber !== dayNumber)
      .map((d, i) => ({ ...d, dayNumber: i + 1 }));

    // Recalculate endDate for fixed-date trips
    let newEndDate = trip.endDate;
    if (!trip.flexibleDates && trip.endDate && trip.startDate) {
      const start = new Date(trip.startDate + 'T00:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + remaining.length - 1);
      newEndDate = end.toISOString().split('T')[0];
    }

    // Recalculate destinations from remaining days
    const newDestinations = [...new Set(remaining.map(d => d.destination).filter(Boolean))] as string[];

    set(state2 => ({
      trips: state2.trips.map(t =>
        t.id === state2.currentTripId
          ? {
              ...t,
              days: remaining,
              pool: [...t.pool, ...returnedItems],
              endDate: newEndDate,
              destinations: newDestinations,
              location: newDestinations.join(', '),
            }
          : t
      ),
      // Navigate to adjacent day
      currentDay: dayNumber > remaining.length ? remaining.length : dayNumber,
    }));

    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool, endDate: t.endDate, destinations: t.destinations } : {};
    });
  },

  insertDay: (position, refDayNumber) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    const refIdx = trip.days.findIndex(d => d.dayNumber === refDayNumber);
    if (refIdx === -1) return;

    const insertIdx = position === 'before' ? refIdx : refIdx + 1;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const newDay: TripDay = {
      dayNumber: 0, // will be renumbered
      slots: DEFAULT_TIME_SLOTS.map(s => ({ ...s, places: [], ghostItems: [] })),
    };

    const newDays = [...trip.days];
    newDays.splice(insertIdx, 0, newDay);
    const renumbered = newDays.map((d, i) => ({ ...d, dayNumber: i + 1 }));

    // Recalculate dates for fixed-date trips
    let newEndDate = trip.endDate;
    if (!trip.flexibleDates && trip.startDate) {
      const start = new Date(trip.startDate + 'T00:00:00');
      renumbered.forEach((d, i) => {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + i);
        d.date = `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}`;
        d.dayOfWeek = dayNames[dayDate.getDay()];
      });
      const end = new Date(start);
      end.setDate(end.getDate() + renumbered.length - 1);
      newEndDate = end.toISOString().split('T')[0];
    }

    const newDayNumber = insertIdx + 1;

    set(state2 => ({
      trips: state2.trips.map(t =>
        t.id === state2.currentTripId
          ? { ...t, days: renumbered, endDate: newEndDate }
          : t
      ),
      currentDay: newDayNumber,
    }));

    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, endDate: t.endDate } : {};
    });
  },

  duplicateDay: (dayNumber) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    const srcDay = trip.days.find(d => d.dayNumber === dayNumber);
    if (!srcDay) return;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Clone structure with empty slots
    const cloned: TripDay = {
      dayNumber: 0, // will be renumbered
      destination: srcDay.destination,
      hotel: srcDay.hotel,
      hotelInfo: srcDay.hotelInfo ? { ...srcDay.hotelInfo } : undefined,
      transport: srcDay.transport ? srcDay.transport.map(t => ({
        ...t,
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })) : undefined,
      slots: srcDay.slots.map(s => ({ ...s, places: [], ghostItems: [] })),
    };

    const srcIdx = trip.days.findIndex(d => d.dayNumber === dayNumber);
    const newDays = [...trip.days];
    newDays.splice(srcIdx + 1, 0, cloned);
    const renumbered = newDays.map((d, i) => ({ ...d, dayNumber: i + 1 }));

    // Recalculate dates for fixed-date trips
    let newEndDate = trip.endDate;
    if (!trip.flexibleDates && trip.startDate) {
      const start = new Date(trip.startDate + 'T00:00:00');
      renumbered.forEach((d, i) => {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + i);
        d.date = `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}`;
        d.dayOfWeek = dayNames[dayDate.getDay()];
      });
      const end = new Date(start);
      end.setDate(end.getDate() + renumbered.length - 1);
      newEndDate = end.toISOString().split('T')[0];
    }

    const newDestinations = [...new Set(renumbered.map(d => d.destination).filter(Boolean))] as string[];

    set(state2 => ({
      trips: state2.trips.map(t =>
        t.id === state2.currentTripId
          ? { ...t, days: renumbered, endDate: newEndDate, destinations: newDestinations, location: newDestinations.join(', ') }
          : t
      ),
      currentDay: srcIdx + 2, // navigate to the clone
    }));

    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, endDate: t.endDate, destinations: t.destinations } : {};
    });
  },

  clearDay: (dayNumber) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    const targetDay = trip.days.find(d => d.dayNumber === dayNumber);
    if (!targetDay) return;

    // Collect all placed items → return to pool
    const returnedItems = targetDay.slots
      .flatMap(s => s.places)
      .map(p => ({ ...p, status: 'available' as const }));

    if (returnedItems.length === 0) return; // nothing to clear

    set(state2 => ({
      trips: state2.trips.map(t =>
        t.id === state2.currentTripId
          ? {
              ...t,
              days: t.days.map(d =>
                d.dayNumber === dayNumber
                  ? { ...d, slots: d.slots.map(s => ({ ...s, places: [], ghostItems: [] })) }
                  : d
              ),
              pool: [...t.pool, ...returnedItems],
            }
          : t
      ),
    }));

    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool } : {};
    });
  },

  addDestinationToTrip: (destination, maybePlace) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    // Guard: skip if destination already exists
    if (trip.destinations?.some(d => d.toLowerCase() === destination.toLowerCase())) return;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Create the new day
    const newDayNumber = trip.days.length + 1;
    const newDay: TripDay = {
      dayNumber: newDayNumber,
      destination,
      slots: DEFAULT_TIME_SLOTS.map(s => ({ ...s, places: [], ghostItems: [] })),
    };

    // For trips with specific dates, compute date/dayOfWeek and extend endDate
    let newEndDateStr = trip.endDate;
    if (!trip.flexibleDates && trip.endDate) {
      const oldEnd = new Date(trip.endDate + 'T00:00:00');
      const newEndDate = new Date(oldEnd);
      newEndDate.setDate(newEndDate.getDate() + 1);
      newEndDateStr = newEndDate.toISOString().split('T')[0];
      newDay.date = `${monthNames[newEndDate.getMonth()]} ${newEndDate.getDate()}`;
      newDay.dayOfWeek = dayNames[newEndDate.getDay()];
    }

    const newDestinations = [...(trip.destinations || []), destination];

    set(state2 => ({
      trips: state2.trips.map(t =>
        t.id === state2.currentTripId
          ? {
              ...t,
              destinations: newDestinations,
              location: newDestinations.join(', '),
              endDate: newEndDateStr,
              days: [...t.days, newDay],
            }
          : t
      ),
      currentDay: newDayNumber, // auto-navigate to the new day
    }));

    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { destinations: t.destinations, days: t.days, endDate: t.endDate } : {};
    });
  },

  setDayHotel: (dayNumber, hotel) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          d.dayNumber === dayNumber ? { ...d, hotel: hotel || undefined } : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  setMultipleDaysHotel: (dayNumbers, hotel) => {
    const daySet = new Set(dayNumbers);
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          daySet.has(d.dayNumber) ? { ...d, hotel: hotel || undefined } : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  setDayHotelInfo: (dayNumber, hotelInfo) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          d.dayNumber === dayNumber
            ? {
                ...d,
                hotel: hotelInfo?.name || undefined,
                hotelInfo: hotelInfo || undefined,
              }
            : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  setMultipleDaysHotelInfo: (dayNumbers, hotelInfo) => {
    const daySet = new Set(dayNumbers);
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          daySet.has(d.dayNumber)
            ? {
                ...d,
                hotel: hotelInfo.name,
                hotelInfo,
              }
            : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  // ─── Transport ───
  addTransport: (dayNumber, transport) => {
    const newTransport: TransportEvent = {
      ...transport,
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          d.dayNumber === dayNumber
            ? { ...d, transport: [...(d.transport || []), newTransport] }
            : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  updateTransport: (dayNumber, transportId, updates) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          d.dayNumber === dayNumber
            ? {
                ...d,
                transport: (d.transport || []).map(t =>
                  t.id === transportId ? { ...t, ...updates } : t
                ),
              }
            : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  removeTransport: (dayNumber, transportId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: trip.days.map(d =>
          d.dayNumber === dayNumber
            ? { ...d, transport: (d.transport || []).filter(t => t.id !== transportId) }
            : d
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },
});
