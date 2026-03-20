import { useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import type { ImportedPlace, GeoDestination } from '@/types';

// Canonical implementation is in @/lib/geo — import for local use + re-export for backward compatibility
import { distKm } from '@/lib/geo';
export { distKm };

import {
  validCoords,
  coreRadiusForDestination,
  tokenMatchScore,
  geoScore,
  placeIdMatches,
  TAPER_RATIO,
  type GeoAnchor,
} from '@/lib/destination-matching';

export type { GeoAnchor } from '@/lib/destination-matching';

// ─── Types ───

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
      // Collect hotel coords per destination for sanity-checking geoDestinations
      const hotelByDest = new Map<string, { lat: number; lng: number }>();
      trip.days.forEach(day => {
        if (day.destination && day.hotelInfo?.lat && day.hotelInfo?.lng && !hotelByDest.has(day.destination.toLowerCase())) {
          hotelByDest.set(day.destination.toLowerCase(), { lat: day.hotelInfo.lat, lng: day.hotelInfo.lng });
        }
      });

      trip.geoDestinations?.forEach(g => {
        if (g.lat && g.lng) {
          const hotel = hotelByDest.get(g.name.toLowerCase());
          if (hotel && distKm(g.lat, g.lng, hotel.lat, hotel.lng) > 200) return;
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
        const daysWithHotel = trip.days
          .filter(d => d.destination === dest && d.hotelInfo?.lat && d.hotelInfo?.lng)
          .sort((a, b) =>
            Math.abs(a.dayNumber - selectedDay) - Math.abs(b.dayNumber - selectedDay)
          );

        if (geo?.lat && geo?.lng) {
          let geoTrusted = true;
          if (daysWithHotel.length > 0) {
            const hLat = daysWithHotel[0].hotelInfo!.lat!;
            const hLng = daysWithHotel[0].hotelInfo!.lng!;
            const drift = distKm(geo.lat, geo.lng, hLat, hLng);
            if (drift > 200) {
              geoTrusted = false;
            }
          }
          if (geoTrusted) {
            const a = makeAnchor(geo.lat, geo.lng, geo, weight);
            if (a) anchors.push(a);
            return;
          }
        }

        const synth: GeoDestination = geo ?? { name: dest };
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
        slot.places.forEach(p => {
          ids.add(p.id);
          const match = p.id.match(/^(.+)-\d{13,}-[a-z0-9]{4,}$/);
          if (match) ids.add(match[1]);
        });
        slot.ghostItems?.forEach(p => ids.add(p.id));
      })
    );
    return ids;
  }, [trip]);

  // Show ALL picks including already-placed ones (they'll be greyed out in UI)
  const allUnplacedPicks = useMemo(() => {
    return myPlaces;
  }, [myPlaces]);

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

    // Conflict resolution: geo says NO but string would say YES → trust geo
    if (hasValidGeo && geo === 0) {
      return 0;
    }

    // String matching (only reached when place has NO valid coordinates)
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
      picks = picks.filter(p => (p.source?.type || 'manual') === sourceFilter);
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
