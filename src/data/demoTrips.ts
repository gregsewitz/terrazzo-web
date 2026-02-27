import { Trip, ImportedPlace, TripDay, DEFAULT_TIME_SLOTS } from '@/types';
import { PLACE_DIRECTORY } from './placeDirectory';

// ═══════════════════════════════════════════════════════════════════
// TRIP 1: Stockholm + Copenhagen — Partner, 5 days, Planning
// ═══════════════════════════════════════════════════════════════════

const STOCKHOLM_COPENHAGEN_POOL: ImportedPlace[] = [
  // ── Core Places ──
    {
    ...PLACE_DIRECTORY['sc-1'],
    status: 'placed',
    placedIn: { day: 1, slot: 'morning' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-2'],
    status: 'placed',
    placedIn: { day: 2, slot: 'dinner' },
    ghostSource: 'article',
    whatToOrder: ['Trust the set menu', 'The langoustine course is legendary'],
    tips: ['Dress smart but not formal', 'The top floor "The Dining" is the main event'],
  },
    {
    ...PLACE_DIRECTORY['sc-3'],
    status: 'available',
    ghostSource: 'maps',
    savedAt: '2025-03-01T00:00:00.000Z',
    whatToOrder: ['Oysters', 'Toast Skagen', 'SOS (smör, ost, sill)'],
  },
    {
    ...PLACE_DIRECTORY['sc-4'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'Best filter coffee in Scandinavia, not even close' },
  },
    {
    ...PLACE_DIRECTORY['sc-5'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-6'],
    status: 'placed',
    placedIn: { day: 1, slot: 'afternoon' },
    ghostSource: 'maps',
    savedAt: '2025-01-01T00:00:00.000Z',
  },
    {
    ...PLACE_DIRECTORY['sc-7'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-8'],
    status: 'placed',
    placedIn: { day: 3, slot: 'morning' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-9'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-10'],
    status: 'placed',
    placedIn: { day: 4, slot: 'lunch' },
    ghostSource: 'friend',
    whatToOrder: ['Schnitzel', 'Flødeboller for dessert', 'Ask about the draft beers'],
    friendAttribution: { name: 'Lizzie N.', note: 'This is where I\'d actually eat every day in Copenhagen — the schnitzel is perfect' },
  },
    {
    ...PLACE_DIRECTORY['sc-11'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-12'],
    status: 'placed',
    placedIn: { day: 5, slot: 'morning' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-13'],
    status: 'available',
    ghostSource: 'friend',
    whatToOrder: ['Morning bun', 'Sourdough loaf to take home', 'Any of the viennoiserie'],
    friendAttribution: { name: 'Lizzie N.', note: 'The morning bun is life-changing. Go before 9.' },
  },
    {
    ...PLACE_DIRECTORY['sc-14'],
    status: 'available',
    ghostSource: 'article',
  },

  // ── Pool Additions (Friend & Editorial Recs) ──
    {
    ...PLACE_DIRECTORY['sc-15'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'The set menu is worth it, very cozy' },
  },
    {
    ...PLACE_DIRECTORY['sc-16'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'Casual side is great for lunch — sit outside if it\'s warm' },
  },
    {
    ...PLACE_DIRECTORY['sc-17'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-18'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-19'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['sc-20'],
    status: 'available',
    ghostSource: 'article',
  },
];

const SC_DAY_1_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-4')!,
    id: 'ghost-sc-dropcoffee',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'Best filter coffee in Scandinavia' },
    terrazzoReasoning: { rationale: 'Start with Stockholm\'s best coffee — 5 min walk from Ett Hem', confidence: 0.85 },
  }],
  morning: [],
  lunch: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-3')!,
    id: 'ghost-sc-sturehof',
    ghostStatus: 'proposed',
    ghostSource: 'terrazzo',
    terrazzoReasoning: { rationale: 'Classic first-day-in-Stockholm seafood lunch — your Food axis will love the raw bar', confidence: 0.82 },
  }],
  afternoon: [],
  dinner: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-7')!,
    id: 'ghost-sc-tjoget',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Södermalm cocktails to cap day one — the deli side does great small plates too', confidence: 0.78 },
  }],
  evening: [],
};

