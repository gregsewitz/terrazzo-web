import { create } from 'zustand';
import { Trip, ImportedPlace, TripDay, TimeSlot, DEFAULT_TIME_SLOTS, PlaceRating, TripCreationData, DreamBoardEntry, HotelInfo, TransportEvent } from '@/types';
import { apiFetch } from '@/lib/api-client';
import { dbSave } from '@/lib/db-save';

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

/** DB write with retry + error surfacing (replaces fire-and-forget) */
function dbWrite(url: string, method: string, body?: unknown) {
  dbSave(url, method, body);
}

/** Debounced trip save — collapses rapid changes (e.g. drag-and-drop) */
const _tripSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function debouncedTripSave(tripId: string, getData: () => Partial<Trip>) {
  const existing = _tripSaveTimers.get(tripId);
  if (existing) clearTimeout(existing);
  _tripSaveTimers.set(tripId, setTimeout(() => {
    _tripSaveTimers.delete(tripId);
    const data = getData();
    dbWrite(`/api/trips/${tripId}/save`, 'PATCH', data);
  }, 2000));
}

// ─── Immutable update helpers ────────────────────────────────────────────────

type TripUpdater = (trip: Trip) => Trip;

/** Update the current trip immutably. All other trips pass through unchanged. */
function updateCurrentTrip(state: { trips: Trip[]; currentTripId: string | null }, updater: TripUpdater) {
  return {
    trips: state.trips.map(trip =>
      trip.id === state.currentTripId ? updater(trip) : trip
    ),
  };
}

/** Map over a trip's days, transforming slots on a target day. */
function mapDaySlots(
  days: TripDay[],
  dayNumber: number,
  slotUpdater: (slot: TimeSlot) => TimeSlot,
): TripDay[] {
  return days.map(d =>
    d.dayNumber === dayNumber
      ? { ...d, slots: d.slots.map(slotUpdater) }
      : d
  );
}

/** Map over ALL days/slots (used by ratePlace which touches every slot). */
function mapAllSlots(
  days: TripDay[],
  slotUpdater: (slot: TimeSlot) => TimeSlot,
): TripDay[] {
  return days.map(d => ({ ...d, slots: d.slots.map(slotUpdater) }));
}

// ─── Store types ─────────────────────────────────────────────────────────────

interface TripState {
  trips: Trip[];
  currentTripId: string | null;
  currentDay: number;

  // Getters
  currentTrip: () => Trip | undefined;
  poolItems: () => ImportedPlace[];
  unsortedCount: () => number;

  // Actions
  setCurrentTrip: (id: string) => void;
  setCurrentDay: (day: number) => void;
  placeItem: (itemId: string, day: number, slotId: string) => void;
  removeFromSlot: (day: number, slotId: string) => void;
  unplaceFromSlot: (day: number, slotId: string, placeId: string) => void;
  addToPool: (items: ImportedPlace[]) => void;
  rejectItem: (itemId: string) => void;
  updateItemStatus: (itemId: string, status: ImportedPlace['status']) => void;
  confirmGhost: (dayNumber: number, slotId: string, ghostId: string) => void;
  dismissGhost: (dayNumber: number, slotId: string, ghostId: string) => void;
  ratePlace: (itemId: string, rating: PlaceRating) => void;
  injectGhostCandidates: (candidates: ImportedPlace[]) => void;
  placeFromSaved: (place: ImportedPlace, dayNumber: number, slotId: string) => void;
  moveToSlot: (place: ImportedPlace, fromDay: number, fromSlotId: string, toDay: number, toSlotId: string) => void;
  setDayDestination: (dayNumber: number, destination: string) => void;
  reorderDays: (fromDayNumber: number, toDayNumber: number) => void;
  addDestinationToTrip: (destination: string, maybePlace?: ImportedPlace) => void;
  setDayHotel: (dayNumber: number, hotel: string) => void;
  setMultipleDaysHotel: (dayNumbers: number[], hotel: string) => void;
  setDayHotelInfo: (dayNumber: number, hotelInfo: HotelInfo | null) => void;
  setMultipleDaysHotelInfo: (dayNumbers: number[], hotelInfo: HotelInfo) => void;
  // Transport
  addTransport: (dayNumber: number, transport: Omit<TransportEvent, 'id'>) => void;
  updateTransport: (dayNumber: number, transportId: string, updates: Partial<TransportEvent>) => void;
  removeTransport: (dayNumber: number, transportId: string) => void;
  // Dream Board
  addDreamBoardEntry: (entry: Omit<DreamBoardEntry, 'id' | 'createdAt'>) => void;
  updateDreamBoardEntry: (entryId: string, updates: Partial<DreamBoardEntry>) => void;
  removeDreamBoardEntry: (entryId: string) => void;
  toggleDreamBoardPin: (entryId: string) => void;
  /** @deprecated Use addDreamBoardEntry */
  addScratchpadEntry: (entry: Omit<DreamBoardEntry, 'id' | 'createdAt'>) => void;
  /** @deprecated Use updateDreamBoardEntry */
  updateScratchpadEntry: (entryId: string, updates: Partial<DreamBoardEntry>) => void;
  /** @deprecated Use removeDreamBoardEntry */
  removeScratchpadEntry: (entryId: string) => void;
  /** @deprecated Use toggleDreamBoardPin */
  toggleScratchpadPin: (entryId: string) => void;
  createTrip: (data: TripCreationData) => string; // returns new trip id
  graduateToPlanning: (startDate: string, endDate: string, dayAllocation?: Record<string, number>) => void;
  hydrateFromDB: (trips: DBTrip[]) => void;
}

