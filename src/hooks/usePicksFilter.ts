import { useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import type { ImportedPlace, GeoDestination } from '@/types';

// ─── Haversine distance (km) ───
export function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Coordinate validation ───
// Reject null-island (0,0) and out-of-range values
function validCoords(lat: number | undefined | null, lng: number | undefined | null): [number, number] | null {
  if (lat == null || lng == null) return null;
  if (lat === 0 && lng === 0) return null; // Null Island — data error
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

// ─── City / Region Alias Map ───
// Handles: local-language names, abbreviations, boroughs, wards, neighborhoods
// Key = lowercase alias, Value = canonical English city name
// Values can be a single city string or an array when a neighborhood exists
// in multiple cities (e.g. Soho is in both London and NYC). The resolver
// injects all candidates and lets geo scoring pick the right one.
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
  arrondissement: 'paris', // "1er arrondissement" → Paris

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

  // Tokyo wards (strip -ku suffix handled separately, but also direct map)
  'shibuya-ku': 'tokyo', 'shinjuku-ku': 'tokyo', 'minato-ku': 'tokyo',
  'chiyoda-ku': 'tokyo', 'meguro-ku': 'tokyo', 'setagaya-ku': 'tokyo',
  shibuya: 'tokyo', shinjuku: 'tokyo', roppongi: 'tokyo', ginza: 'tokyo',
  harajuku: 'tokyo', asakusa: 'tokyo', akihabara: 'tokyo',
};

// Resolve a single token or multi-word fragment against aliases.
// Returns an array of canonical names (may be >1 for multi-city neighborhoods).
// If no alias is found, returns `[original]`.
function resolveAlias(s: string): string[] {
  const lower = s.toLowerCase().trim();
  const hit = CITY_ALIASES[lower]
    ?? (lower.endsWith('-ku') ? CITY_ALIASES[lower.slice(0, -3)] : undefined);
  if (!hit) return [lower];
  return Array.isArray(hit) ? hit : [hit];
}

// ─── Compound destination splitting ───
// Splits "Noto / Syracuse", "Stockholm & Copenhagen",
// "Ubud / Seminyak / Canggu", "Lake Como, Bellagio & Tremezzo"
// into individual destination tokens.
function splitCompoundDestination(dest: string): string[] {
  return dest
    .split(/\s*[\/&]\s*|,\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    // Strip parenthetical qualifiers: "Paris (Left Bank)" → "Paris"
    .map(s => s.replace(/\s*\(.*?\)\s*$/, '').trim())
    .filter(s => s.length > 0);
}

// ─── Vague location stripping ───
// Remove noise prefixes/suffixes that block matching:
// "Near Serengeti" → "Serengeti", "Noto area" → "Noto",
// "Outside Copenhagen" → "Copenhagen", "Greater London" → "London",
// "About 2 hours from Marrakech" → "Marrakech"
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

// ─── Adaptive radius ───
const URBAN_CORE_KM = 18;
const REGIONAL_CORE_KM = 55;
const TAPER_RATIO = 1.6;

// Expanded KNOWN_REGIONS (from edge-case spreadsheet "Missing Regions" sheet)
const KNOWN_REGIONS = /\b(cotswolds|tuscany|provence|burgundy|champagne|alsace|dordogne|algarve|cinque terre|amalfi|capri|lake district|peak district|loire|costa brava|dalmatian|patagonia|basque country|black forest|bavari|normand|sicily|sardinia|crete|peloponnese|hokkaido|okinawa|bali|rajasthan|tulum|yucatan|napa|hamptons|cape cod|finger lakes|big sur|outer banks|ozarks|blue ridge|new forest|yorkshire dales|scottish highlands|wye valley|hunter valley|barossa|yarra valley|alentejo|douro|istria|puglia|apulia|umbria|piedmont|piemonte|lofoten|kruger|sabi sand|limpopo|masai mara|maasai mara|serengeti|southern utah|catskills|berkshires|sonoma|cape winelands|stellenbosch|franschhoek|kerala|backwaters|queenstown|milford sound|fiordland|napa valley)\b/i;

const REGION_HINTS = /\b(coast|valley|region|island|islands|lake|lakes|countryside|hills|highlands|mountains|riviera|peninsula|province|county|shire|prefecture|district|national park|safari|reserve|game reserve)\b/i;

// Destination-specific radius overrides.
// Handles BOTH oversized regions (bigger than 55km default) AND compact
// regions (smaller than 55km default) AND expanded urban areas.
// Checked first — takes priority over isRegionalDestination heuristic.
const RADIUS_OVERRIDES: Array<[RegExp, number]> = [
  // ── Compact regions (smaller than default 55km) ──
  // Cinque Terre: 5 villages spanning ~12km of coast. 55km would swallow
  // Portofino, La Spezia, and half the Ligurian coast. 20km covers the
  // actual 5 Terre plus immediate surroundings.
  [/\bcinque terre\b/i, 20],
  // Amalfi Coast: ~50km of coastline. 30km from a mid-point anchor covers it.
  [/\bamalfi\b/i, 30],
  // Capri: tiny island, 6km across.
  [/\bcapri\b/i, 15],

  // ── Expanded urban (wider than default 18km) ──
  // Reykjavik: Blue Lagoon at 37km is THE canonical day activity.
  // Spreadsheet recommends 40km.
  [/\breykjavik\b/i, 40],
  // Los Angeles: massive sprawl. Malibu=30km, Santa Monica=20km.
  [/\blos angeles\b/i, 28],
  // Copenhagen: Louisiana Museum at 35km is a top attraction.
  [/\bcopenhagen\b/i, 25],
  // Berlin: Potsdam at 26km is a major day trip.
  [/\bberlin\b/i, 25],

  // ── Oversized regions (bigger than default 55km) ──
  [/\bkruger|sabi sand|limpopo\b/i, 150],
  [/\bscottish highlands|highlands of scotland\b/i, 120],
  [/\bsouthern utah\b/i, 130],
  [/\blofoten\b/i, 90],
  [/\bmasai mara|maasai mara\b/i, 80],
  [/\bserengeti\b/i, 100],
  [/\brajasthan\b/i, 200],
  [/\bgreek islands\b/i, 200],
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

function coreRadiusForDestination(geo: GeoDestination | null): number {
  if (!geo) return URBAN_CORE_KM;
  const name = geo.name || '';
  // Check destination-specific overrides first (compact, expanded, oversized)
  for (const [pattern, radius] of RADIUS_OVERRIDES) {
    if (pattern.test(name)) return radius;
  }
  return isRegionalDestination(geo) ? REGIONAL_CORE_KM : URBAN_CORE_KM;
}

// ─── Types ───
interface GeoAnchor {
  lat: number;
  lng: number;
  coreKm: number;
  outerKm: number;
  weight: number;
}

export interface PicksFilterOptions {
  selectedDay: number | null;
  typeFilter: string;
  sourceFilter: string;
  searchQuery: string;
  placePool?: ImportedPlace[];
}

export interface PicksFilterResult {
  tripDestinations: string[];
  activeDestination: string | null;
  activeGeoAnchors: GeoAnchor[];
  placedIds: Set<string>;
  allUnplacedPicks: ImportedPlace[];
  destinationPicks: ImportedPlace[];
  filteredPicks: ImportedPlace[];
  /**
   * Destination relevance score for a place (0–1).
   *
   * Scoring pipeline (first match wins):
   *  1.0    — Google Place ID match
   *  1.0    — within adaptive core geo radius
   *  0.3…1.0 — within taper zone (linear falloff)
   *  0.7    — all destination tokens match place location tokens (alias-resolved)
   *  0.5    — all destination tokens match via substring (alias-resolved)
   *  0      — no match
   *
   * Conflict resolution: when geo says NO (beyond outer radius) but string
   * says YES (token match), geo wins. This prevents "Outside Copenhagen"
   * (130km away) from matching on the string "Copenhagen".
   */
  destinationScore: (place: ImportedPlace) => number;
  matchesDestination: (place: ImportedPlace) => boolean;
}

// ─── String matching (alias-aware) ───

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

/**
 * Resolve an array of tokens through the alias map.
 * Multi-word aliases (e.g. "le marais" → "paris") require checking
 * consecutive token pairs/triples.
 *
 * When an alias resolves to a multi-word name (e.g. "nyc" → "new york"),
 * we inject BOTH the combined form ("new york") AND the individual words
 * ("new", "york") so that token-level matching works correctly.
 * Without this, "nyc" → "new york" wouldn't match destination tokens
 * ["new", "york"] because "new" is only 3 chars (below the 4-char
 * substring threshold).
 */
function resolveTokenAliases(tokens: string[]): string[] {
  const resolved = new Set<string>(tokens);

  const addAlias = (alias: string) => {
    resolved.add(alias);
    // If alias is multi-word, also inject individual words
    if (alias.includes(' ')) {
      for (const part of alias.split(/\s+/)) {
        if (part.length > 1) resolved.add(part);
      }
    }
  };

  const tryResolve = (input: string) => {
    const aliases = resolveAlias(input);
    // resolveAlias returns [input] unchanged when no alias exists
    if (aliases.length === 1 && aliases[0] === input) return;
    for (const a of aliases) addAlias(a);
  };

  // Check each token individually
  for (const t of tokens) tryResolve(t);

  // Check consecutive pairs ("le marais", "staten island", etc.)
  for (let i = 0; i < tokens.length - 1; i++) {
    tryResolve(`${tokens[i]} ${tokens[i + 1]}`);
  }

  // Check consecutive triples
  for (let i = 0; i < tokens.length - 2; i++) {
    tryResolve(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  return [...resolved];
}

/**
 * Token-overlap score between a place's location and a destination name.
 *
 * Key improvements over v1:
 *  - Resolves aliases on BOTH sides (place location and destination)
 *  - Strips vague qualifiers ("Near X", "X area") before tokenizing
 *  - Splits compound destinations (Noto / Syracuse) into sub-tokens
 *  - Matches if ANY sub-destination's tokens all appear in place location
 *
 * Returns:
 *  0.7 — all tokens of a sub-destination match exactly
 *  0.5 — all match via substring containment (4+ chars)
 *  0   — no sub-destination fully matches
 */
function tokenMatchScore(placeLocation: string, destinationName: string): number {
  const cleanedLoc = stripVagueQualifiers(placeLocation);
  const placeTokens = resolveTokenAliases(tokenize(cleanedLoc));
  if (placeTokens.length === 0) return 0;

  // Split compound destination and try each sub-destination
  const subDests = splitCompoundDestination(destinationName);
  let bestScore = 0;

  for (const subDest of subDests) {
    const destTokens = resolveTokenAliases(tokenize(subDest));
    if (destTokens.length === 0) continue;

    // Every destination token must appear in the place location tokens
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

/**
 * Guard against "Roma" in place location matching "Rome" destination
 * when the place is actually in Mexico City ("Roma Norte, CDMX").
 *
 * The alias map maps "roma" → "rome", which would cause a false positive.
 * We detect this by checking if the FULL alias-resolved location also
 * contains tokens from a DIFFERENT city that contradict.
 *
 * Simple heuristic: if the place location resolves to BOTH the target
 * city AND a different well-known city, prefer geo evidence.
 * This is handled by the conflict-resolution layer in destinationScore.
 */

// ─── Geo scoring ───

function geoScore(pLat: number, pLng: number, anchors: GeoAnchor[]): number {
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

// ─── Place ID matching ───
function placeIdMatches(
  place: ImportedPlace,
  geoDestinations: GeoDestination[] | undefined,
): boolean {
  const pid = place.google?.placeId;
  if (!pid || !geoDestinations?.length) return false;
  return geoDestinations.some(g => g.placeId && g.placeId === pid);
}

// ─────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────

export function usePicksFilter(opts: PicksFilterOptions): PicksFilterResult {
  const { selectedDay, typeFilter, sourceFilter, searchQuery, placePool } = opts;

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const myPlaces = useSavedStore(s => s.myPlaces);

  // ─── Trip destination names ───
  const tripDestinations = useMemo(() => {
    if (!trip) return [];
    if (trip.destinations && trip.destinations.length > 0) return trip.destinations;
    return trip.location
      ? [trip.location.split(',')[0]?.trim()].filter(Boolean) as string[]
      : [];
  }, [trip]);

  // ─── Active day's destination ───
  const activeDestination = useMemo(() => {
    if (selectedDay === null || !trip) return null;
    const day = trip.days.find(d => d.dayNumber === selectedDay);
    if (!day) return null;
    return day.destination || null;
  }, [selectedDay, trip]);

  // ─── Adjacent-day destination names ───
  const adjacentDestinations = useMemo((): string[] => {
    if (selectedDay === null || !trip) return [];
    const sorted = [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);
    const prevDay = sorted.filter(d => d.dayNumber < selectedDay && d.destination).pop();
    const nextDay = sorted.find(d => d.dayNumber > selectedDay && d.destination);
    const adj: string[] = [];
    if (prevDay?.destination && prevDay.destination.toLowerCase() !== (activeDestination || '').toLowerCase()) {
      adj.push(prevDay.destination);
    }
    if (nextDay?.destination && nextDay.destination.toLowerCase() !== (activeDestination || '').toLowerCase()) {
      adj.push(nextDay.destination);
    }
    return adj;
  }, [selectedDay, trip, activeDestination]);

  // ─── Geo anchors (with adaptive radii) ───
  const activeGeoAnchors = useMemo((): GeoAnchor[] => {
    if (!trip) return [];
    const anchors: GeoAnchor[] = [];

    const makeAnchor = (lat: number, lng: number, geo: GeoDestination | null, weight = 1.0): GeoAnchor | null => {
      const coords = validCoords(lat, lng);
      if (!coords) return null;
      const core = coreRadiusForDestination(geo);
      return { lat: coords[0], lng: coords[1], coreKm: core, outerKm: core * TAPER_RATIO, weight };
    };

    if (selectedDay === null) {
      trip.geoDestinations?.forEach(g => {
        if (g.lat && g.lng) {
          const a = makeAnchor(g.lat, g.lng, g);
          if (a) anchors.push(a);
        }
      });
      trip.days.forEach(day => {
        if (day.hotelInfo?.lat && day.hotelInfo?.lng) {
          const h = { lat: day.hotelInfo.lat, lng: day.hotelInfo.lng };
          if (!anchors.some(a => distKm(a.lat, a.lng, h.lat, h.lng) < 10)) {
            const dayGeo: GeoDestination | null = day.destination
              ? (trip.geoDestinations?.find(g => g.name.toLowerCase() === day.destination!.toLowerCase()) ?? { name: day.destination })
              : null;
            const a = makeAnchor(h.lat, h.lng, dayGeo);
            if (a) anchors.push(a);
          }
        }
      });
    } else {
      const day = trip.days.find(d => d.dayNumber === selectedDay);
      const destName = day?.destination;

      const resolveDestAnchors = (dest: string, weight: number) => {
        const geo = trip.geoDestinations?.find(
          g => g.name.toLowerCase() === dest.toLowerCase()
        );
        if (geo?.lat && geo?.lng) {
          const a = makeAnchor(geo.lat, geo.lng, geo, weight);
          if (a) anchors.push(a);
          return;
        }
        const synth: GeoDestination = geo ?? { name: dest };
        const daysWithHotel = trip.days
          .filter(d => d.destination === dest && d.hotelInfo?.lat && d.hotelInfo?.lng)
          .sort((a, b) =>
            Math.abs(a.dayNumber - selectedDay) - Math.abs(b.dayNumber - selectedDay)
          );
        if (daysWithHotel.length > 0) {
          const a = makeAnchor(
            daysWithHotel[0].hotelInfo!.lat!,
            daysWithHotel[0].hotelInfo!.lng!,
            synth,
            weight,
          );
          if (a) anchors.push(a);
        }
      };

      if (destName) {
        resolveDestAnchors(destName, 1.0);
        if (anchors.length === 0 && day?.hotelInfo?.lat && day?.hotelInfo?.lng) {
          const synth: GeoDestination = trip.geoDestinations?.find(
            g => g.name.toLowerCase() === destName.toLowerCase()
          ) ?? { name: destName };
          const a = makeAnchor(day.hotelInfo.lat, day.hotelInfo.lng, synth, 1.0);
          if (a) anchors.push(a);
        }
      }

      const ADJACENT_WEIGHT = 0.55;
      const sortedDays = [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);
      const prevDay = sortedDays.filter(d => d.dayNumber < selectedDay && d.destination).pop();
      const nextDay = sortedDays.find(d => d.dayNumber > selectedDay && d.destination);

      if (prevDay?.destination) {
        const prevDest = prevDay.destination;
        if (!destName || prevDest.toLowerCase() !== destName.toLowerCase()) {
          resolveDestAnchors(prevDest, ADJACENT_WEIGHT);
        }
      }
      if (nextDay?.destination) {
        const nextDest = nextDay.destination;
        if (!destName || nextDest.toLowerCase() !== destName.toLowerCase()) {
          resolveDestAnchors(nextDest, ADJACENT_WEIGHT);
        }
      }
    }

    return anchors;
  }, [trip, selectedDay]);

  // ─── Placed IDs ───
  const placedIds = useMemo(() => {
    if (!trip) return new Set<string>();
    const ids = new Set<string>();
    trip.days.forEach(day =>
      day.slots.forEach(slot => {
        slot.places.forEach(p => ids.add(p.id));
        slot.ghostItems?.forEach(p => ids.add(p.id));
      })
    );
    return ids;
  }, [trip]);

  const allUnplacedPicks = useMemo(() => {
    return myPlaces.filter(p => !placedIds.has(p.id));
  }, [myPlaces, placedIds]);

  const pool = placePool ?? allUnplacedPicks;

  // ─── Active geoDestinations (for Place ID matching) ───
  const activeGeoDestinations = useMemo((): GeoDestination[] | undefined => {
    if (!trip?.geoDestinations) return undefined;
    if (selectedDay === null) return trip.geoDestinations;
    const names = new Set<string>();
    if (activeDestination) names.add(activeDestination.toLowerCase());
    adjacentDestinations.forEach(d => names.add(d.toLowerCase()));
    if (names.size === 0) return undefined;
    return trip.geoDestinations.filter(
      g => names.has(g.name.toLowerCase())
    );
  }, [trip, selectedDay, activeDestination, adjacentDestinations]);

  // ─── Destination scoring (0–1) ───
  const ADJACENT_STRING_WEIGHT = 0.55;

  const destinationScore = useCallback((place: ImportedPlace): number => {
    // 1. Place ID match
    if (placeIdMatches(place, activeGeoDestinations)) return 1.0;

    const rawCoords = validCoords(place.google?.lat, place.google?.lng);
    const hasValidGeo = rawCoords !== null && activeGeoAnchors.length > 0;

    // 2. Geo-proximity score
    let geo = 0;
    if (hasValidGeo) {
      geo = geoScore(rawCoords![0], rawCoords![1], activeGeoAnchors);
      if (geo > 0) return geo;
    }

    // 3. Token-based string match (alias-aware, compound-splitting)
    const loc = place.location || '';
    if (!loc) return 0;

    // ── Conflict resolution ──
    // If the place HAS valid coordinates and they're beyond ALL geo anchors
    // (geo returned 0), but string matching would succeed, geo wins.
    // This prevents "Outside Copenhagen" (130km away) from matching on
    // the Copenhagen token in the string, and "Finca Cortesin, Costa del Sol"
    // from matching "Costa Brava" on the shared "costa" token.
    //
    // Exception: if there are NO geo anchors at all (no coords for the
    // destination either), fall through to string matching — it's our
    // only signal.
    if (hasValidGeo && geo === 0) {
      // Geo explicitly says "not here". Trust it over string.
      return 0;
    }

    // ── String matching (only reached when place has NO valid coordinates) ──
    if (selectedDay === null) {
      if (tripDestinations.length === 0) return 1;
      let best = 0;
      for (const dest of tripDestinations) {
        const s = tokenMatchScore(loc, dest);
        if (s > best) best = s;
      }
      return best;
    }

    if (activeDestination) {
      const primary = tokenMatchScore(loc, activeDestination);
      if (primary > 0) return primary;
    }

    if (adjacentDestinations.length > 0) {
      let best = 0;
      for (const adj of adjacentDestinations) {
        const s = tokenMatchScore(loc, adj);
        if (s > best) best = s;
      }
      if (best > 0) return best * ADJACENT_STRING_WEIGHT;
    }

    return 0;
  }, [selectedDay, activeDestination, adjacentDestinations, tripDestinations, activeGeoAnchors, activeGeoDestinations]);

  const matchesDestination = useCallback(
    (place: ImportedPlace): boolean => destinationScore(place) > 0,
    [destinationScore]
  );

  // ─── Destination-filtered picks ───
  const destinationPicks = useMemo(() => {
    if (searchQuery.trim()) return pool;
    if (activeGeoAnchors.length > 0 || tripDestinations.length > 0 || activeDestination || adjacentDestinations.length > 0) {
      return pool.filter(matchesDestination);
    }
    return pool;
  }, [pool, matchesDestination, searchQuery, activeGeoAnchors, tripDestinations, activeDestination, adjacentDestinations]);

  // ─── Full filtering ───
  const filteredPicks = useMemo(() => {
    let picks = destinationPicks;
    if (typeFilter !== 'all') {
      picks = picks.filter(p => p.type === typeFilter);
    }
    if (sourceFilter !== 'all') {
      picks = picks.filter(p => p.ghostSource === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      picks = picks.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.tasteNote || '').toLowerCase().includes(q)
      );
    }
    return picks;
  }, [destinationPicks, typeFilter, sourceFilter, searchQuery]);

  return {
    tripDestinations,
    activeDestination,
    activeGeoAnchors,
    placedIds,
    allUnplacedPicks,
    destinationPicks,
    filteredPicks,
    destinationScore,
    matchesDestination,
  };
}
