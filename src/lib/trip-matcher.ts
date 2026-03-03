/**
 * Trip Matcher
 *
 * Matches parsed email reservations against existing user trips by
 * comparing reservation dates/locations to trip date ranges and destinations.
 * Returns slot suggestions for the day planner.
 */

interface ReservationForMatching {
  id: string;
  placeName: string;
  placeType: string;
  location: string | null;
  reservationDate: string | null;   // ISO date
  reservationTime: string | null;   // HH:mm
  checkInDate: string | null;       // ISO date (hotels)
  checkOutDate: string | null;      // ISO date (hotels)
  departureAirport: string | null;  // flights
  arrivalAirport: string | null;    // flights
}

interface TripForMatching {
  id: string;
  name: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  destinations: string[];
  days: { dayNumber: number; date?: string; destination?: string }[];
}

export interface TripMatch {
  reservationId: string;
  tripId: string;
  tripName: string;
  dayNumber: number;
  slotId: string;
  confidence: number;
  reason: string;
}

/**
 * Match reservations to trips based on date overlap and location proximity.
 */
export function matchReservationsToTrips(
  reservations: ReservationForMatching[],
  trips: TripForMatching[]
): TripMatch[] {
  const matches: TripMatch[] = [];

  for (const res of reservations) {
    const effectiveDate = getEffectiveDate(res);
    if (!effectiveDate) continue; // Can't match without a date

    for (const trip of trips) {
      if (!trip.startDate || !trip.endDate) continue;

      const tripStart = new Date(trip.startDate);
      const tripEnd = new Date(trip.endDate);
      const resDate = new Date(effectiveDate);

      // Check date overlap
      if (resDate < tripStart || resDate > tripEnd) continue;

      // Check location match (fuzzy)
      const locationMatch = doesLocationMatch(res, trip);
      if (!locationMatch) continue;

      // Calculate which day number this falls on
      const dayNumber = Math.floor(
        (resDate.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      // Find the matching day in the trip's days array
      const matchedDay = trip.days.find((d) => d.dayNumber === dayNumber);

      // Suggest a slot based on time and place type
      const slotId = suggestSlot(res);

      matches.push({
        reservationId: res.id,
        tripId: trip.id,
        tripName: trip.name,
        dayNumber,
        slotId,
        confidence: locationMatch === 'exact' ? 0.95 : 0.7,
        reason: buildMatchReason(res, trip, dayNumber, matchedDay?.date),
      });

      // Only match to the first (best) trip
      break;
    }
  }

  return matches;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getEffectiveDate(res: ReservationForMatching): string | null {
  if (res.reservationDate) return res.reservationDate;
  if (res.checkInDate) return res.checkInDate;
  // For flights, use the departure date (reservationDate should cover this,
  // but as fallback)
  return null;
}

function doesLocationMatch(
  res: ReservationForMatching,
  trip: TripForMatching
): 'exact' | 'fuzzy' | false {
  const resLocation = (res.location || '').toLowerCase().trim();
  if (!resLocation) return 'fuzzy'; // No location = weak match on date alone

  const tripLocations = [
    trip.location,
    ...trip.destinations,
    ...trip.days.map((d) => d.destination || ''),
  ]
    .filter(Boolean)
    .map((l) => l!.toLowerCase().trim());

  // Exact city match
  for (const tripLoc of tripLocations) {
    if (resLocation.includes(tripLoc) || tripLoc.includes(resLocation)) {
      return 'exact';
    }
  }

  // For flights, check if arrival airport code matches any trip location
  if (res.arrivalAirport) {
    const arrCode = res.arrivalAirport.toLowerCase();
    // Common airport-to-city mappings would go here in production
    // For now, just check if any trip location contains the airport code
    for (const tripLoc of tripLocations) {
      if (tripLoc.includes(arrCode)) return 'fuzzy';
    }
  }

  return false;
}

function suggestSlot(res: ReservationForMatching): string {
  const type = res.placeType;
  const time = res.reservationTime;

  // If we have an explicit time, use it to pick a slot
  if (time) {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 11) return 'breakfast';
    if (hour < 14) return 'lunch';
    if (hour < 17) return 'afternoon';
    if (hour < 20) return 'dinner';
    return 'evening';
  }

  // Infer from place type
  switch (type) {
    case 'restaurant':
      return 'dinner'; // Most restaurant reservations are dinner
    case 'cafe':
      return 'breakfast';
    case 'bar':
      return 'evening';
    case 'hotel':
      return 'afternoon'; // Check-in is typically afternoon
    case 'flight':
      return 'morning'; // Default; ideally we'd use departure time
    case 'activity':
      return 'morning'; // Most tours/activities are mornings
    default:
      return 'afternoon';
  }
}

function buildMatchReason(
  res: ReservationForMatching,
  trip: TripForMatching,
  dayNumber: number,
  dayDate?: string
): string {
  const dateStr = dayDate
    ? new Date(dayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : `Day ${dayNumber}`;

  if (res.placeType === 'flight') {
    return `Flight falls on ${dateStr} of your ${trip.name} trip`;
  }
  if (res.placeType === 'hotel') {
    return `Check-in on ${dateStr} of your ${trip.name} trip`;
  }
  return `Reservation date falls on ${dateStr} of your ${trip.name} trip`;
}