const SC_DAY_3_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-13')!,
    id: 'ghost-sc-hart',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'The morning bun is life-changing. Go before 9.' },
  }],
  morning: [],
  lunch: [],
  afternoon: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-11')!,
    id: 'ghost-sc-norrebro',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Explore Copenhagen\'s most authentic neighborhood — great contrast to the tourist center', confidence: 0.8 },
  }],
  dinner: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-17')!,
    id: 'ghost-sc-kadeau',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Your Food axis peaks with this Bornholm-inspired tasting menu — more intimate than Noma', confidence: 0.88 },
  }],
  evening: [{
    ...STOCKHOLM_COPENHAGEN_POOL.find(p => p.id === 'sc-14')!,
    id: 'ghost-sc-ruby',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'End the evening in a candlelit 19th-century townhouse — your Character axis will love it', confidence: 0.82 },
  }],
};

function createStockholmCopenhagenDays(): TripDay[] {
  const dayData = [
    { date: 'Jun 12', dayOfWeek: 'Friday', dest: 'Stockholm', hotel: 'Ett Hem' },
    { date: 'Jun 13', dayOfWeek: 'Saturday', dest: 'Stockholm', hotel: 'Ett Hem' },
    { date: 'Jun 14', dayOfWeek: 'Sunday', dest: 'Copenhagen', hotel: 'Hotel Sanders' },
    { date: 'Jun 15', dayOfWeek: 'Monday', dest: 'Copenhagen', hotel: 'Hotel Sanders' },
    { date: 'Jun 16', dayOfWeek: 'Tuesday', dest: 'Copenhagen', hotel: 'Hotel Sanders' },
  ];

  const ghosts: Record<string, Record<string, ImportedPlace[]>> = {
    '1': SC_DAY_1_GHOSTS,
    '3': SC_DAY_3_GHOSTS,
  };

  return dayData.map((d, i) => ({
    dayNumber: i + 1,
    date: d.date,
    dayOfWeek: d.dayOfWeek,
    destination: d.dest,
    hotel: d.hotel,
    slots: DEFAULT_TIME_SLOTS.map(s => ({
      ...s,
      places: [],
      ghostItems: ghosts[String(i + 1)]?.[s.id] || [],
    })),
  }));
}

export const TRIP_STOCKHOLM_COPENHAGEN: Trip = {
  id: 'demo-stockholm-copenhagen',
  name: 'Stockholm & Copenhagen',
  location: 'Stockholm, Copenhagen',
  startDate: '2026-06-12',
  endDate: '2026-06-16',
  destinations: ['Stockholm', 'Copenhagen'],
  travelContext: 'partner',
  groupSize: 2,
  status: 'planning',
  days: createStockholmCopenhagenDays(),
  pool: [], // Places now live in savedStore as DEMO_ALL_PLACES
};

// Helper to push a place into a slot
function prePlaceItem(slot: { places: ImportedPlace[] }, pool: ImportedPlace[], id: string) {
  const item = pool.find(p => p.id === id);
  if (item) slot.places.push(item);
}

