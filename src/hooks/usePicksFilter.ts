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

// ─── Adaptive radius ───
//
// Fixed radii fail because 50km from central Paris puts you in a
// different country, while 50km from a Cotswolds centroid misses half the
// region. We infer the right radius from the destination itself:
//
//  1. If geoDestination has a formattedAddress containing country-level or
//     region-level hints (no city comma-segment), treat it as regional → wide.
//  2. Otherwise default to an urban-appropriate tight radius.
//  3. The taper zone is always 1.6× the core radius.

/** Default core radius for city destinations (km) */
const URBAN_CORE_KM = 18;
/** Core radius for regional/rural destinations (km) */
const REGIONAL_CORE_KM = 55;
/** Taper multiplier: outer = core × this */
const TAPER_RATIO = 1.6;

/**
 * Infer whether a geoDestination is a region vs. a city.
 * Uses formattedAddress heuristics — Google Geocoding returns things like:
 *   "Paris, France"                  → city (has comma-separated locality)
 *   "Cotswolds, England, UK"         → region (known region terms)
 *   "Tuscany, Italy"                 → region
 *   "Amalfi Coast, Province of…"     → region
 *
 * Falls back to name-based heuristics when no address is available.
 */
const REGION_HINTS = /\b(coast|valley|region|island|islands|lake|lakes|countryside|hills|highlands|mountains|riviera|peninsula|province|county|shire|prefecture|district)\b/i;
const KNOWN_REGIONS = /\b(cotswolds|tuscany|provence|burgundy|champagne|alsace|dordogne|algarve|cinque terre|amalfi|capri|lake district|peak district|loire|costa brava|dalmatian|patagonia|basque country|black forest|bavari|normand|sicily|sardinia|crete|peloponnese|hokkaido|okinawa|bali|rajasthan|tulum|yucatan|napa|hamptons|cape cod|finger lakes|big sur|outer banks|ozarks|blue ridge)\b/i;

function isRegionalDestination(geo: GeoDestination): boolean {
  const addr = geo.formattedAddress || '';
  const name = geo.name || '';
  // Check name and address for region signals
  if (REGION_HINTS.test(name) || REGION_HINTS.test(addr)) return true;
  if (KNOWN_REGIONS.test(name) || KNOWN_REGIONS.test(addr)) return true;
  // If the formattedAddress has very few comma-segments, it's likely a region
  // e.g. "Cotswolds, England, UK" (3 parts, no street/city)
  // vs.  "Paris, Île-de-France, France" (3 parts, but "Paris" is first = city)
  // Heuristic: if name doesn't appear as the first segment of a multi-segment
  // address, it's probably a broad area
  const segments = addr.split(',').map(s => s.trim());
  if (segments.length >= 2) {
    const firstName = segments[0].toLowerCase();
    const destName = name.toLowerCase();
    // If the first address segment doesn't start with or match the dest name,
    // it's likely a region whose name doesn't correspond to a city
    if (!firstName.includes(destName) && !destName.includes(firstName)) return true;
  }
  return false;
}

function coreRadiusForDestination(geo: GeoDestination | null): number {
  if (!geo) return URBAN_CORE_KM;
  return isRegionalDestination(geo) ? REGIONAL_CORE_KM : URBAN_CORE_KM;
}

// ─── Types ───

interface GeoAnchor {
  lat: number;
  lng: number;
  coreKm: number;
  outerKm: number;
  /** Weight multiplier for scoring (1.0 = primary day, <1.0 = adjacent day bleed) */
  weight: number;
}

export interface PicksFilterOptions {
  /** Which day is selected — null means "All days" */
  selectedDay: number | null;
  /** Type filter ('all' | PlaceType) */
  typeFilter: string;
  /** Source filter */
  sourceFilter: string;
  /** Search query text */
  searchQuery: string;
  /**
   * Optional override for the place pool to match against.
   * Defaults to: all unplaced library places from savedStore.
   */
  placePool?: ImportedPlace[];
}

