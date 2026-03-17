/**
 * Destination matching utilities for place-to-trip scoring.
 *
 * Pure functions (no React) for:
 * - Coordinate validation
 * - City/region alias resolution
 * - Compound destination splitting
 * - Adaptive geo-radius computation
 * - Token-based string matching
 * - Geo proximity scoring
 * - Place ID matching
 *
 * Extracted from usePicksFilter.ts for testability and reuse.
 */

import { distKm } from '@/lib/geo';
import type { ImportedPlace, GeoDestination } from '@/types';

// ─── Coordinate validation ───────────────────────────────────────────────────

/** Reject null-island (0,0) and out-of-range values */
export function validCoords(lat: number | undefined | null, lng: number | undefined | null): [number, number] | null {
  if (lat == null || lng == null) return null;
  if (lat === 0 && lng === 0) return null; // Null Island — data error
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

// ─── City / Region Alias Map ─────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string | string[]> = {
  // Abbreviations
  nyc: 'new york', cdmx: 'mexico city', la: 'los angeles', sf: 'san francisco',
  dc: 'washington', dtla: 'los angeles', bkk: 'bangkok', hk: 'hong kong',

  // Local-language names → English
  'københavn': 'copenhagen', firenze: 'florence', wien: 'vienna',
  praha: 'prague', 'münchen': 'munich', napoli: 'naples',
  'москва': 'moscow', 'köln': 'cologne', bruxelles: 'brussels',
  lisboa: 'lisbon', roma: 'rome', athina: 'athens', 'αθήνα': 'athens',
  '東京': 'tokyo', 'กรุงเทพฯ': 'bangkok',

  // NYC boroughs
  brooklyn: 'new york', manhattan: 'new york', queens: 'new york',
  bronx: 'new york', 'staten island': 'new york',

  // London boroughs / neighborhoods
  camden: 'london', shoreditch: 'london', hackney: 'london',
  mayfair: 'london', kensington: 'london',
  brixton: 'london', islington: 'london',
  'covent garden': 'london', notting: 'london', 'notting hill': 'london',
  fitzrovia: 'london', bermondsey: 'london', peckham: 'london',
  dalston: 'london', marylebone: 'london', whitechapel: 'london',

  // Multi-city neighborhoods — geo scoring resolves which is relevant
  soho: ['london', 'new york'],
  chelsea: ['london', 'new york'],
  richmond: ['london', 'san francisco'],

  // Paris neighborhoods
  montmartre: 'paris', 'le marais': 'paris', bastille: 'paris',
  belleville: 'paris', trocadero: 'paris', 'les halles': 'paris',
  'saint-germain': 'paris', pigalle: 'paris', oberkampf: 'paris',
  republique: 'paris', batignolles: 'paris', 'rive gauche': 'paris',
  arrondissement: 'paris',

  // Rome neighborhoods
  trastevere: 'rome', testaccio: 'rome', monti: 'rome',
  prati: 'rome', parioli: 'rome', esquilino: 'rome',

  // Berlin neighborhoods
  kreuzberg: 'berlin', mitte: 'berlin', 'prenzlauer berg': 'berlin',
  neukölln: 'berlin', charlottenburg: 'berlin', friedrichshain: 'berlin',
  schöneberg: 'berlin', tempelhof: 'berlin', moabit: 'berlin',

  // NYC neighborhoods (beyond boroughs)
  williamsburg: 'new york', dumbo: 'new york', tribeca: 'new york',
  'lower east side': 'new york', nolita: 'new york',
  bushwick: 'new york', 'park slope': 'new york', astoria: 'new york',
  harlem: 'new york', 'east village': 'new york', 'west village': 'new york',
  greenpoint: 'new york', 'red hook': 'new york',

  // San Francisco neighborhoods
  haight: 'san francisco', 'haight-ashbury': 'san francisco',
  mission: 'san francisco', castro: 'san francisco',
  'north beach': 'san francisco', soma: 'san francisco',
  'nob hill': 'san francisco',
  'pacific heights': 'san francisco', dogpatch: 'san francisco',

  // Stockholm neighborhoods
  'södermalm': 'stockholm', 'östermalm': 'stockholm',
  vasastan: 'stockholm', kungsholmen: 'stockholm',
  'gamla stan': 'stockholm', norrmalm: 'stockholm', djurgården: 'stockholm',

  // Copenhagen neighborhoods
  'nørrebro': 'copenhagen', 'østerbro': 'copenhagen',
  vesterbro: 'copenhagen', frederiksberg: 'copenhagen',
  christianshavn: 'copenhagen', amager: 'copenhagen',

  // Tokyo wards
  'shibuya-ku': 'tokyo', 'shinjuku-ku': 'tokyo', 'minato-ku': 'tokyo',
  'chiyoda-ku': 'tokyo', 'meguro-ku': 'tokyo', 'setagaya-ku': 'tokyo',
  shibuya: 'tokyo', shinjuku: 'tokyo', roppongi: 'tokyo', ginza: 'tokyo',
  harajuku: 'tokyo', asakusa: 'tokyo', akihabara: 'tokyo',
};