// ─── Lazy demo data loader ───────────────────────────────────────────────────

let _tripDemoLoaded = false;

/** Lazily load demo trip data. Safe to call multiple times. */
export async function initTripDemoData() {
  if (_tripDemoLoaded) return;
  _tripDemoLoaded = true;
  const { ALL_DEMO_TRIPS } = await import('@/data/demoTrips');
  useTripStore.setState({
    trips: [...ALL_DEMO_TRIPS],
    currentTripId: 'demo-stockholm-copenhagen',
  });
}

export const useTripStore = create<TripState>((set, get) => ({
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

  placeItem: (itemId, day, slotId) => {
    set(state =>
      updateCurrentTrip(state, trip => {
        const item = trip.pool.find(p => p.id === itemId);
        if (!item) return trip;
        return {
          ...trip,
          pool: trip.pool.map(p =>
            p.id === itemId ? { ...p, status: 'placed' as const, placedIn: { day, slot: slotId } } : p
          ),
          days: mapDaySlots(trip.days, day, s =>
            s.id === slotId ? { ...s, places: [...s.places, { ...item, status: 'placed' as const }] } : s
          ),
        };
      })
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool } : {};
    });
  },

  removeFromSlot: (day, slotId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: mapDaySlots(trip.days, day, s =>
          s.id === slotId ? { ...s, places: [] } : s
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  unplaceFromSlot: (day, slotId, placeId) => {
    set(state =>
      updateCurrentTrip(state, trip => {
        let removedPlace: ImportedPlace | null = null;
        const days = mapDaySlots(trip.days, day, s => {
          if (s.id !== slotId) return s;
          const place = s.places.find(p => p.id === placeId);
          if (place) removedPlace = place;
          return { ...s, places: s.places.filter(p => p.id !== placeId) };
        });

        let pool = trip.pool;
        if (removedPlace) {
          const existsInPool = trip.pool.some(p => p.id === placeId);
          pool = existsInPool
            ? trip.pool.map(p => p.id === placeId ? { ...p, status: 'available' as const, placedIn: undefined } : p)
            : [...trip.pool, { ...(removedPlace as ImportedPlace), status: 'available' as const, placedIn: undefined }];
        }

        return { ...trip, pool, days };
      })
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool } : {};
    });
  },

  addToPool: (items) => {
    set(state =>
      updateCurrentTrip(state, trip => ({ ...trip, pool: [...trip.pool, ...items] }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { pool: t.pool } : {};
    });
  },

  placeFromSaved: (place, dayNumber, slotId) => {
    set(state =>
      updateCurrentTrip(state, trip => {
        const placedItem = { ...place, status: 'placed' as const, placedIn: { day: dayNumber, slot: slotId } };
        return {
          ...trip,
          days: mapDaySlots(trip.days, dayNumber, s =>
            s.id === slotId ? { ...s, places: [...s.places, placedItem] } : s
          ),
        };
      })
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  moveToSlot: (place, fromDay, fromSlotId, toDay, toSlotId) => {
    if (fromDay === toDay && fromSlotId === toSlotId) return;
    const movedItem = { ...place, status: 'placed' as const, placedIn: { day: toDay, slot: toSlotId } };
    set(state => updateCurrentTrip(state, trip => ({
      ...trip,
      days: trip.days.map(d => ({
        ...d,
        slots: d.slots.map(s => {
          if (d.dayNumber === fromDay && s.id === fromSlotId) return { ...s, places: s.places.filter(p => p.id !== place.id) };
          if (d.dayNumber === toDay && s.id === toSlotId) return { ...s, places: [...s.places, movedItem] };
          return s;
        }),
      })),
    })));
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  rejectItem: (itemId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip, pool: trip.pool.map(p => p.id === itemId ? { ...p, status: 'rejected' as const } : p),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { pool: t.pool } : {};
    });
  },

  updateItemStatus: (itemId, status) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip, pool: trip.pool.map(p => p.id === itemId ? { ...p, status } : p),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { pool: t.pool } : {};
    });
  },

  confirmGhost: (dayNumber, slotId, ghostId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: mapDaySlots(trip.days, dayNumber, s => {
          if (s.id !== slotId) return s;
          const ghost = s.ghostItems?.find(g => g.id === ghostId);
          if (!ghost) return s;
          return {
            ...s,
            places: [...s.places, { ...ghost, ghostStatus: 'confirmed' as const, status: 'placed' as const }],
            ghostItems: s.ghostItems?.filter(g => g.id !== ghostId),
          };
        }),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  dismissGhost: (dayNumber, slotId, ghostId) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        days: mapDaySlots(trip.days, dayNumber, s =>
          s.id === slotId ? { ...s, ghostItems: s.ghostItems?.filter(g => g.id !== ghostId) } : s
        ),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

  ratePlace: (itemId, rating) => {
    set(state =>
      updateCurrentTrip(state, trip => ({
        ...trip,
        pool: trip.pool.map(p => p.id === itemId ? { ...p, rating } : p),
        days: mapAllSlots(trip.days, s => ({
          ...s,
          places: s.places.map(p => p.id === itemId ? { ...p, rating } : p),
          ghostItems: s.ghostItems?.map(g => g.id === itemId ? { ...g, rating } : g),
        })),
      }))
    );
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, pool: t.pool } : {};
    });
  },

  // Star → Ghost card candidacy: inject rated/starred places as ghost suggestions
  injectGhostCandidates: (candidates) => {
    set(state => updateCurrentTrip(state, trip => {
      const destLower = (trip.destinations || [trip.location?.split(',')[0]?.trim()].filter(Boolean))
        .map(d => d.toLowerCase());

      // Filter candidates that match trip destinations
      const matching = candidates.filter(c =>
        destLower.some(dest => c.location.toLowerCase().includes(dest))
      );
      if (matching.length === 0) return trip;

      // Collect existing ghost IDs to avoid dupes
      const existingGhostIds = new Set<string>();
      const existingPoolIds = new Set<string>();
      trip.pool.forEach(p => existingPoolIds.add(p.name.toLowerCase()));
      trip.days.forEach(d => d.slots.forEach(s => {
        s.ghostItems?.forEach(g => existingGhostIds.add(g.name.toLowerCase()));
        s.places.forEach(p => existingGhostIds.add(p.name.toLowerCase()));
      }));

      // Filter to only truly new candidates
      const newCandidates = matching.filter(c =>
        !existingGhostIds.has(c.name.toLowerCase()) &&
        !existingPoolIds.has(c.name.toLowerCase())
      );
      if (newCandidates.length === 0) return trip;

      // Map place types to preferred slot IDs
      const typeSlotMap: Record<string, string[]> = {
        restaurant: ['lunch', 'dinner'],
        bar: ['evening', 'dinner'],
        cafe: ['breakfast', 'morning'],
        hotel: ['morning'],
        museum: ['morning', 'afternoon'],
        activity: ['afternoon', 'morning'],
        neighborhood: ['afternoon'],
        shop: ['afternoon'],
      };

      // Distribute candidates across empty slots on MATCHING days only
      const updatedDays = [...trip.days];
      let candidateIdx = 0;
      for (const candidate of newCandidates) {
        if (candidateIdx >= 6) break; // Max 6 ghost injections
        const preferredSlots = typeSlotMap[candidate.type] || ['afternoon'];
        const candLoc = candidate.location.toLowerCase();

        // Find a day whose destination matches this candidate's location
        let placed = false;
        for (const day of updatedDays) {
          if (placed) break;
          // Only place candidates on days where the destination matches
          const dayDest = (day.destination || '').toLowerCase();
          if (dayDest && !candLoc.includes(dayDest) && !dayDest.includes(candLoc.split(',')[0].trim())) continue;
          for (const slotId of preferredSlots) {
            const slot = day.slots.find(s => s.id === slotId);
            if (slot && slot.places.length === 0 && (!slot.ghostItems || slot.ghostItems.length === 0)) {
              const ghostItem: ImportedPlace = {
                ...candidate,
                id: `ghost-starred-${candidate.id}`,
                ghostStatus: 'proposed',
                ghostSource: candidate.rating?.reaction === 'myPlace' ? 'manual' : (candidate.ghostSource || 'manual'),
                terrazzoReasoning: {
                  rationale: candidate.rating?.reaction === 'myPlace'
                    ? `You starred ${candidate.name} — it's in ${trip.destinations?.[0] || trip.location}`
                    : `Highly rated place matching your ${trip.name} trip`,
                  confidence: 0.85,
                },
              };
              if (!slot.ghostItems) slot.ghostItems = [];
              slot.ghostItems.push(ghostItem);
              placed = true;
              candidateIdx++;
              break;
            }
          }
        }
      }

      return { ...trip, days: updatedDays };
    }));
    const tripId = get().currentTripId;
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days } : {};
    });
  },

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

  addDestinationToTrip: (destination, maybePlace) => {
    const state = get();
    const trip = state.trips.find(t => t.id === state.currentTripId);
    if (!trip) return;

    // Guard: skip if destination already exists
    if (trip.destinations?.some(d => d.toLowerCase() === destination.toLowerCase())) return;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Calculate new end date (extend by 1 day)
    const oldEnd = trip.endDate ? new Date(trip.endDate + 'T00:00:00') : new Date();
    const newEndDate = new Date(oldEnd);
    newEndDate.setDate(newEndDate.getDate() + 1);
    const newEndDateStr = newEndDate.toISOString().split('T')[0];

    // Create the new day
    const newDayNumber = trip.days.length + 1;
    const newDay: TripDay = {
      dayNumber: newDayNumber,
      date: `${monthNames[newEndDate.getMonth()]} ${newEndDate.getDate()}`,
      dayOfWeek: dayNames[newEndDate.getDay()],
      destination,
      slots: DEFAULT_TIME_SLOTS.map(s => ({ ...s, places: [], ghostItems: [] })),
    };

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

  // ─── Dream Board (formerly Scratchpad) ───
  // Helper: get entries from dreamBoard or fall back to legacy scratchpad field
  // (not in interface — internal only)

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

  // Legacy aliases
  addScratchpadEntry: (...args) => get().addDreamBoardEntry(...args),
  updateScratchpadEntry: (...args) => get().updateDreamBoardEntry(...args),
  removeScratchpadEntry: (...args) => get().removeDreamBoardEntry(...args),
  toggleScratchpadPin: (...args) => get().toggleDreamBoardPin(...args),

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

    // Write-through: create trip in DB
    dbWrite('/api/trips/mine', 'POST', {
      name: data.name,
      destinations: data.destinations,
      startDate: data.startDate,
      endDate: data.endDate,
      groupSize: data.groupSize,
      groupType: data.travelContext,
      days: days,
      pool: [],
      status: data.status || 'planning',
    });

    return id;
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
    if (tripId) debouncedTripSave(tripId, () => {
      const t = get().trips.find(tr => tr.id === tripId);
      return t ? { days: t.days, status: t.status, startDate, endDate } : {};
    });
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
}));