export interface PicksFilterResult {
  /** All trip destination names */
  tripDestinations: string[];
  /** The active day's destination name (or null for "all days" / transit) */
  activeDestination: string | null;
  /** Geo anchors for proximity matching (with adaptive radii) */
  activeGeoAnchors: GeoAnchor[];
  /** IDs of places already placed in slots (includes ghost items) */
  placedIds: Set<string>;
  /** All unplaced library places (no destination filter) */
  allUnplacedPicks: ImportedPlace[];
  /** Picks filtered to trip/day destinations (before type/source/search) */
  destinationPicks: ImportedPlace[];
  /** Fully filtered picks (destination + type + source + search) */
  filteredPicks: ImportedPlace[];
  /**
   * Destination relevance score for a place (0–1).
   *
   * Scoring tiers (first match wins):
   *  1.0  — Google Place ID matches a trip destination's placeId
   *  1.0  — within adaptive core geo radius
   *  0.3…1.0 — within taper zone (linear falloff)
   *  0.7  — all destination tokens match place location tokens exactly
   *  0.5  — all destination tokens match (substring)
   *  0    — no match
   */
  destinationScore: (place: ImportedPlace) => number;
  /** Boolean convenience: destinationScore(place) > 0 */
  matchesDestination: (place: ImportedPlace) => boolean;
}

// ─── String matching ───

/** Normalise a location string into comparable tokens */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
    .filter(t => !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'the', 'of', 'in', 'at', 'and', 'on', 'to', 'for',
  'de', 'di', 'da', 'la', 'le', 'les', 'du', 'des', 'el', 'lo', 'los', 'las',
  'city', 'greater', 'area', 'region', 'district', 'province', 'state',
  'county', 'borough', 'arrondissement', 'town', 'village',
]);

/**
 * Token-overlap score between a place's location and a destination name.
 *
 * Requires ALL destination tokens to appear in the place location.
 * This prevents "York, England" matching "New York" (because "new" is absent),
 * and "San Jose" matching "San Francisco" (because "francisco" ≠ "jose").
 *
 * Returns:
 *  0.7 — all destination tokens match exactly
 *  0.5 — all match via substring containment
 *  0   — any destination token is missing
 */
function tokenMatchScore(placeLocation: string, destinationName: string): number {
  const placeTokens = tokenize(placeLocation);
  const destTokens = tokenize(destinationName);
  if (destTokens.length === 0 || placeTokens.length === 0) return 0;

  // Every destination token must appear in the place location
  const allDestMatch = destTokens.every(dt =>
    placeTokens.some(pt => pt === dt || (pt.length >= 4 && dt.length >= 4 && (pt.includes(dt) || dt.includes(pt))))
  );
  if (!allDestMatch) return 0;

  // Exact token match on all → 0.7, any substring → 0.5
  const allExact = destTokens.every(dt => placeTokens.some(pt => pt === dt));
  return allExact ? 0.7 : 0.5;
}

// ─── Geo scoring ───

/**
 * Score a place's distance to the nearest geo anchor.
 * Each anchor carries its own adaptive radius (urban vs. regional).
 *
 *   <= coreKm  → 1.0
 *   coreKm..outerKm → linear taper 1.0 → 0.3
 *   > outerKm → 0
 */
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
      score = 1.0 - t * 0.7; // taper 1.0 → 0.3
    } else {
      score = 0;
    }
    // Apply anchor weight (adjacent-day anchors score lower)
    score *= anchor.weight;
    if (score > best) best = score;
    if (best >= 1.0) return 1.0; // can't improve
  }
  return best;
}

// ─── Place ID matching ───

/**
 * Check if a place's Google placeId shares a locality with any trip
 * destination's placeId. Google Place IDs are globally unique per
 * feature, so if a restaurant's address resolves to the same locality
 * Place ID as the trip destination, it's a perfect match.
 *
 * We can't do full hierarchy comparison client-side (that would need
 * Places API calls), but we can check direct ID equality, which covers
 * the case where both the place and the destination geocoded to the
 * same city/region entity.
 */
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

