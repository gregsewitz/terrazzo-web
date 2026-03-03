/**
 * Email Scanning & Reservation Parsing Types
 *
 * Covers the full lifecycle: scan → parse → stage → review → confirm
 */

// ─── Reservation Types ─────────────────────────────────────────────────────────

export type ReservationType = 'restaurant' | 'hotel' | 'flight' | 'activity' | 'bar' | 'cafe';

export type ReservationProvider =
  | 'opentable'
  | 'resy'
  | 'thefork'
  | 'yelp'
  | 'google'
  | 'booking.com'
  | 'airbnb'
  | 'hotels.com'
  | 'expedia'
  | 'vrbo'
  | 'marriott'
  | 'hilton'
  | 'hyatt'
  | 'airline'
  | 'viator'
  | 'gettyourguide'
  | 'klook'
  | 'other';

export type StagingStatus = 'pending' | 'confirmed' | 'dismissed' | 'merged';

// ─── Email Scan ────────────────────────────────────────────────────────────────

export type EmailScanStatus = 'running' | 'completed' | 'failed';
export type EmailScanType = 'full' | 'incremental';

export interface EmailScanResult {
  id: string;
  status: EmailScanStatus;
  scanType: EmailScanType;
  emailsFound: number;
  emailsParsed: number;
  reservationsFound: number;
  errorMessage?: string;
  scanFrom?: string; // ISO
  scanTo?: string;   // ISO
  createdAt: string;
  completedAt?: string;
  reservations: StagedReservation[];
}

// ─── Staged Reservation (from DB, for review UI) ──────────────────────────────

export interface StagedReservation {
  id: string;
  status: StagingStatus;
  reviewedAt?: string;

  // Email provenance
  emailSubject: string;
  emailFrom: string;
  emailFromName?: string;
  emailDate: string;

  // Parsed reservation data
  placeName: string;
  placeType: ReservationType;
  location?: string;
  googlePlaceId?: string;

  // Booking details
  reservationDate?: string;
  reservationTime?: string;
  partySize?: number;
  confirmationNumber?: string;
  provider?: ReservationProvider;

  // Flight-specific
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;

  // Hotel-specific
  checkInDate?: string;
  checkOutDate?: string;

  // Activity-specific
  activityDetails?: string;

  // Confidence
  confidence: number;

  // Trip matching
  matchedTripId?: string;
  matchedTripName?: string;
  suggestedDayNumber?: number;
  suggestedSlotId?: string;

  // Library link (set after confirmation)
  savedPlaceId?: string;

  createdAt: string;
}

// ─── Claude Extraction Output ──────────────────────────────────────────────────

/** What Claude returns when parsing a single email body */
export interface ExtractedReservation {
  placeName: string;
  placeType: ReservationType;
  location?: string;         // city or full address
  reservationDate?: string;  // ISO date
  reservationTime?: string;  // "HH:mm"
  partySize?: number;
  confirmationNumber?: string;
  provider?: string;         // e.g. "OpenTable", "Resy"

  // Flight fields
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;

  // Hotel fields
  checkInDate?: string;
  checkOutDate?: string;

  // Activity fields
  activityDetails?: string;

  confidence: number; // 0-1
}

/** Full parse result from a single email */
export interface EmailParseResult {
  nylasMessageId: string;
  emailSubject: string;
  emailFrom: string;
  emailFromName?: string;
  emailDate: string;
  reservations: ExtractedReservation[];
  skipped: boolean;       // true if email had no extractable reservations
  skipReason?: string;    // e.g. "marketing email", "cancellation notice"
}

// ─── Nylas Message (subset we care about) ──────────────────────────────────────

export interface NylasEmailMessage {
  id: string;
  grantId: string;
  subject?: string;
  from: { name?: string; email: string }[];
  to: { name?: string; email: string }[];
  date: number; // Unix timestamp
  body?: string;
  snippet?: string;
  threadId?: string;
  folders?: string[];
  labels?: { id: string; name: string }[];
}

// ─── Search Queries ────────────────────────────────────────────────────────────

/** Known confirmation email senders / patterns */
export const RESERVATION_SEARCH_QUERIES: { label: string; query: string }[] = [
  // Restaurants
  { label: 'OpenTable', query: 'from:opentable.com subject:reservation' },
  { label: 'Resy', query: 'from:resy.com subject:reservation' },
  { label: 'TheFork', query: 'from:thefork.com subject:(reservation OR booking)' },
  { label: 'Yelp Reservations', query: 'from:yelp.com subject:reservation' },
  { label: 'Google Reservations', query: 'from:google.com subject:"reservation confirmed"' },

  // Hotels
  { label: 'Booking.com', query: 'from:booking.com subject:(confirmation OR booking)' },
  { label: 'Airbnb', query: 'from:airbnb.com subject:(reservation OR booking OR confirmed)' },
  { label: 'Hotels.com', query: 'from:hotels.com subject:confirmation' },
  { label: 'Expedia', query: 'from:expedia.com subject:(confirmation OR itinerary)' },
  { label: 'Marriott', query: 'from:marriott.com subject:confirmation' },
  { label: 'Hilton', query: 'from:hilton.com subject:confirmation' },
  { label: 'Hyatt', query: 'from:hyatt.com subject:confirmation' },
  { label: 'VRBO', query: 'from:vrbo.com subject:(confirmation OR booking)' },

  // Flights
  { label: 'Airline confirmations', query: 'subject:("flight confirmation" OR "itinerary" OR "e-ticket" OR "booking confirmation") from:(-newsletter -promo)' },
  { label: 'Google Flights', query: 'from:google.com subject:("flight" AND "confirmed")' },

  // Activities
  { label: 'Viator', query: 'from:viator.com subject:(confirmation OR booking)' },
  { label: 'GetYourGuide', query: 'from:getyourguide.com subject:(confirmation OR booking)' },
  { label: 'Klook', query: 'from:klook.com subject:confirmation' },

  // Generic confirmation patterns
  { label: 'Generic confirmations', query: 'subject:("your reservation" OR "booking confirmed" OR "reservation confirmed")' },
];

// ─── Trip Match Suggestion ─────────────────────────────────────────────────────

export interface TripMatchSuggestion {
  tripId: string;
  tripName: string;
  tripLocation: string;
  startDate: string;
  endDate: string;
  matchedDayNumber: number;    // which day the reservation falls on
  matchedDayDate: string;      // ISO date of that day
  suggestedSlotId: string;     // breakfast | lunch | dinner | morning | afternoon | evening
  matchConfidence: number;     // 0-1
  matchReason: string;         // "Reservation date falls on Day 3 of your Lisbon trip"
}
