import type { PerriandIconName } from '../components/icons/PerriandIcons';
import { INK } from '@/constants/theme';
export type { PerriandIconName };

// Forme Libere Design Tokens
export const T = {
  ink: '#1c1a17',
  honey: '#c8923a',
  amber: '#a06c28',
  verde: '#2a7a56',
  pantonViolet: '#6844a0',
  pantonOrange: '#e86830',
  royerePink: '#e87080',
  warmWhite: '#f5f0e6',
  travertine: '#e8dcc8',
  cream: '#fdfaf3',
  signalRed: '#d63020',
  chromeYellow: '#eeb420',
  linen: '#ede6d8',
  ghost: '#6b8b9a',
} as const;

export const DOMAIN_COLORS: Record<TasteDomain, string> = {
  Design: T.signalRed,
  Atmosphere: T.pantonOrange,
  Character: T.pantonViolet,
  Service: T.amber,
  FoodDrink: T.royerePink,
  Setting: T.verde,
  Wellness: T.chromeYellow,
  Sustainability: T.ghost,
};

export const DOMAIN_ICONS: Record<TasteDomain, PerriandIconName> = {
  Design: 'design',
  Atmosphere: 'discover',
  Character: 'character',
  Service: 'service',
  FoodDrink: 'food',
  Setting: 'location',
  Wellness: 'wellness',
  Sustainability: 'plan',
};

// Rating system
export const RATING_COLORS = {
  myPlace: T.verde,
  enjoyed: T.honey,
  mixed: T.chromeYellow,
  notMe: T.signalRed,
} as const;

export const REACTIONS = [
  { id: 'myPlace', icon: 'myPlace' as PerriandIconName, label: 'Obsessed', color: RATING_COLORS.myPlace },
  { id: 'enjoyed', icon: 'enjoyed' as PerriandIconName, label: 'Enjoyed it', color: RATING_COLORS.enjoyed },
  { id: 'mixed', icon: 'mixed' as PerriandIconName, label: 'Mixed', color: RATING_COLORS.mixed },
  { id: 'notMe', icon: 'notMe' as PerriandIconName, label: 'Not me', color: RATING_COLORS.notMe },
] as const;

// Destination colors (for multi-city trips)
export const DEST_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  // Japan
  Tokyo: { bg: '#edf1f5', accent: '#5a7a9a', text: '#3a5a7a' },
  Hakone: { bg: '#f0ede8', accent: '#9a7a5a', text: '#7a5a3a' },
  Kyoto: { bg: '#edf5ef', accent: '#5a9a6a', text: '#3a7a4a' },
  Osaka: { bg: '#f5ede8', accent: '#c87a4a', text: '#a85a2a' },
  // Scandinavia
  Stockholm: { bg: '#edf1f5', accent: '#4a7a9a', text: '#2a5a7a' },
  Copenhagen: { bg: '#f5f0e8', accent: '#9a7a4a', text: '#7a5a2a' },
  // Mexico
  'Mexico City': { bg: '#f5ede8', accent: '#c8643a', text: '#a84a20' },
  // France
  Paris: { bg: '#f0edf5', accent: '#7a5a9a', text: '#5a3a7a' },
  // Sicily
  Palermo: { bg: '#f5ede8', accent: '#c87a4a', text: '#a85a2a' },
  'West Coast': { bg: '#edf5f2', accent: '#4a9a7a', text: '#2a7a5a' },
  Agrigento: { bg: '#f5f2e8', accent: '#9a8a4a', text: '#7a6a2a' },
  'Noto / Syracuse': { bg: '#f5ede8', accent: '#c88a4a', text: '#a86a2a' },
  Taormina: { bg: '#edf1f5', accent: '#5a7a9a', text: '#3a5a7a' },
};

// Ghost card source types — each source gets its own visual treatment
export const SOURCE_STYLES: Record<GhostSourceType, { color: string; bg: string; icon: PerriandIconName; label: string }> = {
  email: { color: '#4a6e7a', bg: 'rgba(107,139,154,0.12)', icon: 'email', label: 'Email' },
  friend: { color: T.verde, bg: 'rgba(42,122,86,0.12)', icon: 'friend', label: 'Friend' },
  terrazzo: { color: '#4a6e7a', bg: 'rgba(107,139,154,0.12)', icon: 'terrazzo', label: 'Terrazzo pick' },
  maps: { color: '#a84018', bg: 'rgba(232,104,48,0.10)', icon: 'maps', label: 'Google Maps' },
  article: { color: '#7a5a20', bg: 'rgba(200,146,58,0.12)', icon: 'article', label: 'Article' },
  manual: { color: T.ink, bg: INK['06'], icon: 'manual', label: 'Added' },
};

/**
 * Taste Taxonomy v2
 *
 * 6 Taste Domains — rich signal-to-signal matching dimensions:
 *   Design, Atmosphere, Character, Service, FoodDrink, Setting
 *
 * 2 Preference Dimensions — weighted checklists with thinner taste spaces:
 *   Wellness, Sustainability
 */
export type TasteDomain = 'Design' | 'Atmosphere' | 'Character' | 'Service' | 'FoodDrink' | 'Setting' | 'Wellness' | 'Sustainability';

/** 6 core taste domains (rich signal-to-signal matching) */
export const CORE_TASTE_DOMAINS: TasteDomain[] = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting'];

