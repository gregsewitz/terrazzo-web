import { useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import type { ImportedPlace } from '@/types';

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

export const GEO_RADIUS_KM = 60; // covers regional destinations like the Cotswolds

// ─── Types ───

interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PicksFilterOptions {
  /** Which day is selected — null means "All days" (PicksRail) */
  selectedDay: number | null;
  /** Type filter ('all' | PlaceType) */
  typeFilter: string;
  /** Source filter */
  sourceFilter: string;
  /** Search query text */
  searchQuery: string;
}

export interface PicksFilterResult {
  /** All trip destination names (lowercased) */
  tripDestinations: string[];
  /** The active day's destination name (or null for "all days") */
  activeDestination: string | null;
  /** Geo points for proximity matching */
  activeGeoPoints: GeoPoint[];
  /** IDs of places already placed in slots */
  placedIds: Set<string>;
  /** All unplaced, favorited picks (no destination filter) */
  allUnplacedPicks: ImportedPlace[];
  /** Picks filtered to trip/day destinations (before type/source/search) */
  destinationPicks: ImportedPlace[];
  /** Fully filtered picks (destination + type + source + search) */
  filteredPicks: ImportedPlace[];
  /** Check if a place matches the current destination(s) */
  matchesDestination: (place: ImportedPlace) => boolean;
}

/**
 * Shared filtering logic for PicksRail, PicksStrip, and BrowseAllOverlay.
 *
 * Centralises:
 * - Geo-proximity matching (Haversine, 60km radius)
 * - String-based destination matching (fallback)
 * - Geo point resolution (geoDestinations → hotel coordinates)
 * - Placed-ID tracking
 * - Type / source / search filtering
 */
export function usePicksFilter(opts: PicksFilterOptions): PicksFilterResult {
  const { selectedDay, typeFilter, sourceFilter, searchQuery } = opts;

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const myPlaces = useSavedStore(s => s.myPlaces);

  // ─── Trip destination names ───
  const tripDestinations = useMemo(() => {
    if (!trip) return [];
    if (trip.destinations && trip.destinations.length > 0) return trip.destinations;
    return trip.location ? [trip.location.split(',')[0]?.trim()].filter(Boolean) as string[] : [];
  }, [trip]);

  // ─── Active day's destination ───
  const activeDestination = useMemo(() => {
    if (selectedDay === null || !trip) return null;
    const day = trip.days.find(d => d.dayNumber === selectedDay);
    return day?.destination || trip.location || null;
  }, [selectedDay, trip]);

  // ─── Geo points for proximity matching ───
  // Resolves: geoDestinations → hotel coordinates (with dedup)
  const activeGeoPoints = useMemo((): GeoPoint[] => {
    if (!trip) return [];
    const points: GeoPoint[] = [];

    if (selectedDay === null) {
      // "All days": collect all geo points
      trip.geoDestinations?.forEach(g => {
        if (g.lat && g.lng) points.push({ lat: g.lat, lng: g.lng });
      });
      // Hotel fallbacks (deduplicated within 10km)
      trip.days.forEach(day => {
        if (day.hotelInfo?.lat && day.hotelInfo?.lng) {
          const h = { lat: day.hotelInfo.lat, lng: day.hotelInfo.lng };
          if (!points.some(p => distKm(p.lat, p.lng, h.lat, h.lng) < 10)) {
            points.push(h);
          }
        }
      });
    } else {
      // Specific day: find the geo point for this day's destination
      const day = trip.days.find(d => d.dayNumber === selectedDay);
      const destName = day?.destination;

      // Try geoDestinations first
      if (trip.geoDestinations?.length) {
        const geo = destName
          ? trip.geoDestinations.find(g => g.name.toLowerCase() === destName.toLowerCase())
          : trip.geoDestinations[0];
        if (geo?.lat && geo?.lng) points.push({ lat: geo.lat, lng: geo.lng });
      }

      // Fall back to this day's hotel coordinates
      if (points.length === 0 && day?.hotelInfo?.lat && day?.hotelInfo?.lng) {
        points.push({ lat: day.hotelInfo.lat, lng: day.hotelInfo.lng });
      }

      // Fall back to any same-destination day's hotel
      if (points.length === 0 && destName) {
        for (const d of trip.days) {
          if (d.destination === destName && d.hotelInfo?.lat && d.hotelInfo?.lng) {
            points.push({ lat: d.hotelInfo.lat, lng: d.hotelInfo.lng });
            break;
          }
        }
      }
    }

    return points;
  }, [trip, selectedDay]);

  // ─── Placed IDs ───
  const placedIds = useMemo(() => {
    if (!trip) return new Set<string>();
    const ids = new Set<string>();
    trip.days.forEach(day => day.slots.forEach(slot => slot.places.forEach(p => ids.add(p.id))));
    return ids;
  }, [trip]);

  // ─── All unplaced, favorited picks ───
  const allUnplacedPicks = useMemo(() => {
    return myPlaces.filter(p => p.isFavorited && !placedIds.has(p.id));
  }, [myPlaces, placedIds]);

  // ─── Destination matching predicate ───
  const matchesDestination = useCallback((place: ImportedPlace): boolean => {
    // 1. Geo-proximity match (best — works for regions, villages, neighborhoods)
    const pLat = place.google?.lat;
    const pLng = place.google?.lng;
    if (pLat && pLng && activeGeoPoints.length > 0) {
      if (activeGeoPoints.some(geo => distKm(geo.lat, geo.lng, pLat, pLng) <= GEO_RADIUS_KM)) {
        return true;
      }
    }

    // 2. String match fallback (for places without coordinates)
    const loc = (place.location || '').toLowerCase();
    if (selectedDay === null) {
      if (tripDestinations.length === 0) return true;
      return tripDestinations.some(dest => {
        const d = dest.toLowerCase();
        return loc.includes(d) || d.includes(loc.split(',')[0]?.trim() || '---');
      });
    }
    if (!activeDestination) return true;
    const dest = activeDestination.toLowerCase();
    return loc.includes(dest) || dest.includes(loc.split(',')[0]?.trim() || '---');
  }, [selectedDay, activeDestination, tripDestinations, activeGeoPoints]);

  // ─── Destination-filtered picks ───
  const destinationPicks = useMemo(() => {
    // When searching, don't filter by destination (search everything)
    if (searchQuery.trim()) return allUnplacedPicks;

    // If we have geo points or destination names, filter
    if (activeGeoPoints.length > 0 || tripDestinations.length > 0 || activeDestination) {
      return allUnplacedPicks.filter(matchesDestination);
    }

    return allUnplacedPicks;
  }, [allUnplacedPicks, matchesDestination, searchQuery, activeGeoPoints, tripDestinations, activeDestination]);

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
    activeGeoPoints,
    placedIds,
    allUnplacedPicks,
    destinationPicks,
    filteredPicks,
    matchesDestination,
  };
}
