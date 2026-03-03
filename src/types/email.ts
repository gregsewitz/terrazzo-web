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

/** Known confirmation email senders / patterns.
 *  We use BROAD sender-only queries for known platforms (they mostly send
 *  confirmations anyway), plus targeted generic subject queries at the end.
 */
export const RESERVATION_SEARCH_QUERIES: { label: string; query: string }[] = [
  // ── Restaurants ───────────────────────────────────────────────────────
  { label: 'OpenTable', query: 'from:opentable.com' },
  { label: 'Resy', query: 'from:resy.com' },
  { label: 'TheFork', query: 'from:thefork.com' },
  { label: 'Yelp Reservations', query: 'from:yelp.com subject:(reservation OR booking)' },
  { label: 'Tock', query: 'from:exploretock.com' },
  { label: 'SevenRooms', query: 'from:sevenrooms.com' },

  // ── Hotels / Lodging ─────────────────────────────────────────────────
  { label: 'Booking.com', query: 'from:booking.com' },
  { label: 'Airbnb', query: 'from:airbnb.com' },
  { label: 'Hotels.com', query: 'from:hotels.com' },
  { label: 'Expedia', query: 'from:expedia.com' },
  { label: 'Marriott', query: 'from:marriott.com' },
  { label: 'Hilton', query: 'from:hilton.com' },
  { label: 'Hyatt', query: 'from:hyatt.com' },
  { label: 'VRBO', query: 'from:vrbo.com' },
  { label: 'IHG', query: 'from:ihg.com' },
  { label: 'Hostelworld', query: 'from:hostelworld.com' },

  // ── Flights / Airlines ───────────────────────────────────────────────
  { label: 'United Airlines', query: 'from:united.com subject:(confirmation OR itinerary OR receipt)' },
  { label: 'Delta Airlines', query: 'from:delta.com subject:(confirmation OR itinerary OR receipt)' },
  { label: 'American Airlines', query: 'from:aa.com subject:(confirmation OR itinerary OR receipt)' },
  { label: 'Southwest Airlines', query: 'from:southwest.com subject:(confirmation OR itinerary)' },
  { label: 'JetBlue', query: 'from:jetblue.com subject:(confirmation OR itinerary)' },
  { label: 'Alaska Airlines', query: 'from:alaskaair.com subject:(confirmation OR itinerary)' },
  { label: 'Spirit Airlines', query: 'from:spirit.com subject:(confirmation OR itinerary)' },
  { label: 'Frontier Airlines', query: 'from:flyfrontier.com subject:(confirmation OR itinerary)' },
  { label: 'Google Flights', query: 'from:googletravel-noreply@google.com' },
  { label: 'Kayak', query: 'from:kayak.com subject:(confirmation OR itinerary)' },
  { label: 'Skyscanner', query: 'from:skyscanner.com' },
  { label: 'Hopper', query: 'from:hopper.com' },

  // ── Activities / Experiences ──────────────────────────────────────────
  { label: 'Viator', query: 'from:viator.com' },
  { label: 'GetYourGuide', query: 'from:getyourguide.com' },
  { label: 'Klook', query: 'from:klook.com' },
  { label: 'Airbnb Experiences', query: 'from:airbnb.com subject:experience' },

  // ── Transport ────────────────────────────────────────────────────────
  { label: 'Uber', query: 'from:uber.com subject:(trip OR receipt)' },
  { label: 'Lyft', query: 'from:lyft.com subject:(ride OR receipt)' },
  { label: 'Amtrak', query: 'from:amtrak.com subject:(confirmation OR itinerary)' },

  // ── Car Rental ───────────────────────────────────────────────────────
  { label: 'Turo', query: 'from:turo.com' },
  { label: 'Enterprise', query: 'from:enterprise.com subject:confirmation' },
  { label: 'Hertz', query: 'from:hertz.com subject:confirmation' },

  // ── Generic catch-alls (broadest, run last) ──────────────────────────
  { label: 'Reservation confirmations', query: 'subject:("your reservation" OR "reservation confirmed" OR "reservation confirmation")' },
  { label: 'Booking confirmations', query: 'subject:("booking confirmed" OR "booking confirmation" OR "your booking")' },
  { label: 'Itinerary emails', query: 'subject:("your itinerary" OR "trip confirmation" OR "travel confirmation")' },
  { label: 'Check-in emails', query: 'subject:("check-in" OR "check in") subject:(hotel OR flight OR reservation)' },
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
