import { Trip, TripDay, TimeSlot } from '@/types';
import { dbSave } from '@/lib/db-save';

// ═══════════════════════════════════════════
// DB write wrapper
// ═══════════════════════════════════════════

/** DB write with retry + error surfacing (replaces fire-and-forget) */
export function dbWrite(url: string, method: string, body?: unknown) {
  dbSave(url, method, body);
}

// ═══════════════════════════════════════════
// Debounced trip save
// ═══════════════════════════════════════════

/** Debounced trip save — collapses rapid changes (e.g. drag-and-drop) */
const _tripSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function debouncedTripSave(tripId: string, getData: () => Partial<Trip>) {
  const existing = _tripSaveTimers.get(tripId);
  if (existing) clearTimeout(existing);
  _tripSaveTimers.set(tripId, setTimeout(() => {
    _tripSaveTimers.delete(tripId);
    const data = getData();
    dbWrite(`/api/trips/${tripId}/save`, 'PATCH', data);
  }, 2000));
}

/** Cancel any pending debounced save for a trip (call before deleting) */
export function cancelTripSave(tripId: string) {
  const existing = _tripSaveTimers.get(tripId);
  if (existing) {
    clearTimeout(existing);
    _tripSaveTimers.delete(tripId);
  }
}

// ═══════════════════════════════════════════
// Immutable update helpers
// ═══════════════════════════════════════════

export type TripUpdater = (trip: Trip) => Trip;

/** Update the current trip immutably. All other trips pass through unchanged. */
export function updateCurrentTrip(state: { trips: Trip[]; currentTripId: string | null }, updater: TripUpdater) {
  return {
    trips: state.trips.map(trip =>
      trip.id === state.currentTripId ? updater(trip) : trip
    ),
  };
}

/** Map over a trip's days, transforming slots on a target day. */
export function mapDaySlots(
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
export function mapAllSlots(
  days: TripDay[],
  slotUpdater: (slot: TimeSlot) => TimeSlot,
): TripDay[] {
  return days.map(d => ({ ...d, slots: d.slots.map(slotUpdater) }));
}
