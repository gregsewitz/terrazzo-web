// ═══════════════════════════════════════════════════════════════════
// Discover Feed — Editorial content for the Terrazzo discovery experience
// ═══════════════════════════════════════════════════════════════════

export interface BecauseYouCard {
  signal: string;
  signalDomain: string;
  place: string;
  location: string;
  score: number;
  why: string;
  bg: string;
  googlePlaceId?: string;
}

export interface CollectionPlace {
  name: string;
  location: string;
  score: number;
  signals: string[];
  signalDomain: string;
  note: string;
  googlePlaceId?: string;
}

export interface FriendSave {
  friendName: string;
  friendInitial: string;
  place: string;
  location: string;
  score: number;
  type: string;
  whyMatches: string;
  color: string;
  googlePlaceId?: string;
}

export interface ContextRec {
  name: string;
  location: string;
  score: number;
  whyFits: string;
  googlePlaceId?: string;
}

/** Editorial letter — a short, evocative note from Terrazzo's intelligence */
export interface EditorialLetter {
  headline: string;      // e.g. "You don't search for quiet — you listen for it."
  body: string;          // 2-3 sentences, deeply personal, second-person
  signalHighlight: string; // the specific signal that sparked this insight
}

/** A "signal thread" — connecting a micro-signal to 3 diverse place types */
export interface SignalThread {
  signal: string;        // e.g. "morning light (golden)"
  domain: string;
  thread: string;        // editorial sentence connecting the dots
  places: {
    name: string;
    location: string;
    type: string;        // hotel | restaurant | bar | cafe | neighborhood
    connection: string;  // how this place embodies the signal
    score: number;
    googlePlaceId?: string;
  }[];
}

/** A "taste tension" — editorial exploration of a contradiction in their profile */
export interface TasteTension {
  title: string;         // e.g. "The Minimalist Who Loves Chaos"
  stated: string;
  revealed: string;
  editorial: string;     // 2-3 sentences exploring WHY this tension exists
  resolvedBy: {
    name: string;
    location: string;
    how: string;
    googlePlaceId?: string;
  };
}

/** A "mood board" — curated set of places for a specific mood/context */
export interface MoodBoard {
  mood: string;           // e.g. "When you need to disappear"
  description: string;    // 1-sentence evocative description
  color: string;          // accent color for the board
  places: {
    name: string;
    location: string;
    vibe: string;         // 3-5 word atmospheric description
    score: number;
    googlePlaceId?: string;
  }[];
}

/** A "deep match" — why a specific property is an exceptional match, broken down */
export interface DeepMatch {
  name: string;
  location: string;
  score: number;
  headline: string;       // e.g. "This place was made for the way you travel."
  signalBreakdown: {
    signal: string;
    domain: string;
    strength: number;     // 0-100
    note: string;         // why this signal matches
  }[];
  tensionResolved: string;
  googlePlaceId?: string;
}

// ── Section: "Because You..." insight cards ──
export const BECAUSE_YOU_CARDS: BecauseYouCard[] = [
  {
    signal: "morning light (golden)",
    signalDomain: "Design Language",
    place: "Masseria Moroseta",
    location: "Puglia, Italy",
    score: 97,
    why: "Every room faces east. The tufa stone glows amber at breakfast. The architect designed around the sunrise.",
    bg: "#2d3a2d",
  },
  {
    signal: "initiative without intrusion",
    signalDomain: "Service Philosophy",
    place: "Hoshinoya Kyoto",
    location: "Kyoto, Japan",
    score: 89,
    why: "Staff remember your tea preference from day one. No check-in desk. The boat ride in is the welcome.",
    bg: "#3a2d2d",
  },
  {
    signal: "communal dinner (long table)",
    signalDomain: "Food & Drink",
    place: "Forestis",
    location: "Dolomites, Italy",
    score: 94,
    why: "One long larch table, one menu, everyone sits together. The chef forages that morning. No choices, just trust.",
    bg: "#2d2d3a",
  },
];

// ── Editorial Letter ──
export const EDITORIAL_LETTER: EditorialLetter = {
  headline: "You don't search for quiet — you listen for it.",
  body: "Most travelers say they want peace. You're after something more specific: the moment when a room stops performing and starts breathing. We've been watching your signals — the way you lingered on courtyard-centered properties, the speed with which you rejected marble lobbies — and we think we know what you're really looking for.",
  signalHighlight: "Sleep-darkness-critical",
};

