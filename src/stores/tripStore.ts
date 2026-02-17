import { create } from 'zustand';
import { Trip, ImportedPlace, TripDay, DEFAULT_TIME_SLOTS, PlaceRating } from '@/types';

// Demo data for Tokyo trip — enhanced with multi-source ghost cards
const DEMO_POOL: ImportedPlace[] = [
  {
    id: '1',
    name: 'Sukiyabashi Jiro',
    type: 'restaurant',
    location: 'Ginza, Tokyo',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 92,
    matchBreakdown: { Design: 0.7, Character: 0.95, Service: 0.98, Food: 0.99, Location: 0.6, Wellness: 0.3 },
    tasteNote: 'Legendary omakase — peak craftsmanship',
    google: { rating: 4.4, reviewCount: 1247, category: 'Sushi Restaurant', priceLevel: 4 },
    enrichment: { closedDays: ['Monday'], confidence: 0.94 },
    terrazzoInsight: { why: 'Your Service and Food axes light up here — meticulous 20-course omakase from the master himself.', caveat: 'Closed Mondays. Reservation required months ahead. Cash only.' },
    status: 'available',
    ghostSource: 'article',
  },
  {
    id: '2',
    name: 'TeamLab Borderless',
    type: 'museum',
    location: 'Azabudai Hills, Tokyo',
    source: { type: 'text', name: "Sarah's List" },
    matchScore: 85,
    matchBreakdown: { Design: 0.98, Character: 0.8, Service: 0.5, Food: 0.1, Location: 0.7, Wellness: 0.6 },
    tasteNote: 'Immersive digital art — boundary-dissolving spaces',
    google: { rating: 4.5, reviewCount: 8932, category: 'Art Museum' },
    terrazzoInsight: { why: 'Your Design axis peaks here — the most ambitious immersive art installation in the world.', caveat: 'Can get very crowded. Book timed entry. Wear comfortable shoes.' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Sarah L.', note: 'The infinity room will melt your brain — allow 3 hours minimum' },
  },
  {
    id: '3',
    name: 'Narisawa',
    type: 'restaurant',
    location: 'Minato, Tokyo',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 88,
    matchBreakdown: { Design: 0.85, Character: 0.9, Service: 0.95, Food: 0.95, Location: 0.5, Wellness: 0.7 },
    tasteNote: 'Forest-to-table — nature meets fine dining',
    google: { rating: 4.6, reviewCount: 2103, category: 'French Restaurant', priceLevel: 4 },
    terrazzoInsight: { why: 'Strong across all your top axes — a forest-to-table philosophy that hits Design, Character, and Food.', caveat: 'Two Michelin stars means booking 2-3 months out. Jacket suggested.' },
    status: 'available',
    ghostSource: 'article',
  },
  {
    id: '4',
    name: 'Shimokitazawa',
    type: 'neighborhood',
    location: 'Setagaya, Tokyo',
    source: { type: 'text', name: "Sarah's List" },
    matchScore: 78,
    matchBreakdown: { Design: 0.6, Character: 0.95, Service: 0.3, Food: 0.7, Location: 0.9, Wellness: 0.5 },
    tasteNote: 'Bohemian vintage quarter — indie shops & tiny theatres',
    google: { rating: 4.3, reviewCount: 5621, category: 'Neighborhood' },
    terrazzoInsight: { why: 'Your Character axis will love the vintage stores, tiny theatres, and independent coffee scene.', caveat: 'No single anchor — best for aimless wandering. Half-day minimum.' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Sarah L.', note: 'Get lost here on purpose — the best thrift stores in all of Tokyo' },
  },
  {
    id: '5',
    name: 'Aman Tokyo',
    type: 'hotel',
    location: 'Otemachi, Tokyo',
    source: { type: 'email', name: 'Gmail' },
    matchScore: 95,
    matchBreakdown: { Design: 0.95, Character: 0.8, Service: 0.99, Food: 0.7, Location: 0.85, Wellness: 0.9 },
    tasteNote: 'Minimalist luxury — washi paper and camphor wood',
    google: { rating: 4.7, reviewCount: 892, category: 'Hotel', priceLevel: 4 },
    terrazzoInsight: { why: 'Near-perfect across your profile. The spatial design alone justifies the stay — Aman meets Tokyo.', caveat: 'Premium pricing. The spa is worth building a morning around.' },
    status: 'placed',
    placedIn: { day: 1, slot: 'morning' },
    ghostSource: 'email',
  },
  {
    id: '6',
    name: 'Yanaka District',
    type: 'neighborhood',
    location: 'Taito, Tokyo',
    source: { type: 'google-maps', name: 'Google Maps' },
    matchScore: 72,
    matchBreakdown: { Design: 0.5, Character: 0.9, Service: 0.2, Food: 0.6, Location: 0.95, Wellness: 0.4 },
    tasteNote: 'Old Tokyo charm — temples, cats, and craft studios',
    google: { rating: 4.4, reviewCount: 3201, category: 'Historic District' },
    terrazzoInsight: { why: 'High Location axis match — one of the few neighborhoods that survived the war, full of genuine texture.', caveat: 'Mostly outdoor walking. Some shops close early (4-5pm).' },
    status: 'available',
    ghostSource: 'maps',
    savedDate: 'Saved Oct 2024',
  },
  {
    id: '7',
    name: 'Den',
    type: 'restaurant',
    location: 'Jingumae, Tokyo',
    source: { type: 'url', name: 'YOLO Journal' },
    matchScore: 90,
    matchBreakdown: { Design: 0.8, Character: 0.95, Service: 0.9, Food: 0.95, Location: 0.6, Wellness: 0.4 },
    tasteNote: 'Playful kaiseki — Michelin irreverence',
    google: { rating: 4.7, reviewCount: 1567, category: 'Japanese Restaurant', priceLevel: 4 },
    terrazzoInsight: { why: 'Chef Zaiyu brings humor to kaiseki — your Character axis will love the "Dentucky Fried Chicken" course.', caveat: 'Extremely hard reservation. Try lunch for better availability.' },
    status: 'available',
    ghostSource: 'article',
  },
  {
    id: '8',
    name: 'Nezu Museum',
    type: 'museum',
    location: 'Minami-Aoyama, Tokyo',
    source: { type: 'google-maps', name: 'Google Maps' },
    matchScore: 82,
    matchBreakdown: { Design: 0.95, Character: 0.7, Service: 0.6, Food: 0.3, Location: 0.85, Wellness: 0.7 },
    tasteNote: 'Kengo Kuma garden — pre-modern art in modernist shell',
    google: { rating: 4.5, reviewCount: 2890, category: 'Art Museum' },
    terrazzoInsight: { why: 'Design axis highlight — Kengo Kuma\'s bamboo facade meets a stunning Japanese garden.', caveat: 'Allow 2 hours. The garden alone takes 45 minutes to properly enjoy.' },
    status: 'available',
    ghostSource: 'maps',
    savedDate: 'Saved Jun 2024',
  },
  {
    id: '9',
    name: 'Onsen Ryokan Experience',
    type: 'activity',
    location: 'Hakone (day trip)',
    source: { type: 'text', name: "Mike's Recs" },
    matchScore: 76,
    matchBreakdown: { Design: 0.6, Character: 0.7, Service: 0.8, Food: 0.5, Location: 0.7, Wellness: 0.99 },
    tasteNote: 'Volcanic mineral waters with mountain views',
    google: { rating: 4.6, reviewCount: 1543, category: 'Hot Spring' },
    terrazzoInsight: { why: 'Your Wellness axis peaks here — volcanic mineral waters with mountain views. Pure reset.', caveat: 'Full day commitment (90 min each way from Tokyo). Tattoo policies vary.' },
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Mike K.', note: 'Do the day trip — the private outdoor bath at Tenzan is life-changing' },
  },
  {
    id: '10',
    name: 'Tsukiji Outer Market',
    type: 'activity',
    location: 'Chuo, Tokyo',
    source: { type: 'url', name: 'CN Traveller' },
    matchScore: 74,
    matchBreakdown: { Design: 0.3, Character: 0.8, Service: 0.4, Food: 0.9, Location: 0.7, Wellness: 0.2 },
    tasteNote: 'Street food paradise — tamagoyaki, fresh uni, tuna at dawn',
    google: { rating: 4.3, reviewCount: 12450, category: 'Market' },
    terrazzoInsight: { why: 'Food axis highlight — tamagoyaki, fresh uni, and the best tuna in the world, all before 10am.', caveat: 'Go early (7-8am) or skip it — tourist crowds peak by 10am.' },
    status: 'available',
    ghostSource: 'article',
  },
];

// Ghost items that appear as proposals in specific time slots
const DAY_1_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [{
    ...DEMO_POOL[9], // Tsukiji
    id: 'ghost-tsukiji',
    ghostStatus: 'proposed',
    ghostSource: 'ai',
    aiReasoning: { rationale: 'Your Food axis + early morning = perfect Tsukiji window', confidence: 0.88 },
  }],
  morning: [],
  lunch: [{
    ...DEMO_POOL[0], // Sukiyabashi Jiro
    id: 'ghost-jiro',
    ghostStatus: 'proposed',
    ghostSource: 'article',
  }],
  afternoon: [{
    ...DEMO_POOL[1], // TeamLab
    id: 'ghost-teamlab',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Sarah L.', note: 'The infinity room will melt your brain — go afternoon, fewer crowds' },
  }],
  dinner: [{
    ...DEMO_POOL[6], // Den
    id: 'ghost-den',
    ghostStatus: 'proposed',
    ghostSource: 'article',
  }],
  evening: [],
};

const DAY_2_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [],
  morning: [{
    ...DEMO_POOL[7], // Nezu Museum
    id: 'ghost-nezu',
    ghostStatus: 'proposed',
    ghostSource: 'maps',
    savedDate: 'Saved Jun 2024',
  }],
  lunch: [],
  afternoon: [{
    ...DEMO_POOL[3], // Shimokitazawa
    id: 'ghost-shimokita',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Sarah L.', note: 'Get lost here on purpose — best thrift stores in Tokyo' },
  }],
  dinner: [{
    ...DEMO_POOL[2], // Narisawa
    id: 'ghost-narisawa',
    ghostStatus: 'proposed',
    ghostSource: 'article',
  }],
  evening: [],
};

