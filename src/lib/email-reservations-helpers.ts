/**
 * Email Reservations Helpers
 *
 * Utility functions for grouping, filtering, and formatting
 * email reservations in the review UI.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StagedReservation {
  id: string;
  status: 'pending' | 'confirmed' | 'dismissed';
  placeName: string;
  placeType: string;
  location: string | null;
  googlePlaceId: string | null;
  reservationDate: string | null;
  reservationTime: string | null;
  partySize: number | null;
  confirmationNumber: string | null;
  provider: string | null;
  flightNumber: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  activityDetails: string | null;
  confidence: number;
  matchedTripId: string | null;
  matchedTripName: string | null;
  suggestedDayNumber: number | null;
  suggestedSlotId: string | null;
  savedPlaceId: string | null;
  emailFrom: string;
  emailSubject: string;
  emailDate: string;
  createdAt: string;
}

export interface TripGroupData {
  tripId: string | null;
  tripName: string;
  dateRange: string;
  reservations: StagedReservation[];
}

export interface YearGroupData {
  year: number;
  reservations: StagedReservation[];
}

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Get the effective date for a reservation (reservationDate → checkInDate) */
function getEffectiveDate(r: StagedReservation): Date | null {
  const dateStr = r.reservationDate || r.checkInDate;
  if (!dateStr) return null;
  return new Date(dateStr);
}

/** Is this reservation's date in the future (or today)? */
export function isFutureReservation(r: StagedReservation): boolean {
  const d = getEffectiveDate(r);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

/** Is this reservation's date in the past? */
export function isPastReservation(r: StagedReservation): boolean {
  const d = getEffectiveDate(r);
  if (!d) return true; // No date → treat as history
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/** Is this a standalone flight (no trip group)? */
export function isStandaloneFlight(r: StagedReservation): boolean {
  return r.placeType === 'flight' && !r.matchedTripId;
}

// ─── Grouping ───────────────────────────────────────────────────────────────

/** Group future reservations by matched trip */
export function groupByTrip(reservations: StagedReservation[]): TripGroupData[] {
  const groups: Record<string, StagedReservation[]> = {};

  for (const r of reservations) {
    // Skip standalone flights in upcoming
    if (isStandaloneFlight(r)) continue;

    const key = r.matchedTripId || 'unmatched';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  return Object.entries(groups)
    .map(([key, items]) => ({
      tripId: key === 'unmatched' ? null : key,
      tripName: key === 'unmatched' ? 'Other upcoming' : (items[0]?.matchedTripName || 'Unknown trip'),
      dateRange: formatDateRange(items),
      reservations: items.sort((a, b) => {
        const da = getEffectiveDate(a);
        const db = getEffectiveDate(b);
        if (!da || !db) return 0;
        return da.getTime() - db.getTime();
      }),
    }))
    // Named trips first, unmatched last
    .sort((a, b) => {
      if (a.tripId && !b.tripId) return -1;
      if (!a.tripId && b.tripId) return 1;
      return 0;
    });
}

/** Group past reservations by year */
export function groupByYear(reservations: StagedReservation[]): YearGroupData[] {
  const groups: Record<number, StagedReservation[]> = {};

  for (const r of reservations) {
    const d = getEffectiveDate(r);
    const year = d ? d.getFullYear() : new Date(r.createdAt).getFullYear();
    if (!groups[year]) groups[year] = [];
    groups[year].push(r);
  }

  return Object.entries(groups)
    .map(([year, items]) => ({
      year: parseInt(year),
      reservations: items.sort((a, b) => {
        const da = getEffectiveDate(a);
        const db = getEffectiveDate(b);
        if (!da || !db) return 0;
        return db.getTime() - da.getTime(); // Newest first within year
      }),
    }))
    .sort((a, b) => b.year - a.year); // Most recent year first
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Format a date range from a group of reservations: "Mar 15–19" or "Mar 15 – Apr 2" */
export function formatDateRange(reservations: StagedReservation[]): string {
  const dates = reservations
    .map(getEffectiveDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return '';

  const first = dates[0];
  const last = dates[dates.length - 1];
  const fMonth = first.toLocaleDateString('en-US', { month: 'short' });
  const fDay = first.getDate();

  if (first.getTime() === last.getTime()) {
    return `${fMonth} ${fDay}`;
  }

  const lMonth = last.toLocaleDateString('en-US', { month: 'short' });
  const lDay = last.getDate();

  if (fMonth === lMonth) {
    return `${fMonth} ${fDay}–${lDay}`;
  }
  return `${fMonth} ${fDay} – ${lMonth} ${lDay}`;
}

/** Compact detail string for a reservation row */
export function formatCompactDetails(r: StagedReservation): string {
  const parts: string[] = [];

  if (r.placeType === 'flight' && r.departureAirport && r.arrivalAirport) {
    parts.push(`${r.departureAirport} → ${r.arrivalAirport}`);
    if (r.flightNumber) parts.push(r.flightNumber);
  } else if (r.placeType === 'hotel' && r.checkInDate) {
    const checkIn = new Date(r.checkInDate);
    const formatted = checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (r.checkOutDate) {
      const checkOut = new Date(r.checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      parts.push(`${formatted}, ${nights} night${nights !== 1 ? 's' : ''}`);
    } else {
      parts.push(formatted);
    }
  } else {
    if (r.reservationDate) {
      parts.push(new Date(r.reservationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    if (r.reservationTime) {
      parts.push(formatTime12h(r.reservationTime));
    }
  }

  if (r.partySize) parts.push(`Party of ${r.partySize}`);

  return parts.join(' · ');
}

/** 24h time → 12h format */
function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Type filter helpers ────────────────────────────────────────────────────

export const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'activity', label: 'Activities' },
  { value: 'bar', label: 'Bars' },
  { value: 'cafe', label: 'Cafes' },
  { value: 'flight', label: 'Flights' },
] as const;

export function filterByType(reservations: StagedReservation[], typeFilter: string): StagedReservation[] {
  if (typeFilter === 'all') return reservations;
  return reservations.filter(r => r.placeType === typeFilter);
}
