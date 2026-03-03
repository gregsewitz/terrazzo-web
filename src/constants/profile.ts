// ═══════════════════════════════════════════════════════════════════
// Taste Profile — Static demo data (ported from terrazzo-app)
// ═══════════════════════════════════════════════════════════════════

import { T, PerriandIconName } from '@/types';

export interface TasteProfile {
  overallArchetype: string;
  archetypeDescription: string;
  emotionalDriver: {
    primary: string;
    description: string;
    secondary: string;
  };
  contradictions: Array<{
    stated: string;
    revealed: string;
    resolution: string;
    matchRule: string;
  }>;
  contextModifiers: Array<{
    context: string;
    shifts: string;
  }>;
  microTasteSignals: Record<string, string[]>;
  radarData: Array<{ axis: string; value: number }>;
  matchedProperties: Array<{
    name: string;
    location: string;
    score: number;
    matchReasons: string[];
    tensionResolved: string;
  }>;
}

export const TASTE_PROFILE: TasteProfile = {
  overallArchetype: "The Aesthetic Pilgrim",
  archetypeDescription: "You travel to expand your sense of what's possible — in design, in food, in how life can be lived. You seek places built by people with a point of view, not a business plan. Your taste is precise but not rigid: you want warmth in your minimalism, chaos in your wine bars, and silence in your bedrooms.",
  emotionalDriver: {
    primary: "Aesthetic Expansion",
    description: "Travel rewires your aesthetic. You come home with new influences — a ceramic style, an ingredient, a spatial idea. The best trips change how you see the world.",
    secondary: "Sensory Presence",
  },
  contradictions: [
    {
      stated: "Loves quiet, intimate spaces",
      revealed: "Thrives in chaotic wine bars and buzzy food scenes",
      resolution: "Sleep environment = sanctuary. Dining/drinking = warm chaos welcomed.",
      matchRule: "Score hotels on room tranquility. Score neighborhoods on F&B energy. Optimize both independently."
    },
    {
      stated: "Drawn to minimalism and restraint",
      revealed: "Loved a maximalist masseria with layered ceramics and textiles",
      resolution: "Definition of 'minimal' = intentional, not sparse. Every object belongs. Density is fine if curated.",
      matchRule: "Match on curation philosophy, not object count."
    },
    {
      stated: "Wants to be left alone / low-key check-in",
      revealed: "Loved the Kyoto owner who remembered breakfast preferences and sat at dinner",
      resolution: "Initiative without intrusion. Remember silently. Respond to cues, don't anticipate with gestures.",
      matchRule: "Prioritize owner-operated properties with memory-driven service, not butler/concierge models."
    }
  ],
  contextModifiers: [
    { context: "With partner", shifts: "Romance, beauty, quiet, design-forward. Shared aesthetic experiences." },
    { context: "With friends", shifts: "Walkability, restaurant proximity, lively neighborhood. Hotel is a base." },
    { context: "Solo", shifts: "Total solitude, nature, zero social pressure. Full retreat." },
    { context: "Recharge", shifts: "Full-service, on-site everything, zero decisions. Cocoon." },
    { context: "Winter", shifts: "Enclosed warmth: fireplaces, heavy textiles, small windows." },
    { context: "Summer", shifts: "Indoor-outdoor flow, open air, terrace dining, natural pool." },
  ],
  microTasteSignals: {
    "Design": ["Neo-rustic refined", "Vernacular modern", "Curated density", "Anti-performative", "Wabi-sabi warmth", "Raw stone (warm)", "Artisan ceramics", "Morning light (golden)"],
    "Atmosphere": ["Intimate-under-20", "Communal-table-seeker", "Warm chaos welcomed", "Slow morning energy", "Quiet-after-dark", "Ceremony-curious", "Anti-mega-resort"],
    "Character": ["Staff-knows-your-name", "Cultural-immersion-seeker", "Artisan-economy-supporter", "Anti-tourist-version", "Owner-story-matters", "Place-has-a-point-of-view"],
    "Service": ["Staff-as-host", "Initiative without intrusion", "Memory-driven", "Owner-operated", "Anti-butler"],
    "FoodDrink": ["Farm-to-table-driven", "Communal dinner (long table)", "Aperitivo culture", "Natural wine devotee", "Breakfast-sacred"],
    "Setting": ["Village-scale", "Walkable radius", "Courtyard-centered", "Indoor-outdoor flow", "Hotel-as-destination"],
    "Wellness": ["Temperature-precise", "Natural pool preference", "Fresh-air-obsessive", "Sleep-darkness-critical", "Barefoot preference"],
    "Sustainability": ["Artisan-economy-supporter", "Local-supply-chain", "Anti-greenwash", "Seasonal-only-menu", "Adaptive-reuse-architecture"],
    "Rejection": ["Anti-Instagram aesthetic", "Anti-scripted service", "Anti-resort pool", "Anti-QR-code dining", "Anti-marble-lobby"],
  },
  radarData: [
    { axis: "Design", value: 0.92 },
    { axis: "Atmosphere", value: 0.78 },
    { axis: "Character", value: 0.95 },
    { axis: "Service", value: 0.88 },
    { axis: "FoodDrink", value: 0.80 },
    { axis: "Setting", value: 0.85 },
    { axis: "Wellness", value: 0.72 },
    { axis: "Sustainability", value: 0.65 },
  ],
  matchedProperties: [
    {
      name: "Masseria Moroseta", location: "Puglia, Italy", score: 97,
      matchReasons: ["Vernacular architecture", "Artisan ceramics", "Communal outdoor dining", "Morning light"],
      tensionResolved: "Quiet rooms + lively communal dinner = both satisfied"
    },
    {
      name: "Forestis", location: "Dolomites, Italy", score: 94,
      matchReasons: ["Neo-rustic refined", "Natural materials (larch)", "View-driven rooms", "Staff-as-host"],
      tensionResolved: "Minimal design + material richness = curated density"
    },
    {
      name: "Ett Hem", location: "Stockholm, Sweden", score: 92,
      matchReasons: ["Curated density", "Domestic atmosphere", "Personal service", "Design-for-living"],
      tensionResolved: "Maximalist space but anti-performative = your kind of density"
    },
    {
      name: "Hoshinoya Kyoto", location: "Kyoto, Japan", score: 89,
      matchReasons: ["Guided ritual", "Spatial precision", "Nature-immersive", "Memory-driven service"],
      tensionResolved: "Context-adapted: structure welcomed in unfamiliar culture"
    },
    {
      name: "Can Ferrereta", location: "Mallorca, Spain", score: 87,
      matchReasons: ["Mediterranean organic", "Natural pool", "Courtyard-centered", "Village integration"],
      tensionResolved: "Solo/recharge context: full cocoon + walkable village"
    },
  ]
};