function resolveAlias(s: string): string[] {
  const lower = s.toLowerCase().trim();
  const hit = CITY_ALIASES[lower]
    ?? (lower.endsWith('-ku') ? CITY_ALIASES[lower.slice(0, -3)] : undefined);
  if (!hit) return [lower];
  return Array.isArray(hit) ? hit : [hit];
}

// ─── Compound destination splitting ──────────────────────────────────────────

export function splitCompoundDestination(dest: string): string[] {
  return dest
    .split(/\s*[\/&]\s*|,\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\s*\(.*?\)\s*$/, '').trim())
    .filter(s => s.length > 0);
}

// ─── Vague location stripping ────────────────────────────────────────────────

const VAGUE_PREFIX = /^(?:near|outside|around|close to|just (?:outside|off)|about\s+\d+\s+(?:hours?|hrs?|minutes?|mins?|km|miles?)\s+(?:from|to|outside))\s+/i;
const VAGUE_SUFFIX = /\s+(?:area|region|vicinity|surroundings|outskirts)$/i;
const GREATER_PREFIX = /^greater\s+/i;

function stripVagueQualifiers(s: string): string {
  let cleaned = s.trim();
  cleaned = cleaned.replace(VAGUE_PREFIX, '');
  cleaned = cleaned.replace(VAGUE_SUFFIX, '');
  cleaned = cleaned.replace(GREATER_PREFIX, '');
  return cleaned.trim();
}

// ─── Adaptive radius ─────────────────────────────────────────────────────────

export const URBAN_CORE_KM = 18;
export const REGIONAL_CORE_KM = 55;
export const TAPER_RATIO = 1.6;

const KNOWN_REGIONS = /\b(cotswolds|tuscany|provence|burgundy|champagne|alsace|dordogne|algarve|cinque terre|amalfi|capri|lake district|peak district|loire|costa brava|dalmatian|patagonia|basque country|black forest|bavari|normand|sicily|sardinia|crete|peloponnese|hokkaido|okinawa|bali|rajasthan|tulum|yucatan|napa|hamptons|cape cod|finger lakes|big sur|outer banks|ozarks|blue ridge|new forest|yorkshire dales|scottish highlands|wye valley|hunter valley|barossa|yarra valley|alentejo|douro|istria|puglia|apulia|umbria|piedmont|piemonte|lofoten|kruger|sabi sand|limpopo|masai mara|maasai mara|serengeti|southern utah|catskills|berkshires|sonoma|cape winelands|stellenbosch|franschhoek|kerala|backwaters|queenstown|milford sound|fiordland|napa valley)\b/i;

const REGION_HINTS = /\b(coast|valley|region|island|islands|lake|lakes|countryside|hills|highlands|mountains|riviera|peninsula|province|county|shire|prefecture|district|national park|safari|reserve|game reserve)\b/i;

const RADIUS_OVERRIDES: Array<[RegExp, number]> = [
  // Compact regions
  [/\bcinque terre\b/i, 20],
  [/\bamalfi\b/i, 30],
  [/\bcapri\b/i, 15],
  // Expanded urban
  [/\breykjavik\b/i, 40],
  [/\blos angeles\b/i, 28],
  [/\bcopenhagen\b/i, 25],
  [/\bberlin\b/i, 25],
  [/\blondon\b/i, 38],
  [/\bdubai\b/i, 60],
  [/\bphuket\b/i, 50],
  // Oversized regions
  [/\bkruger|sabi sand|limpopo\b/i, 150],
  [/\bscottish highlands|highlands of scotland\b/i, 120],
  [/\bsouthern utah\b/i, 130],
  [/\blofoten\b/i, 90],
  [/\bmasai mara|maasai mara\b/i, 80],
  [/\bserengeti\b/i, 100],
  [/\brajasthan\b/i, 200],
  [/\bgreek islands\b/i, 200],
  [/\bmaldives\b/i, 300],
  [/\bmaui\b/i, 50],
  [/\bhawaii\b/i, 160],
  [/\bsicily\b/i, 130],
  [/\bprovence\b/i, 80],
  [/\btuscany\b/i, 75],
  [/\bpatagonia\b/i, 200],
  [/\bhokkaido\b/i, 130],
];

