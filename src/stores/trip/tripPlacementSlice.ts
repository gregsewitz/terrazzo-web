import { ImportedPlace, PlaceRating } from '@/types';
import { StateCreator } from 'zustand';
import { updateCurrentTrip, mapDaySlots, mapAllSlots, debouncedTripSave } from './tripHelpers';
import type { TripState } from './types';

// ═══════════════════════════════════════════
// Placement slice state
// ═══════════════════════════════════════════

export interface TripPlacementState {
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
}

// ═══════════════════════════════════════════
// Placement slice factory
// ═══════════════════════════════════════════

export const createPlacementSlice: StateCreator<TripState, [], [], TripPlacementState> = (set, get) => ({
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
});