/** 2 preference dimensions (weighted checklist, lighter embedding treatment) */
export const PREFERENCE_DIMENSIONS: TasteDomain[] = ['Wellness', 'Sustainability'];

/** All 8 dimensions (6 taste domains + 2 preference dimensions) */
export const ALL_TASTE_DOMAINS: TasteDomain[] = [...CORE_TASTE_DOMAINS, ...PREFERENCE_DIMENSIONS];

export type TasteProfile = Record<TasteDomain, number>;

// ─── Signal Modality & Decay ───

export type SignalModality = 'VOICE' | 'CARD' | 'SLIDER' | 'SWIPE' | 'SPECTRUM' | 'IMPORT';

export type SustainabilityDimension = 'ENVIRONMENTAL' | 'SOCIAL' | 'CULTURAL' | 'ECONOMIC';

export type SustainabilitySensitivity = 'LEADING' | 'CONSCIOUS' | 'PASSIVE' | 'INDIFFERENT';

export type TrajectoryDirection = 'REFINING' | 'EXPANDING' | 'SHIFTING' | 'STABLE';

// ─── Sustainability Signal ───

export interface SustainabilitySignal {
  id?: string;
  tag: string;
  confidence: number;
  dimension: SustainabilityDimension;
  extractedAt?: string; // ISO timestamp — assigned by DB
}

// ─── Taste Trajectory Shift ───

export interface TasteTrajectoryShift {
  id: string;
  domain: TasteDomain;
  fromPattern: string;
  toPattern: string;
  detectedAt: string; // ISO timestamp
}

// ─── Sustainability Profile (on user) ───

export interface SustainabilityProfile {
  sensitivity: SustainabilitySensitivity;
  priorities: string[];
  dealbreakers: string[];
  willingnessToPayPremium: number; // 0-1
}

// ─── Heritage Data (from pipeline character_analysis stage) ───

export interface HeritageData {
  architect?: string;
  yearEstablished?: string;
  yearRenovated?: string;
  previousUses?: string[];
  significance?: string;
  restorationPhilosophy?: string;
}

// ─── Seasonality Data (from pipeline atmosphere_analysis stage) ───

export interface SeasonalityData {
  peakMonths?: string[];
  shoulderSeasons?: string[];
  quietMonths?: string[];
  bestMonths?: string[];
  weatherByMonth?: Record<string, string>;
  crowdPatterns?: { peak?: string; shoulder?: string; quiet?: string };
  seasonalClosures?: string[];
  recommendations?: string;
}

// ─── Competitive Context (from pipeline setting_analysis stage) ───

export type CompetitivePosition =
  | 'category_leader'
  | 'local_secret'
  | 'neighborhood_institution'
  | 'rising_star'
  | 'specialist'
  | 'niche'
  | 'unique';

export type EcosystemType = 'saturated' | 'unique' | 'emerging' | 'dominant';

export type NeighborhoodRole = 'anchor' | 'destination' | 'discovery' | 'outpost';

export interface CompetitiveAlternative {
  name: string;
  distance_km: number;
  why: string;
}

export interface CompetitiveContextData {
  position?: CompetitivePosition;
  positioningRationale?: string;
  uniquenessScore?: number;
  ecosystemType?: EcosystemType;
  neighborhoodRole?: NeighborhoodRole;
  neighborhoodContext?: string;
  alternativeScenarios?: Record<string, string>;
  nearbyAlternatives?: CompetitiveAlternative[];
}

export type PlaceType = 'restaurant' | 'museum' | 'activity' | 'hotel' | 'rental' | 'neighborhood' | 'bar' | 'cafe' | 'shop';

export type ImportSourceType = 'url' | 'text' | 'google-maps' | 'email' | 'friend-list';

export type GhostSourceType = 'email' | 'friend' | 'terrazzo' | 'maps' | 'article' | 'manual';

export type PlaceStatus = 'available' | 'placed' | 'rejected';

// Ghost card status for items that are proposed but not confirmed
export type GhostStatus = 'proposed' | 'confirmed' | 'dismissed';

export interface ImportSource {
  type: ImportSourceType;
  name: string;
  url?: string;
}

/** Append-only provenance log entry — tracks every import that touched a place */
export interface ImportSourceEntry {
  type: string;
  name: string;
  url?: string;
  importedAt: string; // ISO timestamp
}