const DAY_3_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [],
  morning: [{
    ...DEMO_POOL[5], // Yanaka
    id: 'ghost-yanaka',
    ghostStatus: 'proposed',
    ghostSource: 'maps',
    savedDate: 'Saved Oct 2024',
  }],
  lunch: [],
  afternoon: [],
  dinner: [],
  evening: [],
};

function createEnhancedDays(numDays: number, ghosts: Record<string, Record<string, ImportedPlace[]>> = {}): TripDay[] {
  const dayNames = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday'];
  const dates = ['Apr 10', 'Apr 11', 'Apr 12', 'Apr 13', 'Apr 14'];

  return Array.from({ length: numDays }, (_, i) => ({
    dayNumber: i + 1,
    date: dates[i] || `Apr ${10 + i}`,
    dayOfWeek: dayNames[i] || 'Day',
    destination: 'Tokyo',
    hotel: i < 3 ? 'Aman Tokyo' : i === 3 ? 'Hakone Retreat' : 'Aman Tokyo',
    slots: DEFAULT_TIME_SLOTS.map(s => ({
      ...s,
      place: undefined,
      ghostItems: ghosts[String(i + 1)]?.[s.id] || [],
    })),
  }));
}

const DEMO_TRIP: Trip = {
  id: 'demo-tokyo',
  name: 'Tokyo',
  location: 'Tokyo, Japan',
  startDate: '2026-04-10',
  endDate: '2026-04-14',
  destinations: ['Tokyo', 'Hakone'],
  days: createEnhancedDays(5, {
    '1': DAY_1_GHOSTS,
    '2': DAY_2_GHOSTS,
    '3': DAY_3_GHOSTS,
  }),
  pool: DEMO_POOL,
};

