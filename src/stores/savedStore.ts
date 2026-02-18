import { create } from 'zustand';
import { ImportedPlace, PlaceRating, PlaceType, GhostSourceType, GooglePlaceData } from '@/types';
import {
  DEMO_MY_PLACES as IMPORTED_MY_PLACES,
  DEMO_HISTORY as IMPORTED_HISTORY,
  DEMO_COLLECTIONS as IMPORTED_COLLECTIONS,
  DEMO_FRIEND_RECS as IMPORTED_FRIEND_RECS,
} from '@/data/demoSaved';

export type ViewMode = 'myPlaces' | 'history';

export interface HistoryItem {
  id: string;
  name: string;
  type: PlaceType;
  location: string;
  detectedFrom: 'OpenTable' | 'Resy' | 'Hotels.com';
  detectedDate: string;
  ghostSource: GhostSourceType;
  rating?: PlaceRating;
  google?: GooglePlaceData;
}

export interface Collection {
  id: string;
  name: string;
  count: number;
  emoji: string;
  isSmartCollection: boolean;
  query?: string;
  filterTags?: string[];
}

// NOTE: All demo data lives in @/data/demoSaved.ts (imported above)

const _LEGACY_MY_PLACES: ImportedPlace[] = [
  {
    id: 'place-1',
    name: 'Sukiyabashi Jiro',
    type: 'restaurant',
    location: 'Tokyo',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 92,
    matchBreakdown: { Design: 0.7, Character: 0.95, Service: 0.98, Food: 0.99, Location: 0.6, Wellness: 0.3 },
    tasteNote: 'Legendary omakase',
    google: { rating: 4.4, reviewCount: 1247, category: 'Sushi Restaurant', priceLevel: 4 },
    enrichment: { closedDays: ['Monday'], confidence: 0.94 },
    terrazzoInsight: { why: 'Peak craftsmanship in every detail', caveat: 'Reservations required months ahead' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'myPlace', ratedAt: '2025-02-10' },
  },
  {
    id: 'place-2',
    name: 'TeamLab Borderless',
    type: 'museum',
    location: 'Tokyo',
    source: { type: 'text', name: "Sarah's List" },
    matchScore: 85,
    matchBreakdown: { Design: 0.98, Character: 0.8, Service: 0.5, Food: 0.1, Location: 0.7, Wellness: 0.6 },
    tasteNote: 'Immersive digital art',
    google: { rating: 4.5, reviewCount: 8932, category: 'Art Museum' },
    terrazzoInsight: { why: 'Boundary-dissolving immersive spaces', caveat: 'Book timed entry in advance' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Sarah L.', note: 'The infinity room will melt your brain' },
  },
  {
    id: 'place-3',
    name: 'Narisawa',
    type: 'restaurant',
    location: 'Tokyo',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 88,
    matchBreakdown: { Design: 0.85, Character: 0.9, Service: 0.95, Food: 0.95, Location: 0.5, Wellness: 0.7 },
    tasteNote: 'Forest-to-table fine dining',
    google: { rating: 4.6, reviewCount: 2103, category: 'French Restaurant', priceLevel: 4 },
    terrazzoInsight: { why: 'Two Michelin stars for a reason', caveat: 'Book 2-3 months ahead' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'enjoyed', ratedAt: '2025-02-09' },
  },
  {
    id: 'place-4',
    name: 'Le Comptoir du Panthéon',
    type: 'restaurant',
    location: 'Paris',
    source: { type: 'email', name: 'Gmail' },
    matchScore: 79,
    matchBreakdown: { Design: 0.6, Character: 0.85, Service: 0.8, Food: 0.9, Location: 0.75, Wellness: 0.4 },
    tasteNote: 'Classic bistro with soul',
    google: { rating: 4.3, reviewCount: 562, category: 'French Restaurant', priceLevel: 2 },
    terrazzoInsight: { why: 'Authentic Parisian charm', caveat: 'Can be crowded on weekends' },
    status: 'available',
    ghostSource: 'email',
  },
  {
    id: 'place-5',
    name: 'Musée de l\'Orangerie',
    type: 'museum',
    location: 'Paris',
    source: { type: 'url', name: 'Artsy' },
    matchScore: 87,
    matchBreakdown: { Design: 0.95, Character: 0.7, Service: 0.6, Food: 0.2, Location: 0.9, Wellness: 0.5 },
    tasteNote: 'Monet\'s waterlilies sanctuary',
    google: { rating: 4.6, reviewCount: 4521, category: 'Art Museum' },
    terrazzoInsight: { why: 'Pure visual transcendence', caveat: 'Early morning recommended' },
    status: 'available',
    ghostSource: 'article',
  },
  {
    id: 'place-6',
    name: 'Harry\'s Bar',
    type: 'bar',
    location: 'Venice',
    source: { type: 'google-maps', name: 'Google Maps' },
    matchScore: 81,
    matchBreakdown: { Design: 0.7, Character: 0.95, Service: 0.9, Food: 0.5, Location: 0.85, Wellness: 0.3 },
    tasteNote: 'Cocktails and Old World glamour',
    google: { rating: 4.4, reviewCount: 1823, category: 'Cocktail Bar' },
    terrazzoInsight: { why: 'Home of the Bellini', caveat: 'Expensive but worth it' },
    status: 'available',
    ghostSource: 'maps',
    savedDate: 'Saved Dec 2024',
  },
  {
    id: 'place-7',
    name: 'Café Florian',
    type: 'cafe',
    location: 'Venice',
    source: { type: 'text', name: "Marco's Tips" },
    matchScore: 76,
    matchBreakdown: { Design: 0.85, Character: 0.88, Service: 0.75, Food: 0.6, Location: 0.95, Wellness: 0.4 },
    tasteNote: 'Historic coffee in San Marco Square',
    google: { rating: 4.2, reviewCount: 3456, category: 'Café' },
    terrazzoInsight: { why: 'Operating since 1720', caveat: 'Tourist prices, but the ambiance is real' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Marco', note: 'Best people-watching in Venice' },
  },
  {
    id: 'place-8',
    name: 'Gramercy Tavern',
    type: 'bar',
    location: 'New York',
    source: { type: 'url', name: 'Eater NY' },
    matchScore: 84,
    matchBreakdown: { Design: 0.8, Character: 0.9, Service: 0.95, Food: 0.7, Location: 0.8, Wellness: 0.2 },
    tasteNote: 'Historic New York tavern',
    google: { rating: 4.5, reviewCount: 2341, category: 'Tavern' },
    terrazzoInsight: { why: 'Since 1834 with cocktail mastery', caveat: 'Tavern section is casual, Dining Room is formal' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'enjoyed', ratedAt: '2025-02-05' },
  },
  {
    id: 'place-9',
    name: 'The Metropolitan Museum of Art',
    type: 'museum',
    location: 'New York',
    source: { type: 'google-maps', name: 'Google Maps' },
    matchScore: 90,
    matchBreakdown: { Design: 0.95, Character: 0.85, Service: 0.7, Food: 0.4, Location: 0.9, Wellness: 0.6 },
    tasteNote: 'The world in one building',
    google: { rating: 4.7, reviewCount: 12450, category: 'Art Museum' },
    terrazzoInsight: { why: 'Incomparable breadth and depth', caveat: 'Requires multiple visits' },
    status: 'available',
    ghostSource: 'maps',
    savedDate: 'Saved Jan 2025',
  },
  {
    id: 'place-10',
    name: 'The National Gallery',
    type: 'museum',
    location: 'London',
    source: { type: 'email', name: 'Gmail' },
    matchScore: 86,
    matchBreakdown: { Design: 0.92, Character: 0.75, Service: 0.65, Food: 0.3, Location: 0.85, Wellness: 0.5 },
    tasteNote: 'Old Masters in free admission',
    google: { rating: 4.6, reviewCount: 5634, category: 'Art Museum' },
    terrazzoInsight: { why: 'Vermeer, Caravaggio, Turner', caveat: 'Can be crowded, go early' },
    status: 'available',
    ghostSource: 'email',
  },
  {
    id: 'place-11',
    name: 'Rules Restaurant',
    type: 'restaurant',
    location: 'London',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 80,
    matchBreakdown: { Design: 0.75, Character: 0.92, Service: 0.88, Food: 0.85, Location: 0.7, Wellness: 0.3 },
    tasteNote: 'London\'s oldest restaurant since 1798',
    google: { rating: 4.4, reviewCount: 1205, category: 'British Restaurant', priceLevel: 3 },
    terrazzoInsight: { why: 'Proper British dining with history', caveat: 'Jacket recommended' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'mixed', ratedAt: '2025-01-30' },
  },
  {
    id: 'place-12',
    name: 'Masseria Torre Coccaro',
    type: 'hotel',
    location: 'Puglia',
    source: { type: 'text', name: 'Summer Recs' },
    matchScore: 93,
    matchBreakdown: { Design: 0.95, Character: 0.9, Service: 0.92, Food: 0.88, Location: 0.95, Wellness: 0.95 },
    tasteNote: 'Centuries-old fortified farmstead',
    google: { rating: 4.7, reviewCount: 876, category: 'Luxury Resort' },
    terrazzoInsight: { why: 'Puglia captured in one property', caveat: 'Book far in advance' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Emma', note: 'The olive grove views at sunset are unreal' },
    rating: { reaction: 'myPlace', ratedAt: '2025-02-01' },
  },
  {
    id: 'place-13',
    name: 'Oaxen Krog',
    type: 'restaurant',
    location: 'Djurgården, Stockholm',
    source: { type: 'url', name: 'Eater' },
    matchScore: 91,
    matchBreakdown: { Design: 0.95, Character: 0.88, Service: 0.92, Food: 0.97, Location: 0.85, Wellness: 0.6 },
    tasteNote: 'New Nordic tasting menus on the waterfront',
    google: { rating: 4.7, reviewCount: 1580, category: 'Fine Dining', priceLevel: 4 },
    terrazzoInsight: { why: 'Stockholm\'s crown jewel — two Michelin stars with harbor views', caveat: 'Book 3 weeks ahead minimum' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'myPlace', ratedAt: '2025-02-12' },
  },
  {
    id: 'place-14',
    name: 'Fotografiska',
    type: 'museum',
    location: 'Södermalm, Stockholm',
    source: { type: 'text', name: "Sarah's List" },
    matchScore: 87,
    matchBreakdown: { Design: 0.92, Character: 0.85, Service: 0.7, Food: 0.5, Location: 0.88, Wellness: 0.55 },
    tasteNote: 'Photography museum with a killer rooftop bar',
    google: { rating: 4.5, reviewCount: 6230, category: 'Photography Museum' },
    terrazzoInsight: { why: 'World-class rotating exhibitions in a waterfront art deco building', caveat: 'The restaurant is great too — reserve separately' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Sarah L.', note: 'Go for the art, stay for the rooftop views' },
    rating: { reaction: 'myPlace', ratedAt: '2025-02-11' },
  },
  {
    id: 'place-15',
    name: 'Woodstockholm',
    type: 'restaurant',
    location: 'Mosebacke, Stockholm',
    source: { type: 'url', name: 'Bon Appétit' },
    matchScore: 84,
    matchBreakdown: { Design: 0.88, Character: 0.9, Service: 0.82, Food: 0.9, Location: 0.75, Wellness: 0.65 },
    tasteNote: 'Farm-to-table in a cozy wooden cabin vibe',
    google: { rating: 4.4, reviewCount: 890, category: 'Swedish Restaurant', priceLevel: 3 },
    terrazzoInsight: { why: 'Södermalm\'s best kept secret — seasonal menus with zero pretension', caveat: 'Small space, book ahead' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'myPlace', ratedAt: '2025-02-10' },
  },
  {
    id: 'place-16',
    name: 'Noma',
    type: 'restaurant',
    location: 'Refshalevej, Copenhagen',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 96,
    matchBreakdown: { Design: 0.98, Character: 0.95, Service: 0.97, Food: 0.99, Location: 0.7, Wellness: 0.65 },
    tasteNote: 'The restaurant that redefined Nordic cuisine',
    google: { rating: 4.8, reviewCount: 3420, category: 'Fine Dining', priceLevel: 4 },
    terrazzoInsight: { why: 'A once-in-a-lifetime culinary pilgrimage', caveat: 'Now a food lab — check current format' },
    status: 'available',
    ghostSource: 'article',
    rating: { reaction: 'myPlace', ratedAt: '2025-02-08' },
  },
  {
    id: 'place-17',
    name: 'Mikkeller Bar',
    type: 'bar',
    location: 'Vesterbro, Copenhagen',
    source: { type: 'google-maps', name: 'Google Maps' },
    matchScore: 78,
    matchBreakdown: { Design: 0.75, Character: 0.88, Service: 0.72, Food: 0.4, Location: 0.82, Wellness: 0.25 },
    tasteNote: 'Craft beer heaven in Vesterbro',
    google: { rating: 4.3, reviewCount: 2150, category: 'Craft Beer Bar' },
    terrazzoInsight: { why: 'Rotating 40-tap lineup from one of the world\'s best microbreweries', caveat: 'Gets packed weekends — go early' },
    status: 'available',
    ghostSource: 'maps',
    savedDate: 'Saved Jan 2025',
    rating: { reaction: 'myPlace', ratedAt: '2025-02-07' },
  },
  {
    id: 'place-18',
    name: 'Louisiana Museum',
    type: 'museum',
    location: 'Humlebæk, Copenhagen',
    source: { type: 'email', name: 'Gmail' },
    matchScore: 93,
    matchBreakdown: { Design: 0.98, Character: 0.88, Service: 0.7, Food: 0.45, Location: 0.95, Wellness: 0.8 },
    tasteNote: 'Modern art meets Nordic landscape',
    google: { rating: 4.7, reviewCount: 7890, category: 'Art Museum' },
    terrazzoInsight: { why: 'Architecture, sculpture gardens, and sea views — transcendent', caveat: '35 min train from central Copenhagen' },
    status: 'available',
    ghostSource: 'email',
    rating: { reaction: 'myPlace', ratedAt: '2025-02-06' },
  },
];

// Demo History Items — matching wireframe style with specific dates
const DEMO_HISTORY: HistoryItem[] = [
  {
    id: 'hist-1',
    name: 'Via Carota',
    type: 'restaurant',
    location: 'New York',
    detectedFrom: 'OpenTable',
    detectedDate: 'Feb 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-2',
    name: 'Attaboy',
    type: 'bar',
    location: 'New York',
    detectedFrom: 'Resy',
    detectedDate: 'Feb 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-3',
    name: 'Dhamaka',
    type: 'restaurant',
    location: 'New York',
    detectedFrom: 'Resy',
    detectedDate: 'Feb 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-4',
    name: 'Tatiana',
    type: 'restaurant',
    location: 'New York',
    detectedFrom: 'Resy',
    detectedDate: 'Jan 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-5',
    name: 'The Ned NoMad',
    type: 'hotel',
    location: 'New York',
    detectedFrom: 'Hotels.com',
    detectedDate: 'Jan 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-6',
    name: 'Don Angie',
    type: 'restaurant',
    location: 'New York',
    detectedFrom: 'OpenTable',
    detectedDate: 'Jan 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-7',
    name: 'Brooklyn Mirage',
    type: 'activity',
    location: 'New York',
    detectedFrom: 'Resy',
    detectedDate: 'Jan 2026',
    ghostSource: 'email',
  },
  {
    id: 'hist-8',
    name: 'Eleven Madison Park',
    type: 'restaurant',
    location: 'New York',
    detectedFrom: 'OpenTable',
    detectedDate: 'Dec 2025',
    ghostSource: 'email',
  },
  {
    id: 'hist-9',
    name: 'Carbone',
    type: 'restaurant',
    location: 'New York',
    detectedFrom: 'Resy',
    detectedDate: 'Dec 2025',
    ghostSource: 'email',
  },
  {
    id: 'hist-10',
    name: 'Mandarin Oriental',
    type: 'hotel',
    location: 'Tokyo',
    detectedFrom: 'Hotels.com',
    detectedDate: 'Nov 2025',
    ghostSource: 'email',
  },
];

// Demo Collections
const DEMO_COLLECTIONS: Collection[] = [
  {
    id: 'col-1',
    name: 'Favorite hotels in Europe',
    count: 6,
    emoji: '🏨',
    isSmartCollection: true,
    query: 'favorite hotels in Europe',
    filterTags: ['type: hotel', 'location: Europe', 'reaction: ♡'],
  },
  {
    id: 'col-2',
    name: 'Everything Sarah recommended',
    count: 9,
    emoji: '👤',
    isSmartCollection: true,
    query: 'everything Sarah recommended',
    filterTags: ['source: friend', 'person: Sarah'],
  },
  {
    id: 'col-3',
    name: 'Tokyo research',
    count: 14,
    emoji: '🗼',
    isSmartCollection: false,
    query: 'Tokyo research',
    filterTags: ['location: Tokyo'],
  },
];

interface SavedState {
  viewMode: ViewMode;
  typeFilter: PlaceType | 'all';
  searchQuery: string;
  myPlaces: ImportedPlace[];
  history: HistoryItem[];
  collections: Collection[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setTypeFilter: (filter: PlaceType | 'all') => void;
  setSearchQuery: (query: string) => void;
  addPlace: (place: ImportedPlace) => void;
  removePlace: (id: string) => void;
  ratePlace: (id: string, rating: PlaceRating) => void;
  toggleStar: (id: string) => void;
  promoteFromHistory: (id: string) => void;
  archiveToHistory: (id: string) => void;
  addHistoryItems: (items: HistoryItem[]) => void;
  addCollection: (collection: Omit<Collection, 'id'>) => void;
}

export const useSavedStore = create<SavedState>((set) => ({
  viewMode: 'myPlaces',
  typeFilter: 'all',
  searchQuery: '',
  myPlaces: [...IMPORTED_MY_PLACES, ...IMPORTED_FRIEND_RECS],
  history: IMPORTED_HISTORY,
  collections: IMPORTED_COLLECTIONS,

  setViewMode: (mode) => set({ viewMode: mode }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  addPlace: (place) => set((state) => ({
    myPlaces: [place, ...state.myPlaces],
  })),

  removePlace: (id) => set((state) => ({
    myPlaces: state.myPlaces.filter((p) => p.id !== id),
  })),

  ratePlace: (id, rating) => set((state) => ({
    myPlaces: state.myPlaces.map((p) =>
      p.id === id ? { ...p, rating } : p
    ),
  })),

  toggleStar: (id) => set((state) => ({
    myPlaces: state.myPlaces.map((p) => {
      if (p.id !== id) return p;
      const isStarred = p.rating?.reaction === 'myPlace';
      if (isStarred) {
        // Unstar: remove rating
        const { rating: _removed, ...rest } = p;
        void _removed;
        return rest as ImportedPlace;
      }
      // Star: set reaction to myPlace
      return { ...p, rating: { reaction: 'myPlace' as const, ratedAt: new Date().toISOString().split('T')[0] } };
    }),
  })),

  promoteFromHistory: (id) => set((state) => {
    const histItem = state.history.find((h) => h.id === id);
    if (!histItem) return state;

    const newPlace: ImportedPlace = {
      id: `promoted-${id}`,
      name: histItem.name,
      type: histItem.type,
      location: histItem.location,
      source: { type: 'email', name: `Promoted from ${histItem.detectedFrom}` },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: '',
      status: 'available',
      ghostSource: 'manual',
    };

    return {
      myPlaces: [newPlace, ...state.myPlaces],
      history: state.history.filter((h) => h.id !== id),
    };
  }),

  archiveToHistory: (id) => set((state) => {
    const place = state.myPlaces.find((p) => p.id === id);
    if (!place) return state;

    const historyItem: HistoryItem = {
      id: `hist-archived-${id}`,
      name: place.name,
      type: place.type,
      location: place.location,
      detectedFrom: (place.source?.name as HistoryItem['detectedFrom']) || 'OpenTable',
      detectedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      ghostSource: place.ghostSource || 'manual',
    };

    return {
      myPlaces: state.myPlaces.filter((p) => p.id !== id),
      history: [historyItem, ...state.history],
    };
  }),

  addHistoryItems: (items) => set((state) => {
    // Dedupe by name
    const existingNames = new Set(state.history.map(h => h.name.toLowerCase()));
    const newItems = items.filter(item => !existingNames.has(item.name.toLowerCase()));
    return {
      history: [...newItems, ...state.history],
    };
  }),

  addCollection: (collection) => set((state) => {
    const newId = `col-${Date.now()}`;
    return {
      collections: [{ ...collection, id: newId }, ...state.collections],
    };
  }),
}));