// ── Signal Thread ──
export const SIGNAL_THREAD: SignalThread = {
  signal: "Neo-rustic refined",
  domain: "Design Language",
  thread: "This single signal touches everything — how you eat, where you sleep, the neighborhoods you gravitate toward.",
  places: [
    {
      name: "Forestis",
      location: "Dolomites, Italy",
      type: "hotel",
      connection: "Larch wood walls and alpine stone — the building IS the landscape",
      score: 94,
    },
    {
      name: "Septime",
      location: "11th, Paris",
      type: "restaurant",
      connection: "Bare tables, imperfect ceramics, wine in simple glasses — deliberate understatement",
      score: 91,
    },
    {
      name: "Södermalm",
      location: "Stockholm, Sweden",
      type: "neighborhood",
      connection: "Where design-minded Stockholm actually lives — every cafe and shop reflects this signal",
      score: 88,
    },
  ],
};

// ── Taste Tension ──
export const TASTE_TENSION: TasteTension = {
  title: "The Minimalist Who Loves Chaos",
  stated: "Drawn to minimalism and restraint",
  revealed: "Loved a maximalist masseria with layered ceramics",
  editorial: "This contradiction runs deeper than aesthetics. You don't actually want less — you want intentional. The masseria ceramics worked because each piece was chosen by someone with a point of view. A marble lobby fails because nobody chose — they just specified.",
  resolvedBy: {
    name: "Ett Hem",
    location: "Stockholm, Sweden",
    how: "12 rooms, every surface layered — but nothing is accidental. Ilse Crawford designed a home, not a hotel.",
  },
};

// ── This Week's Edit collection ──
export const WEEKLY_COLLECTION = {
  title: "5 Design Hotels That Match Your Exact Frequency",
  subtitle: "Filtered for: neo-rustic refined · owner-operated · intimate-under-20",
  places: [
    {
      name: "Masseria Moroseta",
      location: "Puglia, Italy",
      score: 97,
      signals: ["Vernacular modern", "Artisan ceramics", "Morning light"],
      signalDomain: "Design Language",
      note: "A white masseria where the architecture IS the experience — every surface is hand-finished local tufa",
    },
    {
      name: "Forestis",
      location: "Dolomites, Italy",
      score: 94,
      signals: ["Neo-rustic refined", "Staff-as-host", "Fresh-air-obsessive"],
      signalDomain: "Design Language",
      note: "Built into the mountain at 1,800m. Larch wood, floor-to-ceiling glass, and air that tastes like pine",
    },
    {
      name: "Ett Hem",
      location: "Stockholm, Sweden",
      score: 92,
      signals: ["Curated density", "Domestic atmosphere", "Owner-operated"],
      signalDomain: "Character & Identity",
      note: "A townhouse that feels like staying at a brilliantly stylish friend's home — 12 rooms, no lobby",
    },
    {
      name: "Hoshinoya Kyoto",
      location: "Kyoto, Japan",
      score: 89,
      signals: ["Guided ritual", "Spatial precision", "Memory-driven"],
      signalDomain: "Service Philosophy",
      note: "Accessible only by boat. Rooms designed around the river sounds. Service remembers everything",
    },
    {
      name: "Can Ferrereta",
      location: "Mallorca, Spain",
      score: 87,
      signals: ["Natural pool", "Courtyard-centered", "Village-scale"],
      signalDomain: "Location & Context",
      note: "A 17th-century estate woven into Santanyí village — the natural pool is carved from the original cistern",
    },
  ] as CollectionPlace[],
};

// ── Stretch Pick ──
export const STRETCH_PICK = {
  name: "Asador Etxebarri",
  location: "Atxondo, Basque Country",
  score: 74,
  type: "restaurant",
  strongAxis: "Sensory",
  strongScore: 97,
  weakAxis: "Social",
  weakScore: 28,
  why: "Your Sensory axis is 85% but this could crack it wide open. Etxebarri is a single-minded obsession with fire — every course, including dessert, touches the grill. It's the kind of place that permanently recalibrates what you think flavor can be.",
  tension: "It breaks your 'urban-walkable' signal (it's a 40-minute drive into the Basque hills) but the valley setting and zero pretension create the intimacy your profile craves.",
};