function isRegionalDestination(geo: GeoDestination): boolean {
  const addr = geo.formattedAddress || '';
  const name = geo.name || '';
  if (REGION_HINTS.test(name) || REGION_HINTS.test(addr)) return true;
  if (KNOWN_REGIONS.test(name) || KNOWN_REGIONS.test(addr)) return true;
  const segments = addr.split(',').map(s => s.trim());
  if (segments.length >= 2) {
    const firstName = segments[0].toLowerCase();
    const destName = name.toLowerCase();
    if (!firstName.includes(destName) && !destName.includes(firstName)) return true;
  }
  return false;
}

export function coreRadiusForDestination(geo: GeoDestination | null): number {
  if (!geo) return URBAN_CORE_KM;
  const name = geo.name || '';
  for (const [pattern, radius] of RADIUS_OVERRIDES) {
    if (pattern.test(name)) return radius;
  }
  return isRegionalDestination(geo) ? REGIONAL_CORE_KM : URBAN_CORE_KM;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeoAnchor {
  lat: number;
  lng: number;
  coreKm: number;
  outerKm: number;
  weight: number;
}

// ─── Tokenization & string matching ──────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'of', 'in', 'at', 'and', 'on', 'to', 'for',
  'de', 'di', 'da', 'la', 'le', 'les', 'du', 'des', 'el', 'lo', 'los', 'las',
  'city', 'greater', 'area', 'region', 'district', 'province', 'state',
  'county', 'borough', 'town', 'village',
  'near', 'outside', 'around', 'about', 'from', 'hours', 'hrs',
  'km', 'miles', 'minutes', 'mins',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
    .filter(t => !STOP_WORDS.has(t));
}

function resolveTokenAliases(tokens: string[]): string[] {
  const resolved = new Set<string>(tokens);

  const addAlias = (alias: string) => {
    resolved.add(alias);
    if (alias.includes(' ')) {
      for (const part of alias.split(/\s+/)) {
        if (part.length > 1) resolved.add(part);
      }
    }
  };

  const tryResolve = (input: string) => {
    const aliases = resolveAlias(input);
    if (aliases.length === 1 && aliases[0] === input) return;
    for (const a of aliases) addAlias(a);
  };

  for (const t of tokens) tryResolve(t);
  for (let i = 0; i < tokens.length - 1; i++) {
    tryResolve(`${tokens[i]} ${tokens[i + 1]}`);
  }
  for (let i = 0; i < tokens.length - 2; i++) {
    tryResolve(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  return [...resolved];
}

/**
 * Token-overlap score between a place's location and a destination name.
 *
 * Returns:
 *  0.7 — all tokens of a sub-destination match exactly
 *  0.5 — all match via substring containment (4+ chars)
 *  0   — no sub-destination fully matches
 */
export function tokenMatchScore(placeLocation: string, destinationName: string): number {
  const cleanedLoc = stripVagueQualifiers(placeLocation);
  const placeTokens = resolveTokenAliases(tokenize(cleanedLoc));
  if (placeTokens.length === 0) return 0;

  const subDests = splitCompoundDestination(destinationName);
  let bestScore = 0;

  for (const subDest of subDests) {
    const destTokens = resolveTokenAliases(tokenize(subDest));
    if (destTokens.length === 0) continue;

    const allMatch = destTokens.every(dt =>
      placeTokens.some(pt =>
        pt === dt ||
        (pt.length >= 4 && dt.length >= 4 && (pt.includes(dt) || dt.includes(pt)))
      )
    );
    if (!allMatch) continue;

    const allExact = destTokens.every(dt => placeTokens.some(pt => pt === dt));
    const score = allExact ? 0.7 : 0.5;
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

// ─── Geo scoring ─────────────────────────────────────────────────────────────

export function geoScore(pLat: number, pLng: number, anchors: GeoAnchor[]): number {
  if (anchors.length === 0) return 0;
  let best = 0;
  for (const anchor of anchors) {
    const d = distKm(anchor.lat, anchor.lng, pLat, pLng);
    let score: number;
    if (d <= anchor.coreKm) {
      score = 1.0;
    } else if (d <= anchor.outerKm) {
      const t = (d - anchor.coreKm) / (anchor.outerKm - anchor.coreKm);
      score = 1.0 - t * 0.7;
    } else {
      score = 0;
    }
    score *= anchor.weight;
    if (score > best) best = score;
    if (best >= 1.0) return 1.0;
  }
  return best;
}

// ─── Place ID matching ───────────────────────────────────────────────────────

export function placeIdMatches(
  place: ImportedPlace,
  geoDestinations: GeoDestination[] | undefined,
): boolean {
  const pid = place.google?.placeId;
  if (!pid || !geoDestinations?.length) return false;
  return geoDestinations.some(g => g.placeId && g.placeId === pid);
}
