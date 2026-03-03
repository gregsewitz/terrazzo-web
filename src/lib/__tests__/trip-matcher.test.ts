import { describe, it, expect } from 'vitest';
import { matchReservationsToTrips, type TripMatch } from '../trip-matcher';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const baseTrip = {
  id: 'trip-1',
  name: 'Rome Trip',
  location: 'Rome',
  startDate: '2026-06-10T00:00:00.000Z',
  endDate: '2026-06-17T00:00:00.000Z',
  destinations: ['Rome', 'Florence'],
  days: [
    { dayNumber: 1, date: '2026-06-10', destination: 'Rome' },
    { dayNumber: 2, date: '2026-06-11', destination: 'Rome' },
    { dayNumber: 3, date: '2026-06-12', destination: 'Rome' },
    { dayNumber: 4, date: '2026-06-13', destination: 'Florence' },
    { dayNumber: 5, date: '2026-06-14', destination: 'Florence' },
    { dayNumber: 6, date: '2026-06-15', destination: 'Rome' },
    { dayNumber: 7, date: '2026-06-16', destination: 'Rome' },
    { dayNumber: 8, date: '2026-06-17', destination: 'Rome' },
  ],
};

const tokyoTrip = {
  id: 'trip-2',
  name: 'Tokyo Adventure',
  location: 'Tokyo',
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-07-07T00:00:00.000Z',
  destinations: ['Tokyo', 'Kyoto'],
  days: [
    { dayNumber: 1, date: '2026-07-01', destination: 'Tokyo' },
    { dayNumber: 2, date: '2026-07-02', destination: 'Tokyo' },
    { dayNumber: 3, date: '2026-07-03', destination: 'Kyoto' },
  ],
};

function makeReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    placeName: 'Ristorante Da Mario',
    placeType: 'restaurant',
    location: 'Rome, Italy',
    reservationDate: '2026-06-12T00:00:00.000Z',
    reservationTime: '19:30',
    checkInDate: null,
    checkOutDate: null,
    departureAirport: null,
    arrivalAirport: null,
    ...overrides,
  };
}

// ─── matchReservationsToTrips ─────────────────────────────────────────────