// ── Context Mode recs ──
export const SUMMER_RECS: ContextRec[] = [
  {
    name: "Can Ferrereta",
    location: "Mallorca, Spain",
    score: 87,
    whyFits: "Natural pool carved from stone, courtyard dining under fig trees",
  },
  {
    name: "Masseria Moroseta",
    location: "Puglia, Italy",
    score: 97,
    whyFits: "Outdoor breakfast terrace, grove walks, open-air rooftop at dusk",
  },
  {
    name: "Belmond Grand Hotel Timeo",
    location: "Taormina, Sicily",
    score: 84,
    whyFits: "Terrace overlooking Etna, poolside lunch, evening passeggiata",
  },
];

// ── Mood Boards ──
export const MOOD_BOARDS: MoodBoard[] = [
  {
    mood: "When you need to disappear",
    description: "Total sensory retreat — no decisions, no noise, just air and light.",
    color: "#4a6b8b",
    places: [
      { name: "Forestis", location: "Dolomites, Italy", vibe: "Alpine silence at 1,800m", score: 94 },
      { name: "Hoshinoya Kyoto", location: "Kyoto, Japan", vibe: "River sounds, paper walls", score: 89 },
      { name: "Amangiri", location: "Canyon Point, Utah", vibe: "Desert emptiness as design", score: 82 },
    ],
  },
  {
    mood: "When you want to eat your way through a city",
    description: "Walkable neighborhoods with your kind of places on every corner.",
    color: "#8b4a4a",
    places: [
      { name: "11th Arrondissement", location: "Paris, France", vibe: "Natural wine, no-choice menus", score: 91 },
      { name: "Södermalm", location: "Stockholm, Sweden", vibe: "Third-wave coffee, open sandwiches", score: 88 },
      { name: "Roma Norte", location: "Mexico City, Mexico", vibe: "Mezcal bars, street food, roof terraces", score: 85 },
    ],
  },
];

// ── Deep Match ──
export const DEEP_MATCH: DeepMatch = {
  name: "Masseria Moroseta",
  location: "Puglia, Italy",
  score: 97,
  headline: "This place was made for the way you travel.",
  signalBreakdown: [
    { signal: "Vernacular modern", domain: "Design Language", strength: 98, note: "Local tufa stone, contemporary proportions — architecture rooted in place" },
    { signal: "Communal dinner", domain: "Food & Drink", strength: 95, note: "One long table, farm-sourced menu, everyone eats together" },
    { signal: "Morning light (golden)", domain: "Design Language", strength: 97, note: "East-facing rooms, the stone glows amber at breakfast" },
    { signal: "Owner-operated", domain: "Service Philosophy", strength: 94, note: "The owner greets you. Staff are neighbors. Nothing is scripted." },
    { signal: "Sleep-darkness-critical", domain: "Wellness & Body", strength: 90, note: "Heavy shutters, no light pollution — the Puglian countryside after dark" },
  ],
  tensionResolved: "Your contradiction of wanting quiet rooms AND lively dining? Here they're literally separated by architecture — stone walls for sleep, open-air courtyard for dinner.",
};

// ── Friends saving ──
export const FRIEND_SAVES: FriendSave[] = [
  {
    friendName: "James K.",
    friendInitial: "J",
    place: "Drop Coffee",
    location: "Södermalm, Stockholm",
    score: 74,
    type: "cafe",
    whyMatches: "Matches your Character axis — serious about extraction, zero pretension",
    color: "#4a6741",
  },
  {
    friendName: "Lizzie N.",
    friendInitial: "S",
    place: "Septime",
    location: "11th, Paris",
    score: 91,
    type: "restaurant",
    whyMatches: "Near-perfect Food & Drink alignment — natural wine, no-choice menu, intimate room",
    color: "#8b4a4a",
  },
  {
    friendName: "Marcus T.",
    friendInitial: "M",
    place: "Café de Flore",
    location: "Saint-Germain, Paris",
    score: 68,
    type: "cafe",
    whyMatches: "A stretch pick for you — more scene than substance, but the morning light is unmatched",
    color: "#4a6b8b",
  },
];
