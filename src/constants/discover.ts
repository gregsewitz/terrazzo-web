// ═══════════════════════════════════════════════════════════════════
// Discover Feed — Hardcoded content for the "Terrazzo Knows Me" feed
// ═══════════════════════════════════════════════════════════════════

export interface BecauseYouCard {
  signal: string;
  signalDomain: string;
  place: string;
  location: string;
  score: number;
  why: string;
  bg: string;
}

export interface CollectionPlace {
  name: string;
  location: string;
  score: number;
  signals: string[];
  signalDomain: string;
  note: string;
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
}

export interface ContextRec {
  name: string;
  location: string;
  score: number;
  whyFits: string;
}

// ── Section 2: "Because You..." insight cards ──
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

// ── Section 4: "This Week's Edit" collection ──
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

// ── Section 5: Stretch Pick ──
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

// ── Section 6: Context Mode recs ──
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

// ── Section 8: Friends saving ──
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
    friendName: "Sarah L.",
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