// Place pre-placed items into day slots
prePlaceItem(TRIP_STOCKHOLM_COPENHAGEN.days[0].slots[1], STOCKHOLM_COPENHAGEN_POOL, 'sc-1'); // Ett Hem - Day 1 morning
prePlaceItem(TRIP_STOCKHOLM_COPENHAGEN.days[0].slots[3], STOCKHOLM_COPENHAGEN_POOL, 'sc-6'); // Fotografiska - Day 1 afternoon
prePlaceItem(TRIP_STOCKHOLM_COPENHAGEN.days[1].slots[4], STOCKHOLM_COPENHAGEN_POOL, 'sc-2'); // Frantzén - Day 2 dinner
prePlaceItem(TRIP_STOCKHOLM_COPENHAGEN.days[2].slots[1], STOCKHOLM_COPENHAGEN_POOL, 'sc-8'); // Hotel Sanders - Day 3 morning
prePlaceItem(TRIP_STOCKHOLM_COPENHAGEN.days[3].slots[2], STOCKHOLM_COPENHAGEN_POOL, 'sc-10'); // Barr - Day 4 lunch
prePlaceItem(TRIP_STOCKHOLM_COPENHAGEN.days[4].slots[1], STOCKHOLM_COPENHAGEN_POOL, 'sc-12'); // Louisiana - Day 5 morning


// ═══════════════════════════════════════════════════════════════════
// TRIP 2: Mexico City — Friends, Group of 4, 4 days, Planning
// ═══════════════════════════════════════════════════════════════════

const MEXICO_CITY_POOL: ImportedPlace[] = [
  // ── Core Places ──
    {
    ...PLACE_DIRECTORY['mx-1'],
    status: 'placed',
    placedIn: { day: 1, slot: 'morning' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-2'],
    status: 'placed',
    placedIn: { day: 1, slot: 'lunch' },
    ghostSource: 'article',
    whatToOrder: ['Tostada de atún (the iconic red/green tuna)', 'Pulpo a las brasas', 'Margaritas for the table'],
    tips: ['Arrive at 1pm sharp — no reservations', 'Sit outside under the retractable roof'],
  },
    {
    ...PLACE_DIRECTORY['mx-3'],
    status: 'placed',
    placedIn: { day: 3, slot: 'dinner' },
    ghostSource: 'article',
    whatToOrder: ['Mole madre (the 1600-day mole)', 'Taco omakase at the bar if available'],
  },
    {
    ...PLACE_DIRECTORY['mx-4'],
    status: 'placed',
    placedIn: { day: 2, slot: 'morning' },
    ghostSource: 'maps',
    savedAt: '2024-11-01T00:00:00.000Z',
  },
    {
    ...PLACE_DIRECTORY['mx-5'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-6'],
    status: 'available',
    ghostSource: 'article',
    tips: ['Go hungry', 'Start at the food stalls in the back', 'Try the quesadillas de huitlacoche'],
  },
    {
    ...PLACE_DIRECTORY['mx-7'],
    status: 'available',
    ghostSource: 'friend',
    whatToOrder: ['Tacos al pastor (obviously)', 'Gringa (pastor in a flour tortilla with cheese)'],
    friendAttribution: { name: 'James K.', note: 'The original Centro location only — accept no substitutes' },
  },
    {
    ...PLACE_DIRECTORY['mx-8'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-9'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-10'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-11'],
    status: 'available',
    ghostSource: 'article',
    whatToOrder: ['Any pasta (they make it in-house)', 'The bread basket from Panadería Rosetta'],
  },
    {
    ...PLACE_DIRECTORY['mx-12'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'The mezcal negroni is incredible here' },
  },
    {
    ...PLACE_DIRECTORY['mx-13'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'This is the most fun you\'ll have in CDMX — trust me, go Friday night' },
  },

  // ── Pool Additions (Friend & Editorial Recs) ──
    {
    ...PLACE_DIRECTORY['mx-14'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'No menu, just trust them, go hungry' },
  },
    {
    ...PLACE_DIRECTORY['mx-15'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'Best new opening, get the mole' },
  },
    {
    ...PLACE_DIRECTORY['mx-16'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'Lakeside lunch, very photogenic for the group' },
  },
    {
    ...PLACE_DIRECTORY['mx-17'],
    status: 'available',
    ghostSource: 'article',
    whatToOrder: ['Whatever\'s on the menu — it changes daily', 'The aguachile if available'],
  },
    {
    ...PLACE_DIRECTORY['mx-18'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-19'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['mx-20'],
    status: 'available',
    ghostSource: 'article',
  },
];

const MX_DAY_1_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-20')!,
    id: 'ghost-mx-garat',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Mexican chocolate to start day one — right in Roma Norte before Contramar', confidence: 0.75 },
  }],
  morning: [],
  lunch: [],
  afternoon: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-8')!,
    id: 'ghost-mx-coyoacan',
    ghostStatus: 'proposed',
    ghostSource: 'terrazzo',
    terrazzoReasoning: { rationale: 'Frida\'s neighborhood is a perfect post-lunch wander for the group', confidence: 0.82 },
  }],
  dinner: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-11')!,
    id: 'ghost-mx-rosetta',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Reygadas\'s Italian-Mexican fusion in a stunning Roma mansion — great first dinner for 4', confidence: 0.86 },
  }],
  evening: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-9')!,
    id: 'ghost-mx-limantour',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'World\'s 50 Best Bars — mezcal cocktails to cap night one', confidence: 0.8 },
  }],
};

