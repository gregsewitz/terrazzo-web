/**
 * Demo seed data for local development.
 * Provides one realistic trip and one collection with places
 * so styling can be verified without a server connection.
 *
 * To disable: set NEXT_PUBLIC_DEMO_DATA=false in .env.local
 */

import type { Trip, ImportedPlace, Collection } from '@/types';

// ═══════════════════════════════════════════
// Helper: create a minimal place
// ═══════════════════════════════════════════

function place(
  id: string,
  name: string,
  type: ImportedPlace['type'],
  location: string,
  opts: Partial<ImportedPlace> = {},
): ImportedPlace {
  return {
    id,
    name,
    type,
    location,
    source: { type: 'text', name: 'Demo' },
    matchScore: 0.85 + Math.random() * 0.12,
    matchBreakdown: {
      Design: 0.8, Atmosphere: 0.7, Character: 0.75,
      Service: 0.6, FoodDrink: 0.85, Setting: 0.7,
      Wellness: 0.5, Sustainability: 0.6,
    },
    tasteNote: '',
    status: 'placed',
    google: {
      placeId: `demo-${id}`,
      rating: 4.2 + Math.random() * 0.7,
      reviewCount: Math.floor(200 + Math.random() * 2000),
      category: type,
      photoUrl: undefined,
    },
    ...opts,
  };
}

// ═══════════════════════════════════════════
// Demo places
// ═══════════════════════════════════════════

const septime = place('demo-p1', 'Septime', 'restaurant', 'Paris, France', {
  tasteNote: 'Neo-bistro with a vegetable-forward tasting menu that feels like edible architecture.',
  matchScore: 0.94,
  google: { placeId: 'demo-septime', rating: 4.6, reviewCount: 3200, category: 'restaurant' },
  whatToOrder: ['Seasonal tasting menu', 'Natural wine pairing'],
  tips: ['Book 3 weeks ahead on the dot at midnight', 'Sister bar Septime La Cave next door for a pre-dinner glass'],
  accolades: [{ type: 'michelin', value: '1 Star', year: '2024' }],
});

const hotelGrandAmour = place('demo-p2', 'Hôtel Grand Amour', 'hotel', 'Paris, France', {
  tasteNote: 'André Saraiva\'s love letter to Parisian bohemia — art-filled, intimate, and effortlessly cool.',
  matchScore: 0.91,
  google: { placeId: 'demo-grandamour', rating: 4.4, reviewCount: 890, category: 'hotel' },
});

const lefMarais = place('demo-p3', 'Le Marais', 'neighborhood', 'Paris, France', {
  tasteNote: 'The best walking neighborhood in Paris — galleries, vintage shops, falafel, and medieval architecture.',
  matchScore: 0.88,
  status: 'available',
});

const clown = place('demo-p4', 'Clown Bar', 'bar', 'Paris, France', {
  tasteNote: 'Natural wine bar with a circus-themed Art Nouveau ceiling and inventive small plates.',
  matchScore: 0.89,
  google: { placeId: 'demo-clown', rating: 4.5, reviewCount: 1600, category: 'bar' },
  whatToOrder: ['Sea urchin crème brûlée', 'Whatever\'s open from the Jura'],
});

const museeDorsay = place('demo-p5', 'Musée d\'Orsay', 'museum', 'Paris, France', {
  tasteNote: 'Impressionist heaven in a converted train station — the building is as much art as the collection.',
  matchScore: 0.86,
  google: { placeId: 'demo-orsay', rating: 4.7, reviewCount: 45000, category: 'museum' },
  tips: ['Go late Thursday when it\'s open until 9:45pm — the crowds thin beautifully'],
});

const fragments = place('demo-p6', 'Fragments', 'cafe', 'Paris, France', {
  tasteNote: 'Third-wave coffee in a sun-drenched corner of the Haut-Marais, with some of the best pastries in the 3rd.',
  matchScore: 0.87,
  google: { placeId: 'demo-fragments', rating: 4.4, reviewCount: 950, category: 'cafe' },
});

const sessionsArts = place('demo-p7', 'Sessions Arts Club', 'restaurant', 'London, England', {
  tasteNote: 'Hidden restaurant in a former courthouse — Florence Knight\'s seasonal British cooking in the most dramatic room in London.',
  matchScore: 0.93,
  google: { placeId: 'demo-sessions', rating: 4.5, reviewCount: 1100, category: 'restaurant' },
});

const ettHem = place('demo-p8', 'Ett Hem', 'hotel', 'Stockholm, Sweden', {
  tasteNote: 'A private home that happens to accept guests — Ilse Crawford\'s masterpiece of warm minimalism.',
  matchScore: 0.96,
  google: { placeId: 'demo-etthem', rating: 4.8, reviewCount: 420, category: 'hotel' },
  accolades: [{ type: 'award', value: 'World\'s 50 Best Hotels', year: '2024' }],
});

const fotografiska = place('demo-p9', 'Fotografiska', 'museum', 'Stockholm, Sweden', {
  tasteNote: 'Contemporary photography museum with a rooftop restaurant that\'s worth a visit on its own.',
  matchScore: 0.84,
  google: { placeId: 'demo-foto', rating: 4.5, reviewCount: 8200, category: 'museum' },
});

