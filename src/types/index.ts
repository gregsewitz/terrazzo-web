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

export type TasteDomain = 'Design' | 'Character' | 'Service' | 'Food' | 'Location' | 'Wellness';

export type TasteProfile = Record<TasteDomain, number>;

export type PlaceType = 'restaurant' | 'museum' | 'activity' | 'hotel' | 'neighborhood' | 'bar' | 'cafe' | 'shop';

export type ImportSourceType = 'url' | 'text' | 'google-maps' | 'email' | 'friend-list';

export type PlaceStatus = 'available' | 'placed' | 'rejected';

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
}

export interface TimeSlot {
  id: string;
  label: string;
  time: string;
  place?: ImportedPlace;
}

export interface TripDay {
  dayNumber: number;
  date?: string;
  slots: TimeSlot[];
}

export interface Trip {
  id: string;
  name: string;
  location: string;
  startDate?: string;
  endDate?: string;
  days: TripDay[];
  pool: ImportedPlace[];
}

export interface AISuggestion {
  item: ImportedPlace;
  rationale: string;
  alternativeCount: number;
  isStretch: boolean;
}

// Default time slots for a day
export const DEFAULT_TIME_SLOTS: Omit<TimeSlot, 'place'>[] = [
  { id: 'morning', label: 'Morning', time: '9:00 AM' },
  { id: 'late-morning', label: 'Late Morning', time: '11:00 AM' },
  { id: 'lunch', label: 'Lunch', time: '12:30 PM' },
  { id: 'afternoon', label: 'Afternoon', time: '2:30 PM' },
  { id: 'dinner', label: 'Dinner', time: '7:00 PM' },
  { id: 'evening', label: 'Evening', time: '9:30 PM' },
];