const MX_DAY_2_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [],
  morning: [],
  lunch: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-16')!,
    id: 'ghost-mx-lago',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'Lakeside lunch, very photogenic for the group' },
  }],
  afternoon: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-18')!,
    id: 'ghost-mx-jumex',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Chipperfield building + world-class contemporary art — 5 min from Pujol if you want to combine', confidence: 0.8 },
  }],
  dinner: [{
    ...MEXICO_CITY_POOL.find(p => p.id === 'mx-14')!,
    id: 'ghost-mx-expendio',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'No menu, just trust them, go hungry' },
  }],
  evening: [],
};

function createMexicoCityDays(): TripDay[] {
  const dayData = [
    { date: 'Mar 19', dayOfWeek: 'Thursday' },
    { date: 'Mar 20', dayOfWeek: 'Friday' },
    { date: 'Mar 21', dayOfWeek: 'Saturday' },
    { date: 'Mar 22', dayOfWeek: 'Sunday' },
  ];

  const ghosts: Record<string, Record<string, ImportedPlace[]>> = {
    '1': MX_DAY_1_GHOSTS,
    '2': MX_DAY_2_GHOSTS,
  };

  return dayData.map((d, i) => ({
    dayNumber: i + 1,
    date: d.date,
    dayOfWeek: d.dayOfWeek,
    destination: 'Mexico City',
    hotel: 'Círculo Mexicano',
    slots: DEFAULT_TIME_SLOTS.map(s => ({
      ...s,
      places: [],
      ghostItems: ghosts[String(i + 1)]?.[s.id] || [],
    })),
  }));
}

export const TRIP_MEXICO_CITY: Trip = {
  id: 'demo-mexico-city',
  name: 'Mexico City',
  location: 'Mexico City, Mexico',
  startDate: '2026-03-19',
  endDate: '2026-03-22',
  destinations: ['Mexico City'],
  travelContext: 'friends',
  groupSize: 4,
  status: 'planning',
  days: createMexicoCityDays(),
  pool: [], // Places now live in savedStore as DEMO_ALL_PLACES
};

// Place pre-placed items
prePlaceItem(TRIP_MEXICO_CITY.days[0].slots[1], MEXICO_CITY_POOL, 'mx-1'); // Círculo - Day 1 morning
prePlaceItem(TRIP_MEXICO_CITY.days[0].slots[2], MEXICO_CITY_POOL, 'mx-2'); // Contramar - Day 1 lunch
prePlaceItem(TRIP_MEXICO_CITY.days[1].slots[1], MEXICO_CITY_POOL, 'mx-4'); // Antropología - Day 2 morning
prePlaceItem(TRIP_MEXICO_CITY.days[2].slots[4], MEXICO_CITY_POOL, 'mx-3'); // Pujol - Day 3 dinner