const oaxen = place('demo-p10', 'Oaxen Krog', 'restaurant', 'Stockholm, Sweden', {
  tasteNote: 'New Nordic fine dining in a converted boathouse on Djurgården — the setting is the story.',
  matchScore: 0.90,
  google: { placeId: 'demo-oaxen', rating: 4.6, reviewCount: 1800, category: 'restaurant' },
  accolades: [{ type: 'michelin', value: '2 Stars', year: '2024' }],
});

// ═══════════════════════════════════════════
// Demo trip: Paris for 3 days
// ═══════════════════════════════════════════

export const DEMO_TRIP: Trip = {
  id: 'demo-trip-paris',
  name: 'Paris in May',
  location: 'Paris, France',
  destinations: ['Paris'],
  startDate: '2026-05-07',
  endDate: '2026-05-09',
  status: 'planning',
  travelContext: 'partner',
  groupSize: 2,
  pool: [lefMarais],
  days: [
    {
      dayNumber: 1,
      date: 'May 7',
      dayOfWeek: 'Thursday',
      destination: 'Paris',
      hotelInfo: { name: 'Hôtel Grand Amour', address: '18 Rue de la Fidélité, 75010 Paris' },
      slots: [
        { id: 'breakfast', label: 'Breakfast', time: '8:00 AM', places: [fragments] },
        { id: 'morning', label: 'Morning', time: '10:00 AM', places: [museeDorsay] },
        { id: 'lunch', label: 'Lunch', time: '12:30 PM', places: [] },
        { id: 'afternoon', label: 'Afternoon', time: '2:30 PM', places: [] },
        { id: 'dinner', label: 'Dinner', time: '7:00 PM', places: [septime] },
        { id: 'evening', label: 'Evening', time: '9:30 PM', places: [clown] },
      ],
    },
    {
      dayNumber: 2,
      date: 'May 8',
      dayOfWeek: 'Friday',
      destination: 'Paris',
      slots: [
        { id: 'breakfast', label: 'Breakfast', time: '8:00 AM', places: [] },
        { id: 'morning', label: 'Morning', time: '10:00 AM', places: [] },
        { id: 'lunch', label: 'Lunch', time: '12:30 PM', places: [] },
        { id: 'afternoon', label: 'Afternoon', time: '2:30 PM', places: [] },
        { id: 'dinner', label: 'Dinner', time: '7:00 PM', places: [] },
        { id: 'evening', label: 'Evening', time: '9:30 PM', places: [] },
      ],
    },
    {
      dayNumber: 3,
      date: 'May 9',
      dayOfWeek: 'Saturday',
      destination: 'Paris',
      slots: [
        { id: 'breakfast', label: 'Breakfast', time: '8:00 AM', places: [] },
        { id: 'morning', label: 'Morning', time: '10:00 AM', places: [] },
        { id: 'lunch', label: 'Lunch', time: '12:30 PM', places: [] },
        { id: 'afternoon', label: 'Afternoon', time: '2:30 PM', places: [] },
        { id: 'dinner', label: 'Dinner', time: '7:00 PM', places: [] },
        { id: 'evening', label: 'Evening', time: '9:30 PM', places: [] },
      ],
    },
  ],
};

// ═══════════════════════════════════════════
// Demo saved places (library)
// ═══════════════════════════════════════════

export const DEMO_PLACES: ImportedPlace[] = [
  { ...septime, status: 'available', savedAt: '2026-02-15T10:00:00Z' },
  { ...hotelGrandAmour, status: 'available', savedAt: '2026-02-14T09:00:00Z' },
  { ...clown, status: 'available', savedAt: '2026-02-16T14:00:00Z' },
  { ...museeDorsay, status: 'available', savedAt: '2026-02-17T11:00:00Z' },
  { ...fragments, status: 'available', savedAt: '2026-02-18T08:00:00Z' },
  { ...sessionsArts, status: 'available', savedAt: '2026-01-20T18:00:00Z' },
  { ...ettHem, status: 'available', savedAt: '2026-01-22T12:00:00Z' },
  { ...fotografiska, status: 'available', savedAt: '2026-01-25T16:00:00Z' },
  { ...oaxen, status: 'available', savedAt: '2026-01-28T20:00:00Z' },
];

// ═══════════════════════════════════════════
// Demo collection
// ═══════════════════════════════════════════

const now = new Date().toISOString();

export const DEMO_COLLECTIONS: Collection[] = [
  {
    id: 'demo-collection-paris',
    name: 'Paris Shortlist',
    description: 'Our curated picks for the May trip',
    emoji: 'food',
    placeIds: ['demo-p1', 'demo-p2', 'demo-p4', 'demo-p5', 'demo-p6'],
    cities: ['Paris, France'],
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: now,
  },
  {
    id: 'demo-collection-scandi',
    name: 'Scandinavia Dreams',
    description: 'For the eventual Stockholm trip',
    emoji: 'discover',
    placeIds: ['demo-p8', 'demo-p9', 'demo-p10'],
    cities: ['Stockholm, Sweden'],
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: now,
  },
];
