/**
 * Accolade Display Taxonomy
 *
 * Maps the freeform `type` strings that come from the pipeline's
 * PlaceIntelligence.accolades JSON into structured display metadata
 * for the AccoladesSection component on the place detail page.
 *
 * Each recognized accolade gets: display label, chip label, icon,
 * accent color, category grouping, and optional URL template.
 */

import { COLOR } from './theme';

// ─── Category groupings for visual separation when 4+ accolades ───

export type AccoladeCategory = 'award' | 'guide' | 'membership' | 'certification';

export const ACCOLADE_CATEGORY_LABELS: Record<AccoladeCategory, string> = {
  award: 'Awards',
  guide: 'Guides & Lists',
  membership: 'Memberships',
  certification: 'Certifications',
};

export const ACCOLADE_CATEGORY_ORDER: AccoladeCategory[] = ['award', 'guide', 'membership', 'certification'];

// ─── Individual accolade definitions ───

export interface AccoladeDefinition {
  /** Full display name */
  label: string;
  /** Short label for chips (max ~20 chars) */
  chipLabel: string;
  /** Perriand icon name */
  icon: string;
  /** Accent color for chip background tint */
  accent: string;
  /** Category grouping */
  category: AccoladeCategory;
  /** Optional URL template — {value} replaced with accolade value */
  url?: string;
  /** Place types this accolade applies to. If omitted, applies to all. */
  placeTypes?: string[];
}

/**
 * Canonical accolade registry.
 *
 * Keys should match the `type` field from PlaceIntelligence.accolades.
 * The pipeline may produce slight variations (e.g. "michelin" vs "michelin_stars"),
 * so we also maintain ACCOLADE_ALIASES below for normalization.
 */