export interface GooglePlaceData {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  priceLevel?: number;
  hours?: string[];
  photoUrl?: string;
  address?: string;
  website?: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

export interface PlaceEnrichment {
  closedDays?: string[];
  hours?: string;
  seasonalNote?: string;
  priceRange?: string;
  description?: string;
  confidence: number;
}

export interface TerrazzoInsight {
  why: string;
  caveat?: string;
}

// Friend attribution for friend-recommended places
export interface FriendAttribution {
  name: string;
  note?: string; // "Go early, before 8am"
  avatarUrl?: string;
}

// Terrazzo reasoning for suggested places
export interface TerrazzoReasoning {
  rationale: string; // "Fits your Food signal"
  confidence: number;
}

export interface ImportedPlace {
  id: string;
  name: string;
  type: PlaceType;
  location: string;
  source: ImportSource;
  matchScore: number;
  matchBreakdown: TasteProfile;
  matchExplanation?: {
    topClusters: Array<{ label: string; domain: string; score: number; signals: string[] }>;
    narrative: string;
  };
  tasteNote: string;
  google?: GooglePlaceData;
  enrichment?: PlaceEnrichment;
  terrazzoInsight?: TerrazzoInsight;
  status: PlaceStatus;
  placedIn?: { day: number; slot: string };
  // Enhanced slot grid fields
  ghostSource?: GhostSourceType;
  ghostStatus?: GhostStatus;
  friendAttribution?: FriendAttribution;
  terrazzoReasoning?: TerrazzoReasoning;
  savedAt?: string; // ISO timestamp of when place was saved to library
  rating?: PlaceRating; // user's personal rating
  // Enriched card fields (from import briefing)
  whatToOrder?: string[];  // e.g. ["Puntillas ★", "Gambas de la santa"]
  tips?: string[];         // e.g. ["⏰ Go early (can be a wait)", "🍺 Drink at the bar while waiting"]
  alsoKnownAs?: string;   // e.g. "El Sótano"
  importBatchId?: string;  // links places from same import for "Also from this guide"
  // Personal context extracted from user's notes
  userContext?: string;     // e.g. "going in May", "planned for my 40th", "with my daughter (5)"
  travelWith?: string;      // e.g. "bestie", "daughter", "friends"
  timing?: string;          // e.g. "this fall", "May 2025", "when daughter graduates"
  intentStatus?: 'booked' | 'planning' | 'dreaming' | 'researching'; // how concrete this is
  // Specific time — optional precision within a broad day slot (e.g. "20:15" for an 8:15 PM reservation)
  specificTime?: string;         // 24h format "HH:mm" — displayed contextually based on place type
  specificTimeLabel?: string;    // optional context: "Reservation", "Show starts", "Check-in" — auto-inferred if absent
  // Reference-based model — links trip places back to the canonical library entry
  libraryPlaceId?: string;  // SavedPlace.id this was sourced from (present when placed from library)
  // Import dedup — set by import pipeline when place already exists in library
  alreadyInLibrary?: boolean;
  existingSource?: ImportSource;       // the primary source from the existing library entry
  existingImportSources?: ImportSourceEntry[]; // full provenance log from library
  // Attribution — who added this place (relevant in shared trips)
  addedByUserId?: string;   // null/undefined = trip owner
  addedByName?: string;     // "Sarah" — denormalized for display
  // ─── v2 Enrichment Surfacing ───
  sustainabilityScore?: number;        // 0-1 from PlaceIntelligence
  accolades?: Array<{ type: string; value: string; year?: string | null; category?: string }>;
  formalityLevel?: string;             // white-glove | professional-warm | casual-friendly | self-service | mixed
  cuisineStyle?: string;               // short cuisine description
}

// ─── Quick Entry (free-text slot items) ───

export type QuickEntryCategory = 'activity' | 'transport' | 'dining' | 'logistics' | 'other';
export type QuickEntryStatus = 'confirmed' | 'tentative';

export interface QuickEntry {
  id: string;
  text: string;                   // Original user input (preserved for re-parsing)
  label: string;                  // AI-cleaned display name (question mark stripped)
  category: QuickEntryCategory;   // Derived from text content
  status: QuickEntryStatus;       // 'tentative' if input ended with "?"
  specificTime?: string;          // Extracted time in 24h "HH:mm" format
  specificTimeLabel?: string;     // "Departure", "Pickup", "Reservation", etc.
  notes?: string;                 // Any extra context
  createdAt: string;              // ISO timestamp
}

export const QUICK_ENTRY_CATEGORY_ICONS: Record<QuickEntryCategory, PerriandIconName> = {
  activity: 'activity',
  transport: 'transport',
  dining: 'restaurant',
  logistics: 'plan',
  other: 'pin',
};

export interface TimeSlot {
  id: string;
  label: string;
  time: string;
  places: ImportedPlace[];        // confirmed places (supports multiple per slot)
  quickEntries?: QuickEntry[];    // free-text entries (lightweight, user-typed)
  ghostItems?: ImportedPlace[];   // proposed items (ghost cards) for this slot
}

// ─── Hotel / Accommodation ───
export interface HotelInfo {
  name: string;
  placeId?: string;        // Google Places ID for enrichment
  address?: string;        // formatted address
  lat?: number;
  lng?: number;
  isCustom?: boolean;      // true for Airbnbs, villas, etc. (no placeId)
}

// ─── Transport / Travel Events ───
export type TransportMode = 'flight' | 'train' | 'ferry' | 'bus' | 'drive' | 'other';

export interface TransportEvent {
  id: string;
  mode: TransportMode;
  from: string;                 // origin city/station/airport
  to: string;                   // destination city/station/airport
  departureTime?: string;       // e.g. "14:30" or "2:30 PM"
  arrivalTime?: string;
  details?: string;             // flight number, booking ref, etc.
  isConfirmed?: boolean;        // true = from email sync or confirmed booking
  /** Which slot boundary this renders after: e.g. 'morning' means between morning & lunch */
  afterSlot?: string;
}

export const TRANSPORT_ICONS: Record<TransportMode, PerriandIconName> = {
  flight: 'discover',
  train: 'plan',
  ferry: 'discover',
  bus: 'plan',
  drive: 'location',
  other: 'plan',
};

export interface TripDay {
  dayNumber: number;
  date?: string;
  dayOfWeek?: string;
  destination?: string; // city name for multi-destination trips
  hotel?: string;              // legacy plain-text field
  hotelInfo?: HotelInfo;       // structured hotel data
  transport?: TransportEvent[];
  slots: TimeSlot[];
}

// ─── Dream Board ───
export type DreamBoardEntryType = 'note' | 'link' | 'checklist' | 'question' | 'vibe';

export interface DreamBoardEntry {
  id: string;
  type: DreamBoardEntryType;
  content: string;           // text for notes/vibes/questions, URL for links
  title?: string;            // display title for links, or checklist title
  items?: { text: string; done: boolean }[]; // checklist items
  pinned?: boolean;
  resolved?: boolean;        // for questions — marks as answered/figured out
  createdAt: string;         // ISO timestamp
  color?: string;            // accent color (used by vibes, optional for others)
}

/** @deprecated Use DreamBoardEntry — kept for migration compatibility */
export type ScratchpadEntryType = DreamBoardEntryType;
/** @deprecated Use DreamBoardEntry — kept for migration compatibility */
export type ScratchpadEntry = DreamBoardEntry;

export interface Trip {
  id: string;
  name: string;
  location: string;
  startDate?: string;
  endDate?: string;
  destinations?: string[]; // multi-city support
  geoDestinations?: GeoDestination[]; // geocoded destination data
  travelContext?: TravelContext;
  groupSize?: number;
  status?: TripStatus;
  flexibleDates?: boolean; // true = no specific dates, show "Day 1, Day 2" etc.
  days: TripDay[];
  pool: ImportedPlace[];
  dreamBoard?: DreamBoardEntry[];  // freeform notes, links, checklists, questions, vibes
  /** @deprecated Use dreamBoard */
  scratchpad?: DreamBoardEntry[];
}

// Rating system types
export type ReactionId = 'myPlace' | 'enjoyed' | 'mixed' | 'notMe';
export type ReturnIntent = 'absolutely' | 'maybe' | 'probably_not';

export interface PlaceRating {
  reaction: ReactionId;
  tags?: string[];           // "What stood out?" dimensional tags (positive)
  shortcomingTags?: string[]; // "What fell short?" tags (mixed/negative)
  contextTags?: string[];    // "Perfect for..." / "Best suited for..." tags
  returnIntent?: ReturnIntent;
  personalNote?: string;
  ratedAt: string;           // ISO date
}

// Adaptive tags by place type
export const STANDOUT_TAGS: Record<string, string[]> = {
  restaurant: ['Life-changing dish', 'Creative menu', 'Perfect wine pairing', 'Great value', 'Standout cocktails', 'Beautiful space', 'Perfect service', 'Great atmosphere'],
  hotel: ['Beautiful design', 'Incredible space', 'Perfect atmosphere', 'Great location', 'Perfect service', 'Felt like home', 'Loved the ritual', 'Surprising details', 'Memorable breakfast'],
  bar: ['Standout cocktails', 'Natural wine', 'Great beer', 'Excellent snacks', 'Great atmosphere', 'Perfect for late night', 'Beautiful space'],
  museum: ['Stunning architecture', 'Moved me', 'Worth the wait', 'Audio guide recommended', 'Beautiful space', 'Great location'],
  cafe: ['Outstanding coffee', 'Great pastries', 'Beautiful space', 'Good for working', 'Perfect atmosphere', 'Great location'],
  activity: ['Unforgettable experience', 'Worth every penny', 'Great guide', 'Stunning scenery', 'Perfect atmosphere'],
  neighborhood: ['Great for walking', 'Hidden finds', 'Stunning architecture', 'Local feeling', 'Great food scene'],
  shop: ['Unique finds', 'Beautiful space', 'Friendly staff', 'Great quality', 'Good prices'],
};

// Negative/critical tags by place type — shown for Mixed and Not Me reactions
export const SHORTCOMING_TAGS: Record<string, string[]> = {
  restaurant: ['Overpriced', 'Underwhelming food', 'Poor service', 'Too loud', 'Long wait', 'Uncomfortable seating', 'Not worth the hype'],
  hotel: ['Overpriced', 'Poor service', 'Underwhelming food', 'Too crowded', 'Dated/run-down', 'Bad location', 'Not as advertised', 'Noisy', 'Not clean'],
  bar: ['Overpriced', 'Too crowded', 'Too loud', 'Weak drinks', 'Poor service', 'Bad atmosphere', 'Long wait'],
  museum: ['Not worth the wait', 'Overpriced', 'Too crowded', 'Underwhelming collection', 'Poor layout', 'Bad signage'],
  cafe: ['Mediocre coffee', 'Overpriced', 'Too crowded', 'Uncomfortable', 'Poor service', 'Noisy'],
  activity: ['Not worth the price', 'Overhyped', 'Poor organization', 'Too crowded', 'Felt unsafe', 'Too touristy'],
  neighborhood: ['Felt unsafe', 'Too touristy', 'Not much to see', 'Hard to navigate', 'Overhyped'],
  shop: ['Overpriced', 'Poor quality', 'Pushy staff', 'Nothing unique', 'Disappointing selection'],
};

export const CONTEXT_TAGS = ['Solo', 'Couple', 'Friends', 'Family', 'Special occasion', 'Work trip'];

export type TripStatus = 'planning' | 'dreaming';
export type TravelContext = 'solo' | 'partner' | 'friends' | 'family';

export interface GeoDestination {
  name: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

export interface TripCreationData {
  name: string;
  destinations: string[];
  geoDestinations?: GeoDestination[]; // geocoded destination data
  startDate: string; // ISO date (empty string when flexibleDates)
  endDate: string;   // ISO date (empty string when flexibleDates)
  flexibleDates?: boolean; // true = dates undecided, use numDays instead
  numDays?: number;        // trip length when flexibleDates is true
  travelContext: TravelContext;
  groupSize?: number; // for friends/family
  status: TripStatus;
  dayAllocation?: Record<string, number>; // e.g. { "Tokyo": 6, "Kyoto": 4 } — days per destination
}

export interface AISuggestion {
  item: ImportedPlace;
  rationale: string;
  alternativeCount: number;
  isStretch: boolean;
}

// ─── Suggestion Engine (Tier 2: Claude-powered contextual suggestions) ────────
export interface SuggestionItem {
  placeId: string;
  targetSlot: string;          // 'breakfast' | 'morning' | ... | 'evening'
  confidence: number;          // 0-1
  rationale: string;           // personal, Terrazzo-voice reasoning
  isStretchPick: boolean;
}

export interface SuggestionResponse {
  suggestions: SuggestionItem[];
  cacheKey: string;
  generatedAt: string;
}

export interface DayWeather {
  tempHighC: number;
  tempLowC: number;
  precipMm: number;
  weatherCode: number;
  description: string;
}

export interface DaySuggestionContext {
  tripId: string;
  tripName: string;
  dayNumber: number;
  dayDate?: string;
  dayOfWeek?: string;
  destination: string;
  travelParty?: { context: TravelContext; groupSize?: number };
  weather?: DayWeather;
  slots: Array<{
    id: string;
    label: string;
    time: string;
    confirmedPlaces: Array<{ name: string; type: string; location: string }>;
  }>;
  tasteProfile: TasteProfile;
  topAxes: string[];
  candidates: Array<{
    id: string;
    name: string;
    type: string;
    location: string;
    matchScore: number;
    topAxes: string[];
    tasteNote?: string;
  }>;
}

// Default time slots for a day — updated to match Enhanced Slot Grid
export const DEFAULT_TIME_SLOTS: Omit<TimeSlot, 'ghostItems'>[] = [
  { id: 'breakfast', label: 'Breakfast', time: '8:00 AM', places: [] },
  { id: 'morning', label: 'Morning', time: '10:00 AM', places: [] },
  { id: 'lunch', label: 'Lunch', time: '12:30 PM', places: [] },
  { id: 'afternoon', label: 'Afternoon', time: '2:30 PM', places: [] },
  { id: 'dinner', label: 'Dinner', time: '7:00 PM', places: [] },
  { id: 'evening', label: 'Evening', time: '9:30 PM', places: [] },
];

export const SLOT_ICONS: Record<string, PerriandIconName> = {
  breakfast: 'breakfast',
  morning: 'morning',
  lunch: 'lunch',
  afternoon: 'afternoon',
  dinner: 'dinner',
  evening: 'evening',
};

// Terrazzo voice — used across all prompts for consistent tone
export const TERRAZZO_VOICE = `You write like a well-traveled friend who happens to have incredible taste — warm but not gushing, opinionated but never snobby. You use short, vivid descriptions. You notice the details that matter (the way light hits a courtyard, the specific dish to order, the hour when a place transforms). You're honest about trade-offs. You never say "hidden gem" or "must-visit." You speak like someone sharing a personal recommendation over wine, not writing a guidebook.`;

// ─── Collection Types ───

export interface Collection {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  placeIds: string[];       // references to library places by ID
  cities: string[];          // derived from member places
  isSmartCollection?: boolean;
  query?: string;            // natural language query (smart collections)
  filterTags?: string[];     // parsed filter tags (smart collections)
  createdAt: string;
  updatedAt: string;
  // Sharing
  isPublic?: boolean;
  collaborators?: { userId: string; role: 'owner' | 'editor' | 'viewer' }[];
}

// ─── Pipeline Briefing Types ───

export const DIMENSION_TO_DOMAIN: Record<string, TasteDomain> = {
  'Design': 'Design',
  'Atmosphere': 'Atmosphere',
  'Character': 'Character',
  'Service': 'Service',
  'FoodDrink': 'FoodDrink',
  'Setting': 'Setting',
  'Wellness': 'Wellness',
  'Sustainability': 'Sustainability',
};

export interface BriefingSignal {
  dimension: string;
  confidence: number;
  signal: string;
  source_type?: string;
  review_corroborated?: boolean;
}

export interface BriefingAntiSignal {
  dimension: string;
  confidence: number;
  signal: string;
}

export interface BriefingData {
  status: 'pending' | 'enriching' | 'complete' | 'failed';
  propertyName: string;
  signals: BriefingSignal[];
  antiSignals: BriefingAntiSignal[];
  reliability: { overall: number; categories: Record<string, unknown>; totalReviews: number } | null;
  facts: Record<string, unknown> | null;
  signalCount: number;
  antiSignalCount: number;
  reviewCount: number;
  reliabilityScore: number | null;
  lastEnrichedAt: string | null;
  pipelineVersion: string;
  // Synthesis fields
  description?: string | null;
  whatToOrder?: unknown[] | null;
  tips?: unknown[] | null;
  alsoKnownAs?: string | null;
  googleData?: Record<string, unknown> | null;
  formalityLevel?: string | null;
  cuisineStyle?: string | null;
  // Structured sub-objects extracted from facts
  heritage?: HeritageData | null;
  seasonality?: SeasonalityData | null;
  latestRun: {
    status: string;
    currentStage: string | null;
    stagesCompleted: string[];
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
  } | null;
}

export const PIPELINE_STAGES = [
  // Layer 1 — Data Gathering
  { key: 'google_places', label: 'Places' },
  { key: 'scrape_reviews', label: 'Reviews' },
  // Layer 2 — Broad Extraction
  { key: 'editorial_extraction', label: 'Editorial' },
  { key: 'instagram_analysis', label: 'Instagram' },
  { key: 'review_intelligence', label: 'Insights' },
  // Layer 3 — Domain Deep Dives (1:1 with taste domains)
  { key: 'design_analysis', label: 'Design' },
  { key: 'atmosphere_analysis', label: 'Atmosphere' },
  { key: 'character_analysis', label: 'Character' },
  { key: 'service_analysis', label: 'Service' },
  { key: 'fooddrink_analysis', label: 'Food & Drink' },
  { key: 'setting_analysis', label: 'Setting' },
  { key: 'wellness_analysis', label: 'Wellness' },
  { key: 'sustainability_analysis', label: 'Sustainability' },
  // Layer 4 — Aggregation
  { key: 'merge', label: 'Compose' },
  { key: 'save', label: 'Done' },
] as const;

// ─── Onboarding Types ───

export interface TasteSignal {
  tag: string;
  cat: string; // TasteDomain or 'Rejection' | 'Context' | 'Emotion' | 'Core'
  confidence: number; // 0.0–1.0
}

export interface TasteContradiction {
  stated: string;
  revealed: string;
  resolution: string;
  matchRule: string;
}

export interface ContextModifier {
  context: string;
  shifts: string;
}

export interface MatchedProperty {
  name: string;
  location: string;
  score: number;
  matchReasons: string[];
  tensionResolved: string;
  googlePlaceId?: string;
  atmosphereNote?: string;          // atmosphere/pace compatibility explanation
  sustainabilityScore?: number;     // 0-1 sustainability alignment
}

export interface GeneratedTasteProfile {
  overallArchetype: string;
  archetypeDescription: string;
  emotionalDriver: {
    primary: string;
    description: string;
    secondary: string;
  };
  contradictions: TasteContradiction[];
  contextModifiers: ContextModifier[];
  microTasteSignals: Record<string, string[]>;
  radarData: { axis: string; value: number }[];
  matchedProperties: MatchedProperty[];

