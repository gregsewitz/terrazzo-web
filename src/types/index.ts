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

export const DOMAIN_ICONS: Record<TasteDomain, string> = {
  Design: '✦',
  Character: '◈',
  Food: '◉',
  Location: '◎',
  Service: '◆',
  Wellness: '○',
};

// Rating system
export const RATING_COLORS = {
  myPlace: '#2a7a56',
  enjoyed: '#c8923a',
  mixed: '#eeb420',
  notMe: '#d63020',
} as const;

export const REACTIONS = [
  { id: 'myPlace', icon: '♡', label: 'My place', color: RATING_COLORS.myPlace },
  { id: 'enjoyed', icon: '✓', label: 'Enjoyed it', color: RATING_COLORS.enjoyed },
  { id: 'mixed', icon: '↔', label: 'Mixed', color: RATING_COLORS.mixed },
  { id: 'notMe', icon: '✗', label: 'Not me', color: RATING_COLORS.notMe },
] as const;

// Destination colors (for multi-city trips)
export const DEST_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  Tokyo: { bg: '#edf1f5', accent: '#5a7a9a', text: '#3a5a7a' },
  Hakone: { bg: '#f0ede8', accent: '#9a7a5a', text: '#7a5a3a' },
  Kyoto: { bg: '#edf5ef', accent: '#5a9a6a', text: '#3a7a4a' },
  Osaka: { bg: '#f5ede8', accent: '#c87a4a', text: '#a85a2a' },
};

// Ghost card source types — each source gets its own visual treatment
export const SOURCE_STYLES: Record<GhostSourceType, { color: string; bg: string; icon: string; label: string }> = {
  email: { color: '#6b8b9a', bg: 'rgba(107,139,154,0.06)', icon: '✉', label: 'Email' },
  friend: { color: '#2a7a56', bg: 'rgba(42,122,86,0.06)', icon: '👤', label: 'Friend' },
  ai: { color: '#6b8b9a', bg: 'rgba(107,139,154,0.06)', icon: '✦', label: 'AI suggestion' },
  maps: { color: '#e86830', bg: 'rgba(232,104,48,0.06)', icon: '📍', label: 'Google Maps' },
  article: { color: '#c8923a', bg: 'rgba(200,146,58,0.06)', icon: '📰', label: 'Article' },
  manual: { color: '#1c1a17', bg: 'rgba(28,26,23,0.04)', icon: '✎', label: 'Added' },
};

export type TasteDomain = 'Design' | 'Character' | 'Service' | 'Food' | 'Location' | 'Wellness';

export type TasteProfile = Record<TasteDomain, number>;

export type PlaceType = 'restaurant' | 'museum' | 'activity' | 'hotel' | 'neighborhood' | 'bar' | 'cafe' | 'shop';

export type ImportSourceType = 'url' | 'text' | 'google-maps' | 'email' | 'friend-list';

export type GhostSourceType = 'email' | 'friend' | 'ai' | 'maps' | 'article' | 'manual';

export type PlaceStatus = 'available' | 'placed' | 'rejected';

// Ghost card status for items that are proposed but not confirmed
export type GhostStatus = 'proposed' | 'confirmed' | 'dismissed';

export interface ImportSource {
  type: ImportSourceType;
  name: string;
  url?: string;
}

export interface GooglePlaceData {
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

// AI reasoning for AI-suggested places
export interface AIReasoning {
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
  aiReasoning?: AIReasoning;
  savedDate?: string; // for Maps imports: "Saved Jun 2024"
  rating?: PlaceRating; // user's personal rating
}

export interface TimeSlot {
  id: string;
  label: string;
  time: string;
  place?: ImportedPlace;
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

export interface AISuggestion {
  item: ImportedPlace;
  rationale: string;
  alternativeCount: number;
  isStretch: boolean;
}

// Default time slots for a day — updated to match Enhanced Slot Grid
export const DEFAULT_TIME_SLOTS: Omit<TimeSlot, 'place' | 'ghostItems'>[] = [
  { id: 'breakfast', label: 'Breakfast', time: '8:00 AM' },
  { id: 'morning', label: 'Morning', time: '10:00 AM' },
  { id: 'lunch', label: 'Lunch', time: '12:30 PM' },
  { id: 'afternoon', label: 'Afternoon', time: '2:30 PM' },
  { id: 'dinner', label: 'Dinner', time: '7:00 PM' },
  { id: 'evening', label: 'Evening', time: '9:30 PM' },
];

export const SLOT_ICONS: Record<string, string> = {
  breakfast: '☕',
  morning: '☀',
  lunch: '🍽',
  afternoon: '◑',
  dinner: '🌙',
  evening: '🍷',
};

// Terrazzo voice — used across all AI prompts for consistent tone
export const TERRAZZO_VOICE = `You write like a well-traveled friend who happens to have incredible taste — warm but not gushing, opinionated but never snobby. You use short, vivid descriptions. You notice the details that matter (the way light hits a courtyard, the specific dish to order, the hour when a place transforms). You're honest about trade-offs. You never say "hidden gem" or "must-visit." You speak like someone sharing a personal recommendation over wine, not writing a guidebook.`;