export const ACCOLADE_REGISTRY: Record<string, AccoladeDefinition> = {

  // ── Michelin Guide ──
  michelin_stars: {
    label: 'MICHELIN Stars',
    chipLabel: 'MICHELIN',
    icon: 'star',
    accent: '#c4002b', // Michelin red
    category: 'guide',
    url: 'https://guide.michelin.com',
    placeTypes: ['restaurant'],
  },
  michelin_bib: {
    label: 'MICHELIN Bib Gourmand',
    chipLabel: 'Bib Gourmand',
    icon: 'star',
    accent: '#c4002b',
    category: 'guide',
    url: 'https://guide.michelin.com',
    placeTypes: ['restaurant'],
  },
  michelin_green: {
    label: 'MICHELIN Green Star',
    chipLabel: 'Green Star',
    icon: 'sparkle',
    accent: '#1a7a3a',
    category: 'guide',
    url: 'https://guide.michelin.com',
    placeTypes: ['restaurant'],
  },
  michelin_keys: {
    label: 'MICHELIN Keys',
    chipLabel: 'MICHELIN Key',
    icon: 'star',
    accent: '#c4002b',
    category: 'guide',
    url: 'https://guide.michelin.com',
    placeTypes: ['hotel'],
  },

  // ── World's Best Lists ──
  worlds_50_best_restaurants: {
    label: "World's 50 Best Restaurants",
    chipLabel: "50 Best",
    icon: 'sparkle',
    accent: COLOR.ochre,
    category: 'award',
    url: 'https://www.theworlds50best.com/list/1-50',
    placeTypes: ['restaurant'],
  },
  worlds_50_best: {
    label: "World's 50 Best Hotels",
    chipLabel: "50 Best Hotels",
    icon: 'sparkle',
    accent: COLOR.ochre,
    category: 'award',
    url: 'https://www.theworlds50best.com/hotels',
    placeTypes: ['hotel'],
  },
  worlds_best_bars: {
    label: "World's 50 Best Bars",
    chipLabel: "50 Best Bars",
    icon: 'sparkle',
    accent: COLOR.ochre,
    category: 'award',
    url: 'https://www.theworlds50best.com/bars',
    placeTypes: ['bar'],
  },

  // ── Condé Nast Traveler ──
  cn_gold: {
    label: 'Condé Nast Traveler Gold List',
    chipLabel: 'CN Gold List',
    icon: 'sparkle',
    accent: '#b8860b', // dark goldenrod
    category: 'guide',
    url: 'https://www.cntraveler.com/gold-list',
    placeTypes: ['hotel'],
  },
  cn_hot: {
    label: 'Condé Nast Traveler Hot List',
    chipLabel: 'CN Hot List',
    icon: 'sparkle',
    accent: '#e85d3a',
    category: 'guide',
    url: 'https://www.cntraveler.com/hot-list',
    placeTypes: ['hotel', 'restaurant'],
  },

  // ── James Beard ──
  james_beard: {
    label: 'James Beard Award',
    chipLabel: 'James Beard',
    icon: 'sparkle',
    accent: COLOR.coral,
    category: 'award',
    url: 'https://www.jamesbeard.org/awards',
    placeTypes: ['restaurant', 'bar'],
  },

  // ── Eater ──
  eater_38: {
    label: 'Eater 38',
    chipLabel: 'Eater 38',
    icon: 'pin',
    accent: '#e4002b',
    category: 'guide',
    url: 'https://www.eater.com',
  },
  eater_heatmap: {
    label: 'Eater Heatmap',
    chipLabel: 'Eater Heatmap',
    icon: 'sparkle',
    accent: '#e4002b',
    category: 'guide',
    url: 'https://www.eater.com',
  },
  eater_bar: {
    label: 'Eater Best Bars',
    chipLabel: 'Eater Bars',
    icon: 'pin',
    accent: '#e4002b',
    category: 'guide',
  },
  eater_cafe: {
    label: 'Eater Best Cafes',
    chipLabel: 'Eater Cafes',
    icon: 'pin',
    accent: '#e4002b',
    category: 'guide',
  },

  // ── Travel + Leisure ──
  tl_best: {
    label: 'Travel + Leisure Best Hotels',
    chipLabel: 'T+L Best',
    icon: 'sparkle',
    accent: COLOR.navy,
    category: 'guide',
    placeTypes: ['hotel'],
  },
  tl_it_list: {
    label: 'Travel + Leisure It List',
    chipLabel: 'T+L It List',
    icon: 'sparkle',
    accent: COLOR.navy,
    category: 'guide',
    placeTypes: ['hotel'],
  },

  // ── Forbes ──
  forbes: {
    label: 'Forbes Travel Guide 5-Star',
    chipLabel: 'Forbes 5-Star',
    icon: 'star',
    accent: COLOR.navy,
    category: 'guide',
    placeTypes: ['hotel'],
  },

  // ── TIME ──
  time_greatest: {
    label: "TIME World's Greatest Places",
    chipLabel: 'TIME Greatest',
    icon: 'pin',
    accent: '#e4002b',
    category: 'guide',
  },

  // ── La Liste ──
  la_liste: {
    label: 'La Liste',
    chipLabel: 'La Liste',
    icon: 'sparkle',
    accent: COLOR.navy,
    category: 'guide',
    url: 'https://laliste.com/en',
  },

  // ── OAD ──
  oad: {
    label: 'OAD Top Restaurants',
    chipLabel: 'OAD Top',
    icon: 'sparkle',
    accent: COLOR.navy,
    category: 'guide',
  },

  // ── NYT ──
  nyt_review: {
    label: 'New York Times Restaurant Review',
    chipLabel: 'NYT Review',
    icon: 'article',
    accent: '#1a1a1a',
    category: 'guide',
  },

  // ── Food & Wine / Bon Appétit ──
  food_wine_best: {
    label: 'Food & Wine Best New Restaurants',
    chipLabel: 'F&W Best New',
    icon: 'sparkle',
    accent: COLOR.coral,
    category: 'guide',
  },
  bon_appetit_hot: {
    label: 'Bon Appétit Hot 10',
    chipLabel: 'BA Hot 10',
    icon: 'sparkle',
    accent: '#e85d3a',
    category: 'guide',
  },

  // ── Design Awards ──
  wallpaper: {
    label: 'Wallpaper* Design Awards',
    chipLabel: 'Wallpaper*',
    icon: 'sparkle',
    accent: '#1a1a1a',
    category: 'award',
  },
  dezeen: {
    label: 'Dezeen Awards',
    chipLabel: 'Dezeen',
    icon: 'sparkle',
    accent: '#1a1a1a',
    category: 'award',
  },
  pritzker: {
    label: 'Pritzker Architecture Prize',
    chipLabel: 'Pritzker',
    icon: 'sparkle',
    accent: COLOR.ochre,
    category: 'award',
  },

  // ── Bar Awards ──
  tales_spirited: {
    label: 'Tales of the Cocktail Spirited Awards',
    chipLabel: 'Spirited Awards',
    icon: 'sparkle',
    accent: COLOR.ochre,
    category: 'award',
    placeTypes: ['bar'],
  },
  diffords: {
    label: "Difford's Guide Top Bars",
    chipLabel: "Difford's",
    icon: 'sparkle',
    accent: COLOR.navy,
    placeTypes: ['bar'],
    category: 'guide',
  },

  // ── Time Out ──
  time_out_love: {
    label: 'Time Out Love List',
    chipLabel: 'Time Out Love',
    icon: 'heart',
    accent: '#e4002b',
    category: 'guide',
  },

  // ── Museums & Culture ──
  european_museum: {
    label: 'European Museum of the Year',
    chipLabel: 'Museum of the Year',
    icon: 'sparkle',
    accent: COLOR.ochre,
    category: 'award',
  },
  aia_architecture: {
    label: 'AIA Architecture Awards',
    chipLabel: 'AIA Award',
    icon: 'sparkle',
    accent: COLOR.navy,
    category: 'award',
  },
  unesco: {
    label: 'UNESCO World Heritage Site',
    chipLabel: 'UNESCO',
    icon: 'pin',
    accent: '#0077c8',
    category: 'award',
  },
  nat_geo: {
    label: 'National Geographic Best Of',
    chipLabel: 'Nat Geo',
    icon: 'pin',
    accent: '#ffcc00',
    category: 'guide',
  },
  atlas_obscura: {
    label: 'Atlas Obscura',
    chipLabel: 'Atlas Obscura',
    icon: 'pin',
    accent: '#1a1a1a',
    category: 'guide',
  },

  // ── Hotel Memberships ──
  relais_chateaux: {
    label: 'Relais & Châteaux',
    chipLabel: 'Relais & Châteaux',
    icon: 'star',
    accent: '#8b0000',
    category: 'membership',
    placeTypes: ['hotel', 'restaurant'],
  },
  slh: {
    label: 'Small Luxury Hotels',
    chipLabel: 'SLH',
    icon: 'star',
    accent: COLOR.navy,
    category: 'membership',
    placeTypes: ['hotel'],
  },
  lhw: {
    label: 'The Leading Hotels of the World',
    chipLabel: 'LHW',
    icon: 'star',
    accent: COLOR.navy,
    category: 'membership',
    placeTypes: ['hotel'],
  },
  design_hotels: {
    label: 'Design Hotels',
    chipLabel: 'Design Hotels',
    icon: 'star',
    accent: '#1a1a1a',
    category: 'membership',
    placeTypes: ['hotel'],
  },
  mr_mrs_smith: {
    label: 'Mr & Mrs Smith',
    chipLabel: 'Mr & Mrs Smith',
    icon: 'heart',
    accent: COLOR.coral,
    category: 'membership',
    placeTypes: ['hotel'],
  },
  tablet_hotels: {
    label: 'Tablet Hotels',
    chipLabel: 'Tablet',
    icon: 'star',
    accent: COLOR.navy,
    category: 'membership',
    placeTypes: ['hotel'],
  },

  // ── Retail ──
  monocle: {
    label: 'Monocle Top Retail',
    chipLabel: 'Monocle',
    icon: 'sparkle',
    accent: '#1a1a1a',
    category: 'guide',
  },
  robb_report: {
    label: 'Robb Report Best Of',
    chipLabel: 'Robb Report',
    icon: 'sparkle',
    accent: COLOR.navy,
    category: 'guide',
  },

  // ── Sustainability Certifications ──
  green_key: {
    label: 'Green Key',
    chipLabel: 'Green Key',
    icon: 'sparkle',
    accent: '#1a7a3a',
    category: 'certification',
  },
  leed: {
    label: 'LEED Certified',
    chipLabel: 'LEED',
    icon: 'sparkle',
    accent: '#1a7a3a',
    category: 'certification',
  },
  b_corp: {
    label: 'Certified B Corp',
    chipLabel: 'B Corp',
    icon: 'sparkle',
    accent: '#1a7a3a',
    category: 'certification',
  },
};