  // ─── Reveal Card Data (v3) ───
  /** A direct quote from the user's onboarding conversation + insight */
  bestQuote?: {
    quote: string;
    insight: string;
  };
  /** Design Language card — annotations for the ELO-derived spectrum axes */
  designInsight?: {
    headline: string;           // e.g. "You read a room before you feel it."
    annotations: {              // one per spectrum axis, keyed by axis name
      axis: string;             // e.g. "volume", "temperature", "time"
      label: [string, string];  // pole labels e.g. ["Minimal", "Maximal"]
      note: string;             // editorial annotation referencing their conversation
    }[];
  };
  /** Synthesized ideal day on a trip */
  perfectDay?: {
    morning: string;
    afternoon: string;
    evening: string;
  };
  /** How taste shifts across travel companions */
  howYouShift?: {
    context: string;   // e.g. "With Sarah" or "Solo"
    insight: string;   // editorial observation
  }[];
  /** Taste neighbor archetypes and rarity stat */
  tasteNeighbors?: {
    nearbyArchetypes: string[];    // 2-3 archetype names they overlap with
    distinction: string;           // what makes them different from neighbors
    rarityStat: string;            // e.g. "Only 4% of travelers pair X with Y"
  };
  /** Destinations that match their taste DNA */
  destinations?: {
    familiar: string[];            // 2-3 expected matches
    surprise: {
      name: string;
      reason: string;              // one-line explanation
    };
  };

