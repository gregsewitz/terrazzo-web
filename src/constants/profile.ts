// ═══════════════════════════════════════════════════════════════════
// Taste Profile — Static demo data (ported from terrazzo-app)
// ═══════════════════════════════════════════════════════════════════

import { PerriandIconName } from '@/types';

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
    "Design Language": ["Neo-rustic refined", "Vernacular modern", "Curated density", "Anti-performative", "Wabi-sabi warmth", "Raw stone (warm)", "Artisan ceramics", "Morning light (golden)"],
    "Character & Identity": ["Intimate-under-20", "Staff-knows-your-name", "Communal-table-seeker", "Cultural-immersion-seeker", "Ceremony-curious", "Artisan-economy-supporter", "Anti-mega-resort", "Anti-tourist-version"],
    "Service Philosophy": ["Staff-as-host", "Initiative without intrusion", "Memory-driven", "Owner-operated", "Anti-butler"],
    "Food & Drink": ["Farm-to-table-driven", "Communal dinner (long table)", "Aperitivo culture", "Natural wine devotee", "Breakfast-sacred"],
    "Location & Context": ["Village-scale", "Walkable radius", "Courtyard-centered", "Indoor-outdoor flow", "Hotel-as-destination"],
    "Wellness & Body": ["Temperature-precise", "Natural pool preference", "Fresh-air-obsessive", "Sleep-darkness-critical", "Barefoot preference"],
    "Rejection": ["Anti-Instagram aesthetic", "Anti-scripted service", "Anti-resort pool", "Anti-QR-code dining", "Anti-marble-lobby"],
  },
  radarData: [
    { axis: "Sensory", value: 0.92 },
    { axis: "Authenticity", value: 0.95 },
    { axis: "Material", value: 0.88 },
    { axis: "Social", value: 0.72 },
    { axis: "Cultural", value: 0.80 },
    { axis: "Spatial", value: 0.85 },
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

// Domain color mapping used across profile components
export const DOMAIN_COLORS: Record<string, string> = {
  "Design Language": "#8b6b4a",
  "Character & Identity": "#4a6741",
  "Service Philosophy": "#6b8b4a",
  "Food & Drink": "#8b4a4a",
  "Location & Context": "#4a6b8b",
  "Wellness & Body": "#6b6b4a",
  "Rejection": "#8b4a4a",
};

export const AXIS_COLORS: Record<string, string> = {
  Sensory: "#c8923a",       // Honey — Chapo elmwood
  Authenticity: "#d63020",  // Signal Red — Perriand panel
  Material: "#eeb420",      // Chrome Yellow — Perriand panel
  Social: "#e86830",        // Panton Orange — Panton Chair
  Cultural: "#6844a0",      // Panton Violet — Panton interior
  Spatial: "#2a7a56",       // Verde — Barcelona marble
};

export const CONTEXT_ICONS: Record<string, PerriandIconName> = {
  "With partner": "partner",
  "With friends": "friends",
  "Solo": "solo",
  "Recharge": "family",
  "Winter": "winter",
  "Summer": "summer",
};

export const CONTEXT_COLORS = ["#8b6b4a", "#4a6741", "#4a6b8b", "#6b6b4a", "#6b8b4a", "#8b4a4a"];