describe('matchReservationsToTrips', () => {
  describe('date matching', () => {
    it('matches a reservation whose date falls within trip range', () => {
      const res = makeReservation();
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].tripId).toBe('trip-1');
      expect(matches[0].dayNumber).toBe(3); // June 12 = day 3
    });

    it('matches on the first day of the trip', () => {
      const res = makeReservation({ reservationDate: '2026-06-10T00:00:00.000Z' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].dayNumber).toBe(1);
    });

    it('matches on the last day of the trip', () => {
      const res = makeReservation({ reservationDate: '2026-06-17T00:00:00.000Z' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].dayNumber).toBe(8);
    });

    it('does not match when date is before trip', () => {
      const res = makeReservation({ reservationDate: '2026-06-01T00:00:00.000Z' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(0);
    });

    it('does not match when date is after trip', () => {
      const res = makeReservation({ reservationDate: '2026-06-20T00:00:00.000Z' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(0);
    });

    it('does not match when reservation has no date', () => {
      const res = makeReservation({ reservationDate: null });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(0);
    });

    it('skips trips without start/end dates', () => {
      const tripNoDate = { ...baseTrip, startDate: null, endDate: null };
      const res = makeReservation();
      const matches = matchReservationsToTrips([res], [tripNoDate]);
      expect(matches).toHaveLength(0);
    });
  });

  describe('hotel check-in date fallback', () => {
    it('uses checkInDate when reservationDate is null', () => {
      const res = makeReservation({
        placeType: 'hotel',
        placeName: 'Hotel Colosseum',
        reservationDate: null,
        reservationTime: null,
        checkInDate: '2026-06-11T00:00:00.000Z',
        checkOutDate: '2026-06-14T00:00:00.000Z',
      });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].dayNumber).toBe(2); // June 11 = day 2
    });
  });

  describe('location matching', () => {
    it('matches when reservation location includes trip location', () => {
      const res = makeReservation({ location: 'Rome, Italy' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBe(0.95); // exact match
    });

    it('matches with fuzzy confidence when location is empty', () => {
      const res = makeReservation({ location: null });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBe(0.7); // fuzzy
    });

    it('does not match when location is completely different', () => {
      const res = makeReservation({ location: 'Paris, France' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(0);
    });

    it('matches trip destination (Florence) within Rome trip', () => {
      const res = makeReservation({
        location: 'Florence, Italy',
        reservationDate: '2026-06-13T00:00:00.000Z',
      });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBe(0.95);
      expect(matches[0].dayNumber).toBe(4);
    });
  });

  describe('slot suggestions', () => {
    it('suggests dinner for 19:30 reservation', () => {
      const res = makeReservation({ reservationTime: '19:30' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('dinner');
    });

    it('suggests breakfast for 09:00 reservation', () => {
      const res = makeReservation({ reservationTime: '09:00' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('breakfast');
    });

    it('suggests lunch for 12:30 reservation', () => {
      const res = makeReservation({ reservationTime: '12:30' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('lunch');
    });

    it('suggests afternoon for 15:00 reservation', () => {
      const res = makeReservation({ reservationTime: '15:00' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('afternoon');
    });

    it('suggests evening for 21:00 reservation', () => {
      const res = makeReservation({ reservationTime: '21:00' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('evening');
    });

    it('defaults to dinner for restaurant with no time', () => {
      const res = makeReservation({ reservationTime: null, placeType: 'restaurant' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('dinner');
    });

    it('defaults to breakfast for cafe with no time', () => {
      const res = makeReservation({ reservationTime: null, placeType: 'cafe' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('breakfast');
    });

    it('defaults to evening for bar with no time', () => {
      const res = makeReservation({ reservationTime: null, placeType: 'bar' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('evening');
    });

    it('defaults to afternoon for hotel with no time', () => {
      const res = makeReservation({
        reservationTime: null,
        placeType: 'hotel',
        checkInDate: '2026-06-12T00:00:00.000Z',
        checkOutDate: '2026-06-14T00:00:00.000Z',
      });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('afternoon');
    });

    it('defaults to morning for flight with no time', () => {
      const res = makeReservation({
        reservationTime: null,
        placeType: 'flight',
        placeName: 'Delta DL123',
        departureAirport: 'JFK',
        arrivalAirport: 'FCO',
      });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('morning');
    });

    it('defaults to morning for activity with no time', () => {
      const res = makeReservation({ reservationTime: null, placeType: 'activity' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].slotId).toBe('morning');
    });
  });

  describe('multi-trip matching', () => {
    it('matches to the first qualifying trip only', () => {
      const res = makeReservation({
        location: 'Rome, Italy',
        reservationDate: '2026-06-12T00:00:00.000Z',
      });
      // Create a second Rome trip that also covers the date
      const secondRomeTrip = {
        ...baseTrip,
        id: 'trip-1b',
        name: 'Rome Trip 2',
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-20T00:00:00.000Z',
      };
      const matches = matchReservationsToTrips([res], [secondRomeTrip, baseTrip]);
      expect(matches).toHaveLength(1);
      expect(matches[0].tripId).toBe('trip-1b'); // first in list
    });

    it('matches different reservations to different trips', () => {
      const romeRes = makeReservation({ id: 'res-rome' });
      const tokyoRes = makeReservation({
        id: 'res-tokyo',
        placeName: 'Sukiyabashi Jiro',
        location: 'Tokyo, Japan',
        reservationDate: '2026-07-02T00:00:00.000Z',
        reservationTime: '19:00',
      });
      const matches = matchReservationsToTrips([romeRes, tokyoRes], [baseTrip, tokyoTrip]);
      expect(matches).toHaveLength(2);
      expect(matches[0].tripId).toBe('trip-1');
      expect(matches[1].tripId).toBe('trip-2');
    });
  });

  describe('match reason', () => {
    it('includes trip name in reason', () => {
      const res = makeReservation();
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].reason).toContain('Rome Trip');
    });

    it('describes flight matches', () => {
      const res = makeReservation({
        placeType: 'flight',
        placeName: 'AA100',
        location: 'Rome',
        departureAirport: 'JFK',
        arrivalAirport: 'FCO',
      });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].reason).toContain('Flight');
    });

    it('describes hotel check-in matches', () => {
      const res = makeReservation({
        placeType: 'hotel',
        placeName: 'Hotel Roma',
        reservationDate: null,
        checkInDate: '2026-06-11T00:00:00.000Z',
        checkOutDate: '2026-06-14T00:00:00.000Z',
      });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches[0].reason).toContain('Check-in');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for no reservations', () => {
      const matches = matchReservationsToTrips([], [baseTrip]);
      expect(matches).toHaveLength(0);
    });

    it('returns empty array for no trips', () => {
      const res = makeReservation();
      const matches = matchReservationsToTrips([res], []);
      expect(matches).toHaveLength(0);
    });

    it('handles case-insensitive location matching', () => {
      const res = makeReservation({ location: 'ROME' });
      const matches = matchReservationsToTrips([res], [baseTrip]);
      expect(matches).toHaveLength(1);
    });
  });
});