  // ─── Expanded Ontology (v4) ───
  /** Sustainability profile derived from onboarding signals */
  sustainabilityProfile?: SustainabilityProfile;
  /** Taste trajectory — how the user's preferences are evolving */
  tasteTrajectory?: {
    direction: TrajectoryDirection;
    description: string;
  };
  /** Profile version — incremented on each re-synthesis */
  profileVersion?: number;
}

export interface ConversationMessage {
  role: 'ai' | 'user' | 'system';
  text: string;
  phaseId?: string;
  /** Resolved property anchors the user should verify before they're used for vector blending */
  anchorsToVerify?: PropertyAnchor[];
}

// ─── Elo-Ranked Comparison Types ───

export type TasteAxes = {
  volume: number;      // minimal ↔ maximal
  temperature: number; // cool ↔ warm
  time: number;        // antique ↔ contemporary
  formality: number;   // raw ↔ polished
  culture: number;     // universal ↔ place-specific
  mood: number;        // dark/moody ↔ bright/joyful
};

export interface ExperienceItem {
  id: string;
  label: string;
  cluster: string;
  signals: string[];
  category: string; // TasteDomain
  scene?: string; // short atmospheric description
  pairWith?: string; // id of natural comparison partner (same dimension)
  dimension?: string; // human-readable dimension label e.g. "Morning Ritual"
}

export interface DesignerItem {
  id: string;
  name: string;
  hotel: string;
  vibe: string;
  cluster: string;
  imageUrls: string[];
  axes: TasteAxes;
  signals: string[];
}

export interface EloItem {
  id: string;
  rating: number;
  comparisons: number;
  cluster: string;
  signals: string[];
  category?: string;
  metadata: Record<string, unknown>;
}

export interface EloState {
  items: EloItem[];
  history: { winnerId: string; loserId: string; round: number }[];
  round: number;
}

export type OnboardingPhaseModality =
  | 'voice'
  | 'cards'
  | 'visual'
  | 'voice+cards'
  | 'trip-seed'
  | 'slider'
  | 'swipe'
  | 'spectrum'
  | 'form'                // Quick bio form (Act 0)
  | 'property-reactions'  // Property reaction card phase (Act 0 + Act 2 gap-fill)
  | 'scale'               // Single-question selector (sustainability check)
  | 'force-rank'          // Rank items by personal importance (Act 2 details-matter)
  | 'quick-choice'        // Pick from curated options (Act 2 emotional-core)
  | 'scene'               // Single-select from 4 options, multi-question stepper
  | 'image-pair'           // A/B photo comparison — tap to choose
  | 'email-connect';       // Gmail/Nylas OAuth connect prompt

export interface OnboardingPhase {
  id: string;
  phaseNumber: number;
  title: string;
  subtitle: string;
  modality: OnboardingPhaseModality;
  act: 1 | 2 | 3;
  aiPrompt: string;
  followUps: string[];
  sampleUserResponses: string[];
  extractedSignals: TasteSignal[];
  certaintyAfter: Record<string, number>;
  experiencePool?: ExperienceItem[];
  designerPool?: DesignerItem[];
  /** Custom slider definitions — passed to SliderPhaseView when modality is 'slider' */
  sliderDefs?: { id: string; leftLabel: string; rightLabel: string; leftSignals: string[]; rightSignals: string[]; domain: string }[];
  /** Custom swipe card definitions — passed to SwipePhaseView when modality is 'swipe' */
  swipeCards?: { id: number; prompt: string; optionA: { label: string; description?: string }; optionB: { label: string; description?: string }; aSignals: string[]; bSignals: string[]; domain: string }[];
  /** Whether this phase can be skipped based on domain gap analysis */
  isAdaptive?: boolean;
  /** Domains this phase targets — used for adaptive routing and property-reactions phases */
  targetDomains?: TasteDomain[];
  /** Number of cards to show in property-reactions phases */
  cardCount?: number;
  /** Where to source properties: 'db' (PlaceIntelligence) or 'email' (parsed email history) */
  propertySource?: 'db' | 'email';
  /** Force-rank items — user ranks these by personal importance */
  forceRankItems?: ForceRankItem[];
  /** Quick-choice options — user picks from curated options */
  quickChoiceOptions?: QuickChoiceOption[];
  /** Max selections allowed for quick-choice (defaults to 3) */
  quickChoiceMax?: number;
  /** Min selections required for quick-choice (defaults to 2) */
  quickChoiceMin?: number;
  /** Scene questions — single-select from 4 options, multi-question stepper */
  sceneQuestions?: SceneQuestion[];
  /** Image pair questions — A/B photo comparison stepper */
  imagePairQuestions?: ImagePairQuestion[];
}

/** A/B photo comparison question — user taps the image that draws them in */
export interface ImagePairQuestion {
  id: string;
  prompt: string;
  a: { imageUrl: string; label: string };
  b: { imageUrl: string; label: string };
  aSignals: string[];
  bSignals: string[];
  domain: string;
  /** If true, cross-checks against signals from earlier phases */
  isValidator?: boolean;
}

export interface ForceRankItem {
  id: string;
  label: string;
  description?: string;
  signals: string[];
  domain: string;
}

export interface QuickChoiceOption {
  id: string;
  label: string;
  description?: string;
  signals: string[];
  domain: string;
}

/** A single scene question within a SceneChoiceView phase (multi-question stepper) */
export interface SceneQuestion {
  id: string;
  prompt: string;
  options: SceneOption[];
  /** If true, this question validates/contradicts signals from another phase */
  isValidator?: boolean;
  /** Which domain(s) this question primarily targets */
  domains: string[];
}

export interface SceneOption {
  id: string;
  label: string;
  signals: string[];
  domain: string;
}

export interface TrustedSource {
  type: 'friend' | 'publication' | 'instagram' | 'newsletter';
  name: string;
  context?: string;
  relationship?: string;
}

export interface GoBackPlace {
  placeName: string;
  location?: string;
  reason?: string;
  matchScore?: number;
  calibrationStatus?: 'confirmed' | 'flagged';
}

export interface SeedTripInput {
  name: string;
  destinations: GeoDestination[];
  /** @deprecated Use name + destinations instead */
  destination?: string;
  dates?: string;
  travelContext?: TravelContext;
  status: TripStatus;
  seedSource: 'onboarding_planning' | 'onboarding_dream';
  rawUserInput: string;
}

export interface OnboardingLifeContext {
  firstName?: string;
  homeCity?: string;
  homeCityGeo?: { lat: number; lng: number; placeId?: string };
  partnerName?: string;
  relationshipStatus?: 'married' | 'partnered' | 'single' | 'not_specified';
  hasKids?: boolean;
  kidAges?: ('baby' | 'toddler' | 'school_age' | 'teen')[];
  primaryCompanions: TravelContext[];
  travelFrequency?: 'frequent' | 'occasional' | 'rare';
  // Phase 3: Companion context
  partnerTravelDynamic?: string;
  soloTravelIdentity?: string;
  contextModifiers?: { companion: string; preferences: string[] }[];
  // Phase 10: Emotional drivers
  emotionalDriverPrimary?: string;
  emotionalDriverSecondary?: string | null;
  // Dream destinations from conversation
  dreamDestinations?: Array<{
    name: string;
    location?: string;
    placeType?: 'city' | 'country' | 'hotel' | 'restaurant' | 'region';
    appeal: string;
    confidence: number;
  }>;
  // Allow dynamic fields from AI extraction
  [key: string]: unknown;
}

export type OnboardingDepth = 'full_flow' | 'act_1_only';

// ─── Deletion Impact Types ───

export interface DeletionImpact {
  placeId: string;
  placeName: string;
  collectionCount: number;
  collections: { id: string; name: string }[];
  tripCount: number;
  trips: {
    tripId: string;
    tripName: string;
    dayNumber: number | null;
    slotId: string | null;
  }[];
}

export interface AnalysisResult {
  signals: TasteSignal[];
  certainties: Record<string, number>;
  followUp: string;
  contradictions: TasteContradiction[];
  phaseComplete: boolean;
  // Expanded ontology
  sustainabilitySignals?: SustainabilitySignal[];
  emotionalDriverHint?: string;
  /** Places mentioned by user, extracted by LLM for property-anchored preference capture */
  mentionedPlaces?: MentionedPlace[];
}

// ─── Property-Anchored Preference Capture ────────────────────────────────────

/** Place mentioned by user during onboarding (extracted by LLM) */
export interface MentionedPlace {
  name: string;
  location?: string;
  placeType?: string;
  sentiment: 'love' | 'like' | 'visited' | 'dislike';
  confidence: number;
  context?: string;
}

/** Resolved property anchor — a mentioned place matched to a real PlaceIntelligence record */
export interface PropertyAnchor {
  googlePlaceId: string;
  propertyName: string;
  placeType?: string;
  sentiment: 'love' | 'like' | 'visited' | 'dislike';
  /** Blend weight for vector computation: positive pulls toward, negative pushes away */
  blendWeight: number;
  /** Source phase where this anchor was mentioned */
  sourcePhaseId?: string;
  /** Whether the property has a computed embedding we can use */
  hasEmbedding: boolean;
  resolvedAt: string; // ISO timestamp
}

// ─── Taste Structure (Richer Structured Data) ────────────────────────────────

/** Per-domain coverage and signal summary — computed from vector analysis */
export interface DomainTasteProfile {
  /** Coverage ratio: fraction of domain clusters activated (0-1) */
  coverage: number;
  /** Top signals by confidence in this domain */
  strongestSignals: string[];
  /** Cluster names with low/zero activation — candidates for gap-fill */
  weakestAreas: string[];
  /** Anti-signals / rejections in this domain */
  rejections: string[];
}

/**
 * Rich structured representation of a user's taste preferences.
 * Stored alongside the vector for non-vector features:
 *   - Taste explanations ("You love raw concrete and natural materials")
 *   - Recommendation explanations ("This matches your Setting preferences")
 *   - Taste evolution tracking over time
 *   - Gap-fill guidance during onboarding
 */
export interface TasteStructure {
  /** Per-domain summary */
  domains: Record<string, DomainTasteProfile>;
  /** Radar-derived domain priority weights (normalized 0-1) */
  domainPriorities: Record<string, number>;
  /** Anchor properties with resolved data */
  anchorProperties: Array<{
    googlePlaceId: string;
    name: string;
    sentiment: string;
    /** Which domains this property's embedding covers */
    domains: string[];
    /** How many clusters this anchor activated */
    activatedClusters: number;
  }>;
  /** Weighted mean of domain coverages (0-1) */
  overallConfidence: number;
  /** Domains still below the gap threshold */
  gapDomains: string[];
  /** When this structure was last computed */
  computedAt: string;
}

/** A real property exemplifying a taste domain — used for gap-fill reaction cards */
export interface PropertyExemplar {
  googlePlaceId: string;
  propertyName: string;
  placeType: string | null;
  locationHint: string | null;
  /** Cosine similarity to domain probe vector */
  domainScore: number;
}

/** Result of the domain gap check — coverage analysis + exemplar properties */
export interface DomainGapCheckResult {
  coverage: {
    domains: Array<{
      domain: string;
      totalClusters: number;
      activatedClusters: number;
      coverage: number;
      meanActivation: number;
    }>;
    overallCoverage: number;
    gapDomains: string[];
    totalActivated: number;
  };
  exemplars: Record<string, PropertyExemplar[]>;
}