// ═══════════════════════════════════════════════════════════════════
// TRIP 3: Paris — Solo, 3 days, Planning
// ═══════════════════════════════════════════════════════════════════

const PARIS_POOL: ImportedPlace[] = [
    {
    ...PLACE_DIRECTORY['pa-1'],
    status: 'placed',
    placedIn: { day: 1, slot: 'morning' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-2'],
    status: 'placed',
    placedIn: { day: 1, slot: 'lunch' },
    ghostSource: 'email',
    whatToOrder: ['Steak frites', 'A pichet of Côtes du Rhône', 'Crème brûlée'],
  },
    {
    ...PLACE_DIRECTORY['pa-3'],
    status: 'placed',
    placedIn: { day: 2, slot: 'dinner' },
    ghostSource: 'friend',
    whatToOrder: ['Sea urchin if in season', 'Anything on the daily specials board', 'Let them pick the wine'],
    friendAttribution: { name: 'James K.', note: 'Best natural wine list in Paris, bar none' },
  },
    {
    ...PLACE_DIRECTORY['pa-4'],
    status: 'placed',
    placedIn: { day: 1, slot: 'breakfast' },
    ghostSource: 'maps',
    savedAt: '2024-09-01T00:00:00.000Z',
  },
    {
    ...PLACE_DIRECTORY['pa-5'],
    status: 'placed',
    placedIn: { day: 1, slot: 'afternoon' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-6'],
    status: 'placed',
    placedIn: { day: 2, slot: 'afternoon' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-7'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-8'],
    status: 'placed',
    placedIn: { day: 3, slot: 'lunch' },
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-9'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-10'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'Tiniest café in Paris — go for espresso, not for working' },
  },
    {
    ...PLACE_DIRECTORY['pa-11'],
    status: 'available',
    ghostSource: 'maps',
    savedAt: '2024-07-01T00:00:00.000Z',
    whatToOrder: ['The chocolate mousse (mandatory)', 'Any Provençal special'],
  },
    {
    ...PLACE_DIRECTORY['pa-12'],
    status: 'available',
    ghostSource: 'article',
  },

  // ── Pool Additions (Friend & Editorial Recs) ──
    {
    ...PLACE_DIRECTORY['pa-13'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'Japanese-French yakitori, tiny, book ahead' },
  },
    {
    ...PLACE_DIRECTORY['pa-14'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'Indochine vibes, the space alone is worth it' },
  },
    {
    ...PLACE_DIRECTORY['pa-15'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'My favorite coffee in Paris, full stop' },
  },
    {
    ...PLACE_DIRECTORY['pa-16'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-17'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-18'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['pa-19'],
    status: 'available',
    ghostSource: 'article',
  },
];

const PA_DAY_2_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [{
    ...PARIS_POOL.find(p => p.id === 'pa-15')!,
    id: 'ghost-pa-fragments',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'My favorite coffee in Paris, full stop' },
  }],
  morning: [{
    ...PARIS_POOL.find(p => p.id === 'pa-12')!,
    id: 'ghost-pa-enfants',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Oldest covered market in Paris — perfect solo lunch at communal tables before Le Marais wander', confidence: 0.82 },
  }],
  lunch: [],
  afternoon: [],
  dinner: [],
  evening: [{
    ...PARIS_POOL.find(p => p.id === 'pa-19')!,
    id: 'ghost-pa-candelaria',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Mezcal speakeasy in the Marais — perfect solo nightcap after Clown Bar', confidence: 0.78 },
  }],
};