// Place the Aman into day 1 morning
DEMO_TRIP.days[0].slots[1].place = DEMO_POOL.find(p => p.id === '5');

interface TripState {
  trips: Trip[];
  currentTripId: string | null;
  currentDay: number;

  // Getters
  currentTrip: () => Trip | undefined;
  poolItems: () => ImportedPlace[];
  unsortedCount: () => number;

  // Actions
  setCurrentTrip: (id: string) => void;
  setCurrentDay: (day: number) => void;
  placeItem: (itemId: string, day: number, slotId: string) => void;
  removeFromSlot: (day: number, slotId: string) => void;
  addToPool: (items: ImportedPlace[]) => void;
  rejectItem: (itemId: string) => void;
  updateItemStatus: (itemId: string, status: ImportedPlace['status']) => void;
  confirmGhost: (dayNumber: number, slotId: string, ghostId: string) => void;
  dismissGhost: (dayNumber: number, slotId: string, ghostId: string) => void;
  ratePlace: (itemId: string, rating: PlaceRating) => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [DEMO_TRIP],
  currentTripId: 'demo-tokyo',
  currentDay: 1,

  currentTrip: () => {
    const state = get();
    return state.trips.find(t => t.id === state.currentTripId);
  },

  poolItems: () => {
    const trip = get().currentTrip();
    return trip?.pool.filter(p => p.status === 'available') ?? [];
  },