export const WRAPPED = {
  totalSignals: 238,
  tensions: 3,
  contextModes: 6,
  rejections: 7,
  vocabTerms: 35,
  rarestSignal: "Distinguishes cocooned domestic quiet from hushed ceremonial quiet",
  rarestPercent: 4,
};

// Domain colors for profile deep-dive sections (muted earth-tone variants)
// NOTE: These are intentionally different from DOMAIN_COLORS in types/index.ts —
// those map the TasteDomain keys to vibrant brand colors for UI accents.
// These map to muted earth-tones for profile section backgrounds.
export const DIMENSION_COLORS: Record<string, string> = {
  "Design": "#8b6b4a",
  "Atmosphere": "#a06830",
  "Character": "#4a6741",
  "Service": "#6b8b4a",
  "FoodDrink": "#8b4a4a",
  "Setting": "#4a6b8b",
  "Wellness": "#6b6b4a",
  "Sustainability": "#4a7a8b",
  "Rejection": "#8b4a4a",
};

export const AXIS_COLORS: Record<string, string> = {
  Design: T.honey,
  Atmosphere: T.pantonOrange,
  Character: T.signalRed,
  Service: T.chromeYellow,
  FoodDrink: T.pantonViolet,
  Setting: T.verde,
  Wellness: T.pantonOrange,
  Sustainability: T.ghost,
};

export const CONTEXT_ICONS: Record<string, PerriandIconName> = {
  "With partner": "heart",
  "With friends": "friend",
  "Solo": "profile",
  "Recharge": "wellness",
  "Winter": "evening",
  "Summer": "summer",
};

export const CONTEXT_COLORS = ["#8b6b4a", "#4a6741", "#4a6b8b", "#6b6b4a", "#6b8b4a", "#8b4a4a"];