const PA_DAY_3_GHOSTS: Record<string, ImportedPlace[]> = {
  breakfast: [{
    ...PARIS_POOL.find(p => p.id === 'pa-10')!,
    id: 'ghost-pa-boot',
    ghostStatus: 'proposed',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'Tiniest café in Paris — go for espresso' },
  }],
  morning: [{
    ...PARIS_POOL.find(p => p.id === 'pa-9')!,
    id: 'ghost-pa-merci',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Paris\'s best concept store — your Design axis will love the curation', confidence: 0.8 },
  }],
  lunch: [],
  afternoon: [{
    ...PARIS_POOL.find(p => p.id === 'pa-17')!,
    id: 'ghost-pa-palaisdetokyo',
    ghostStatus: 'proposed',
    ghostSource: 'article',
    terrazzoReasoning: { rationale: 'Raw contemporary art until midnight — perfect solo afternoon before heading to the airport', confidence: 0.75 },
  }],
  dinner: [],
  evening: [],
};

function createParisDays(): TripDay[] {
  const dayData = [
    { date: 'May 7', dayOfWeek: 'Thursday' },
    { date: 'May 8', dayOfWeek: 'Friday' },
    { date: 'May 9', dayOfWeek: 'Saturday' },
  ];

  const ghosts: Record<string, Record<string, ImportedPlace[]>> = {
    '2': PA_DAY_2_GHOSTS,
    '3': PA_DAY_3_GHOSTS,
  };

  return dayData.map((d, i) => ({
    dayNumber: i + 1,
    date: d.date,
    dayOfWeek: d.dayOfWeek,
    destination: 'Paris',
    hotel: 'Hôtel des Grands Boulevards',
    slots: DEFAULT_TIME_SLOTS.map(s => ({
      ...s,
      places: [],
      ghostItems: ghosts[String(i + 1)]?.[s.id] || [],
    })),
  }));
}

export const TRIP_PARIS: Trip = {
  id: 'demo-paris',
  name: 'Paris',
  location: 'Paris, France',
  startDate: '2026-05-07',
  endDate: '2026-05-09',
  destinations: ['Paris'],
  travelContext: 'solo',
  status: 'planning',
  days: createParisDays(),
  pool: [], // Places now live in savedStore as DEMO_ALL_PLACES
};

// Place pre-placed items (solo = more decisive, more pre-placed)
prePlaceItem(TRIP_PARIS.days[0].slots[0], PARIS_POOL, 'pa-4'); // Café de Flore - Day 1 breakfast
prePlaceItem(TRIP_PARIS.days[0].slots[1], PARIS_POOL, 'pa-1'); // Hotel - Day 1 morning
prePlaceItem(TRIP_PARIS.days[0].slots[2], PARIS_POOL, 'pa-2'); // Le Comptoir - Day 1 lunch
prePlaceItem(TRIP_PARIS.days[0].slots[3], PARIS_POOL, 'pa-5'); // Orangerie - Day 1 afternoon
prePlaceItem(TRIP_PARIS.days[1].slots[3], PARIS_POOL, 'pa-6'); // Le Marais - Day 2 afternoon
prePlaceItem(TRIP_PARIS.days[1].slots[4], PARIS_POOL, 'pa-3'); // Clown Bar - Day 2 dinner
prePlaceItem(TRIP_PARIS.days[2].slots[2], PARIS_POOL, 'pa-8'); // Septime - Day 3 lunch


// ═══════════════════════════════════════════════════════════════════
// TRIP 4: Sicily — Family of 4, 7 days, Dreaming
// ═══════════════════════════════════════════════════════════════════