  unsortedCount: () => {
    const trip = get().currentTrip();
    return trip?.pool.filter(p => p.status === 'available').length ?? 0;
  },

  setCurrentTrip: (id) => set({ currentTripId: id }),
  setCurrentDay: (day) => set({ currentDay: day }),

  placeItem: (itemId, day, slotId) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      const item = trip.pool.find(p => p.id === itemId);
      if (!item) return trip;

      const updatedPool = trip.pool.map(p =>
        p.id === itemId ? { ...p, status: 'placed' as const, placedIn: { day, slot: slotId } } : p
      );
      const updatedDays = trip.days.map(d => {
        if (d.dayNumber !== day) return d;
        return {
          ...d,
          slots: d.slots.map(s => s.id === slotId ? { ...s, place: { ...item, status: 'placed' as const } } : s),
        };
      });
      return { ...trip, pool: updatedPool, days: updatedDays };
    });
    return { trips };
  }),

  removeFromSlot: (day, slotId) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      const dayObj = trip.days.find(d => d.dayNumber === day);
      const slot = dayObj?.slots.find(s => s.id === slotId);
      const placeId = slot?.place?.id;

      const updatedPool = placeId
        ? trip.pool.map(p => p.id === placeId ? { ...p, status: 'available' as const, placedIn: undefined } : p)
        : trip.pool;
      const updatedDays = trip.days.map(d => {
        if (d.dayNumber !== day) return d;
        return { ...d, slots: d.slots.map(s => s.id === slotId ? { ...s, place: undefined } : s) };
      });
      return { ...trip, pool: updatedPool, days: updatedDays };
    });
    return { trips };
  }),

  addToPool: (items) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      return { ...trip, pool: [...trip.pool, ...items] };
    });
    return { trips };
  }),

  rejectItem: (itemId) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      return { ...trip, pool: trip.pool.map(p => p.id === itemId ? { ...p, status: 'rejected' as const } : p) };
    });
    return { trips };
  }),

  updateItemStatus: (itemId, status) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      return { ...trip, pool: trip.pool.map(p => p.id === itemId ? { ...p, status } : p) };
    });
    return { trips };
  }),

  confirmGhost: (dayNumber, slotId, ghostId) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      const updatedDays = trip.days.map(d => {
        if (d.dayNumber !== dayNumber) return d;
        return {
          ...d,
          slots: d.slots.map(s => {
            if (s.id !== slotId) return s;
            const ghost = s.ghostItems?.find(g => g.id === ghostId);
            if (!ghost) return s;
            // Move ghost to confirmed place, remove from ghosts
            return {
              ...s,
              place: s.place || { ...ghost, ghostStatus: 'confirmed' as const, status: 'placed' as const },
              ghostItems: s.ghostItems?.filter(g => g.id !== ghostId),
            };
          }),
        };
      });
      return { ...trip, days: updatedDays };
    });
    return { trips };
  }),

  dismissGhost: (dayNumber, slotId, ghostId) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      const updatedDays = trip.days.map(d => {
        if (d.dayNumber !== dayNumber) return d;
        return {
          ...d,
          slots: d.slots.map(s => {
            if (s.id !== slotId) return s;
            return {
              ...s,
              ghostItems: s.ghostItems?.filter(g => g.id !== ghostId),
            };
          }),
        };
      });
      return { ...trip, days: updatedDays };
    });
    return { trips };
  }),

  ratePlace: (itemId, rating) => set(state => {
    const trips = state.trips.map(trip => {
      if (trip.id !== state.currentTripId) return trip;
      // Update in pool
      const pool = trip.pool.map(p => p.id === itemId ? { ...p, rating } : p);
      // Update in day slots (placed items and ghost items)
      const days = trip.days.map(d => ({
        ...d,
        slots: d.slots.map(s => ({
          ...s,
          place: s.place?.id === itemId ? { ...s.place, rating } : s.place,
          ghostItems: s.ghostItems?.map(g => g.id === itemId ? { ...g, rating } : g),
        })),
      }));
      return { ...trip, pool, days };
    });
    return { trips };
  }),
}));