/**
 * Shared filtering logic for PicksRail and PicksStrip.
 *
 * Scoring pipeline (first match wins):
 *  1. Google Place ID match → 1.0
 *  2. Adaptive geo-proximity (Haversine, urban/regional radius) → 0.3–1.0
 *  3. Token-based string match (fallback for places without coords) → 0.5–0.7
 *
 * Also centralises:
 *  - Geo anchor resolution (geoDestinations → hotel coordinates)
 *  - Placed-ID tracking (slots + ghost items)
 *  - Type / source / search filtering
 */
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

  // ─── Adjacent-day destination names (for string matching on transition/transit days) ───
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

    const makeAnchor = (lat: number, lng: number, geo: GeoDestination | null, weight = 1.0): GeoAnchor => {
      const core = coreRadiusForDestination(geo);
      return { lat, lng, coreKm: core, outerKm: core * TAPER_RATIO, weight };
    };

    if (selectedDay === null) {
      // "All days": collect all geo-destinations
      trip.geoDestinations?.forEach(g => {
        if (g.lat && g.lng) anchors.push(makeAnchor(g.lat, g.lng, g));
      });
      // Hotel fallbacks (deduplicated within 10km)
      // Infer radius from the day's destination — a hotel in the Cotswolds
      // should cast a regional net, not an urban one.
      trip.days.forEach(day => {
        if (day.hotelInfo?.lat && day.hotelInfo?.lng) {
          const h = { lat: day.hotelInfo.lat, lng: day.hotelInfo.lng };
          if (!anchors.some(a => distKm(a.lat, a.lng, h.lat, h.lng) < 10)) {
            const dayGeo: GeoDestination | null = day.destination
              ? (trip.geoDestinations?.find(g => g.name.toLowerCase() === day.destination!.toLowerCase()) ?? { name: day.destination })
              : null;
            anchors.push(makeAnchor(h.lat, h.lng, dayGeo));
          }
        }
      });
    } else {
      // ── Specific day ──
      const day = trip.days.find(d => d.dayNumber === selectedDay);
      const destName = day?.destination;

      // Helper: resolve anchors for a destination name at a given weight.
      // Tries geoDestinations first, then hotel coords for that dest.
      const resolveDestAnchors = (dest: string, weight: number) => {
        const geo = trip.geoDestinations?.find(
          g => g.name.toLowerCase() === dest.toLowerCase()
        );
        if (geo?.lat && geo?.lng) {
          anchors.push(makeAnchor(geo.lat, geo.lng, geo, weight));
          return;
        }
        // Hotel fallback — find nearest day with this destination
        const synth: GeoDestination = geo ?? { name: dest };
        const daysWithHotel = trip.days
          .filter(d => d.destination === dest && d.hotelInfo?.lat && d.hotelInfo?.lng)
          .sort((a, b) =>
            Math.abs(a.dayNumber - selectedDay) - Math.abs(b.dayNumber - selectedDay)
          );
        if (daysWithHotel.length > 0) {
          anchors.push(makeAnchor(
            daysWithHotel[0].hotelInfo!.lat!,
            daysWithHotel[0].hotelInfo!.lng!,
            synth,
            weight,
          ));
        }
      };

      // --- Primary anchors for this day's destination ---
      if (destName) {
        resolveDestAnchors(destName, 1.0);

        // Also try THIS day's own hotel as a direct fallback
        if (anchors.length === 0 && day?.hotelInfo?.lat && day?.hotelInfo?.lng) {
          const synth: GeoDestination = trip.geoDestinations?.find(
            g => g.name.toLowerCase() === destName.toLowerCase()
          ) ?? { name: destName };
          anchors.push(makeAnchor(day.hotelInfo.lat, day.hotelInfo.lng, synth, 1.0));
        }
      }

      // --- Adjacent-day bleed ---
      // On transition days (destination differs from neighbor), include the
      // adjacent destination's anchors at reduced weight so those places
      // appear further down the list but remain accessible.
      const ADJACENT_WEIGHT = 0.55;
      const sortedDays = [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);

      // Find previous and next days with destinations
      const prevDay = sortedDays
        .filter(d => d.dayNumber < selectedDay && d.destination)
        .pop(); // last one before selected
      const nextDay = sortedDays
        .find(d => d.dayNumber > selectedDay && d.destination);

      // Bleed previous day's destination if it differs from current
      if (prevDay?.destination) {
        const prevDest = prevDay.destination;
        const isDifferent = !destName || prevDest.toLowerCase() !== destName.toLowerCase();
        if (isDifferent) {
          resolveDestAnchors(prevDest, ADJACENT_WEIGHT);
        }
      }

      // Bleed next day's destination if it differs from current
      if (nextDay?.destination) {
        const nextDest = nextDay.destination;
        const isDifferent = !destName || nextDest.toLowerCase() !== destName.toLowerCase();
        if (isDifferent) {
          resolveDestAnchors(nextDest, ADJACENT_WEIGHT);
        }
      }

      // --- Transit/unassigned day (no destination) ---
      // If we still have no anchors at all (day has no destination and
      // adjacent bleed produced nothing via resolveDestAnchors), the
      // scoring fallback in destinationScore will handle it by matching
      // against adjacent destination names via string matching.
    }

    return anchors;
  }, [trip, selectedDay]);

  // ─── Placed IDs (slots + ghost items) ───
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

  // ─── All unplaced library places ───
  // Every place in the library is "prescreened" — curation happens at
  // import time, so we no longer gate on isFavorited.
  const allUnplacedPicks = useMemo(() => {
    return myPlaces.filter(p => !placedIds.has(p.id));
  }, [myPlaces, placedIds]);

  // ─── The pool of places to filter ───
  const pool = placePool ?? allUnplacedPicks;

  // ─── Active geoDestinations (for Place ID matching) ───
  // Includes adjacent-day destinations so Place ID matching works on transition days
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
  /** Weight applied to adjacent-day string matches (same as geo ADJACENT_WEIGHT) */
  const ADJACENT_STRING_WEIGHT = 0.55;

  const destinationScore = useCallback((place: ImportedPlace): number => {
    // 1. Place ID match — highest confidence, instant 1.0
    if (placeIdMatches(place, activeGeoDestinations)) return 1.0;

    // 2. Geo-proximity score (adaptive radius per anchor)
    //    Anchor weights (primary=1.0, adjacent=0.55) are applied inside geoScore.
    const pLat = place.google?.lat;
    const pLng = place.google?.lng;
    if (pLat && pLng && activeGeoAnchors.length > 0) {
      const geo = geoScore(pLat, pLng, activeGeoAnchors);
      if (geo > 0) return geo;
    }

    // 3. Token-based string match (fallback for places without coordinates)
    const loc = place.location || '';
    if (!loc) return 0;

    if (selectedDay === null) {
      // "All days" mode
      if (tripDestinations.length === 0) return 1; // no destinations → everything matches
      let best = 0;
      for (const dest of tripDestinations) {
        const s = tokenMatchScore(loc, dest);
        if (s > best) best = s;
      }
      return best;
    }

    // Specific day: try primary destination first
    if (activeDestination) {
      const primary = tokenMatchScore(loc, activeDestination);
      if (primary > 0) return primary;
    }

    // Try adjacent-day destinations at reduced weight
    // (transition days: morning in prev city, evening in next city)
    if (adjacentDestinations.length > 0) {
      let best = 0;
      for (const adj of adjacentDestinations) {
        const s = tokenMatchScore(loc, adj);
        if (s > best) best = s;
      }
      if (best > 0) return best * ADJACENT_STRING_WEIGHT;
    }

    // Transit day with no primary and no adjacent matches — score 0.
    // (The geo anchors from adjacent days already handle coord-based places.)
    return 0;
  }, [selectedDay, activeDestination, adjacentDestinations, tripDestinations, activeGeoAnchors, activeGeoDestinations]);

  // Boolean convenience wrapper
  const matchesDestination = useCallback(
    (place: ImportedPlace): boolean => destinationScore(place) > 0,
    [destinationScore]
  );

  // ─── Destination-filtered picks ───
  const destinationPicks = useMemo(() => {
    // When searching, don't filter by destination (search across everything)
    if (searchQuery.trim()) return pool;

    // If we have geo anchors or destination names, filter
    if (activeGeoAnchors.length > 0 || tripDestinations.length > 0 || activeDestination || adjacentDestinations.length > 0) {
      return pool.filter(matchesDestination);
    }

    return pool;
  }, [pool, matchesDestination, searchQuery, activeGeoAnchors, tripDestinations, activeDestination, adjacentDestinations]);

  // ─── Full filtering (type + source + search) ───
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