const SICILY_POOL: ImportedPlace[] = [
    {
    ...PLACE_DIRECTORY['si-1'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-2'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-3'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-4'],
    status: 'available',
    ghostSource: 'maps',
    savedAt: '2025-02-01T00:00:00.000Z',
  },
    {
    ...PLACE_DIRECTORY['si-5'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-6'],
    status: 'available',
    ghostSource: 'friend',
    whatToOrder: ['Pasta alla norma', 'Whatever fish is fresh that day', 'Granita for dessert'],
    friendAttribution: { name: 'Lizzie N.', note: 'Perfect family dinner — terrace, homemade pasta, very relaxed about kids' },
  },
    {
    ...PLACE_DIRECTORY['si-7'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-8'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-9'],
    status: 'available',
    ghostSource: 'article',
    whatToOrder: ['Granita di mandorla con brioche (mandatory)', 'Cassata', 'Any seasonal gelato'],
  },
    {
    ...PLACE_DIRECTORY['si-10'],
    status: 'available',
    ghostSource: 'article',
    whatToOrder: ['Panelle (chickpea fritters)', 'Arancine', 'Pasta con le sarde'],
  },
    {
    ...PLACE_DIRECTORY['si-11'],
    status: 'available',
    ghostSource: 'maps',
    savedAt: '2025-01-01T00:00:00.000Z',
    tips: ['Book a guide for the upper craters', 'Bring warm layers — it\'s cold at the top even in summer', 'Stop at a winery on the way down'],
  },
    {
    ...PLACE_DIRECTORY['si-12'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-13'],
    status: 'available',
    ghostSource: 'maps',
    savedAt: '2024-12-01T00:00:00.000Z',
  },

  // ── Pool Additions (Friend & Editorial Recs) ──
    {
    ...PLACE_DIRECTORY['si-14'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'Lizzie N.', note: 'If you can do a night on Vulcano, the infinity pool is unreal' },
  },
    {
    ...PLACE_DIRECTORY['si-15'],
    status: 'available',
    ghostSource: 'friend',
    friendAttribution: { name: 'James K.', note: 'Incredible pasta alla norma, garden seating, kids loved it' },
  },
    {
    ...PLACE_DIRECTORY['si-16'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-17'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-18'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-19'],
    status: 'available',
    ghostSource: 'article',
  },
    {
    ...PLACE_DIRECTORY['si-20'],
    status: 'available',
    ghostSource: 'article',
  },
];

function createSicilyDays(): TripDay[] {
  const dayData = [
    { date: 'Aug 1', dayOfWeek: 'Saturday', dest: 'Palermo' },
    { date: 'Aug 2', dayOfWeek: 'Sunday', dest: 'Palermo' },
    { date: 'Aug 3', dayOfWeek: 'Monday', dest: 'West Coast' },
    { date: 'Aug 4', dayOfWeek: 'Tuesday', dest: 'Agrigento' },
    { date: 'Aug 5', dayOfWeek: 'Wednesday', dest: 'Noto / Syracuse' },
    { date: 'Aug 6', dayOfWeek: 'Thursday', dest: 'Taormina' },
    { date: 'Aug 7', dayOfWeek: 'Friday', dest: 'Taormina' },
  ];

  // Dreaming = fewer ghosts, more open
  return dayData.map((d, i) => ({
    dayNumber: i + 1,
    date: d.date,
    dayOfWeek: d.dayOfWeek,
    destination: d.dest,
    slots: DEFAULT_TIME_SLOTS.map(s => ({
      ...s,
      places: [],
      ghostItems: [],
    })),
  }));
}

export const TRIP_SICILY: Trip = {
  id: 'demo-sicily',
  name: 'Sicily',
  location: 'Sicily, Italy',
  startDate: '2026-08-01',
  endDate: '2026-08-07',
  destinations: ['Palermo', 'West Coast', 'Agrigento', 'Noto / Syracuse', 'Taormina'],
  travelContext: 'family',
  groupSize: 4,
  status: 'dreaming',
  days: createSicilyDays(),
  pool: [], // Places now live in savedStore as DEMO_ALL_PLACES
};

// Sicily is "dreaming" — very few pre-placed, mostly a big pool to sort through
// No items placed — the whole thing is aspirational


// ═══════════════════════════════════════════════════════════════════
// EXPORT ALL TRIPS
// ═══════════════════════════════════════════════════════════════════

export const ALL_DEMO_TRIPS: Trip[] = [
  TRIP_STOCKHOLM_COPENHAGEN,
  TRIP_MEXICO_CITY,
  TRIP_PARIS,
  TRIP_SICILY,
];
