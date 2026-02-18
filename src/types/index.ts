import type { PerriandIconName } from '../components/icons/PerriandIcons';

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
  cream: '#f8f3ea',
  signalRed: '#d63020',
  chromeYellow: '#eeb420',
  linen: '#ede6d8',
  ghost: '#6b8b9a',
} as const;

export const DOMAIN_COLORS: Record<TasteDomain, string> = {
  Design: '#d63020',
  Character: '#6844a0',
  Service: '#a06c28',
  Food: '#e87080',
  Location: '#2a7a56',
  Wellness: '#eeb420',
};

export const DOMAIN_ICONS: Record<TasteDomain, PerriandIconName> = {
  Design: 'design',
  Character: 'character',
  Food: 'food',
  Location: 'location',
  Service: 'service',
  Wellness: 'wellness',
};

// Rating system
export const RATING_COLORS = {
  myPlace: '#2a7a56',
  enjoyed: '#c8923a',
  mixed: '#eeb420',
  notMe: '#d63020',
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
  email: { color: '#6b8b9a', bg: 'rgba(107,139,154,0.06)', icon: 'email', label: 'Email' },
  friend: { color: '#2a7a56', bg: 'rgba(42,122,86,0.06)', icon: 'friend', label: 'Friend' },
  terrazzo: { color: '#6b8b9a', bg: 'rgba(107,139,154,0.06)', icon: 'terrazzo', label: 'Terrazzo pick' },
  maps: { color: '#e86830', bg: 'rgba(232,104,48,0.06)', icon: 'maps', label: 'Google Maps' },
  article: { color: '#c8923a', bg: 'rgba(200,146,58,0.06)', icon: 'article', label: 'Article' },
  manual: { color: '#1c1a17', bg: 'rgba(28,26,23,0.04)', icon: 'manual', label: 'Added' },
};

export type TasteDomain = 'Design' | 'Character' | 'Service' | 'Food' | 'Location' | 'Wellness';

export type TasteProfile = Record<TasteDomain, number>;

export type PlaceType = 'restaurant' | 'museum' | 'activity' | 'hotel' | 'neighborhood' | 'bar' | 'cafe' | 'shop';

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

export interface GooglePlaceData {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  priceLevel?: number;
  hours?: string[];
  photoUrl?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface PlaceEnrichment {
  closedDays?: string[];
  hours?: string;
  seasonalNote?: string;
  priceRange?: string;
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
  savedDate?: string; // for Maps imports: "Saved Jun 2024"
  rating?: PlaceRating; // user's personal rating
  // Enriched card fields (from import briefing)
  whatToOrder?: string[];  // e.g. ["Puntillas ★", "Gambas de la santa"]
  tips?: string[];         // e.g. ["⏰ Go early (can be a wait)", "🍺 Drink at the bar while waiting"]
  alsoKnownAs?: string;   // e.g. "El Sótano"
  importBatchId?: string;  // links places from same import for "Also from this guide"
  isShortlisted?: boolean; // true = show in PicksStrip for day planner drag-drop
}

export interface TimeSlot {
  id: string;
  label: string;
  time: string;
  places: ImportedPlace[];      // confirmed places (supports multiple per slot)
  ghostItems?: ImportedPlace[]; // proposed items (ghost cards) for this slot
}

export interface TripDay {
  dayNumber: number;
  date?: string;
  dayOfWeek?: string;
  destination?: string; // city name for multi-destination trips
  hotel?: string;
  slots: TimeSlot[];
}

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
  days: TripDay[];
  pool: ImportedPlace[];
}

// Rating system types
export type ReactionId = 'myPlace' | 'enjoyed' | 'mixed' | 'notMe';
export type ReturnIntent = 'absolutely' | 'maybe' | 'probably_not';

export interface PlaceRating {
  reaction: ReactionId;
  tags?: string[];           // "What stood out?" dimensional tags
  contextTags?: string[];    // "Perfect for..." tags
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
  startDate: string; // ISO date
  endDate: string;   // ISO date
  travelContext: TravelContext;
  groupSize?: number; // for friends/family
  status: TripStatus;
}

export interface AISuggestion {
  item: ImportedPlace;
  rationale: string;
  alternativeCount: number;
  isStretch: boolean;
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

// ─── Pipeline Briefing Types ───

export const DIMENSION_TO_DOMAIN: Record<string, TasteDomain> = {
  'Design Language': 'Design',
  'Character & Identity': 'Character',
  'Service Philosophy': 'Service',
  'Food & Drink Identity': 'Food',
  'Location & Context': 'Location',
  'Wellness & Body': 'Wellness',
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
  { key: 'google_places', label: 'Places' },
  { key: 'scrape_reviews', label: 'Reviews' },
  { key: 'editorial_extraction', label: 'Editorial' },
  { key: 'instagram_analysis', label: 'Instagram' },
  { key: 'menu_analysis', label: 'Menu' },
  { key: 'award_positioning', label: 'Awards' },
  { key: 'review_insights', label: 'Insights' },
  { key: 'merge', label: 'Compose' },
  { key: 'save', label: 'Done' },
] as const;