/**
 * Aliases: map variant type strings from the pipeline to canonical keys.
 * The pipeline may produce "michelin" for stars, "award" for generic, etc.
 */
export const ACCOLADE_ALIASES: Record<string, string> = {
  michelin: 'michelin_stars',
  'michelin-stars': 'michelin_stars',
  'michelin-bib': 'michelin_bib',
  'michelin-bib-gourmand': 'michelin_bib',
  'michelin-green': 'michelin_green',
  'michelin-keys': 'michelin_keys',
  'michelin_key': 'michelin_keys',
  'worlds-50-best': 'worlds_50_best',
  'worlds-50-best-restaurants': 'worlds_50_best_restaurants',
  'worlds-50-best-bars': 'worlds_best_bars',
  'worlds-best-bars': 'worlds_best_bars',
  '50-best': 'worlds_50_best_restaurants',
  'conde-nast-gold': 'cn_gold',
  'conde-nast-hot': 'cn_hot',
  'cn-gold-list': 'cn_gold',
  'cn-hot-list': 'cn_hot',
  'james-beard': 'james_beard',
  'eater-38': 'eater_38',
  'eater-heatmap': 'eater_heatmap',
  'eater-bar': 'eater_bar',
  'eater-cafe': 'eater_cafe',
  'la-liste': 'la_liste',
  'nyt-review': 'nyt_review',
  'food-wine': 'food_wine_best',
  'bon-appetit': 'bon_appetit_hot',
  'time-greatest': 'time_greatest',
  'time-out': 'time_out_love',
  'time-out-love': 'time_out_love',
  'design-hotels': 'design_hotels',
  'relais-chateaux': 'relais_chateaux',
  'green-key': 'green_key',
  'b-corp': 'b_corp',
};

/** Default definition for unrecognized accolade types */
export const ACCOLADE_FALLBACK: AccoladeDefinition = {
  label: 'Award',
  chipLabel: 'Award',
  icon: 'sparkle',
  accent: COLOR.ochre,
  category: 'award',
};

/**
 * Resolve an accolade's `type` string to its display definition.
 * Tries direct lookup, then alias lookup, then falls back to generic.
 */
export function resolveAccolade(type: string): AccoladeDefinition {
  // Direct match
  if (ACCOLADE_REGISTRY[type]) return ACCOLADE_REGISTRY[type];
  // Alias match
  const alias = ACCOLADE_ALIASES[type];
  if (alias && ACCOLADE_REGISTRY[alias]) return ACCOLADE_REGISTRY[alias];
  // Normalize: lowercase, replace hyphens with underscores
  const normalized = type.toLowerCase().replace(/-/g, '_');
  if (ACCOLADE_REGISTRY[normalized]) return ACCOLADE_REGISTRY[normalized];
  // Fallback
  return ACCOLADE_FALLBACK;
}
