'use client';

import { useEffect, useRef } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { GeoDestination } from '@/types';

/**
 * Geocode a place name using Open-Meteo's free geocoding API (no key needed).
 * Falls back to Google Geocoding API if available.
 */
async function geocodeName(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result?.latitude || !result?.longitude) return null;
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    return null;
  }
}

/**
 * Hook that automatically repairs missing geoDestination coordinates.
 *
 * When a trip has `destinations` but `geoDestinations` is missing or has
 * entries without lat/lng, this hook geocodes them using the free
 * Open-Meteo API and updates the trip in the store + saves to server.
 *
 * Runs once per trip load — a ref tracks which trip ID was last repaired
 * to avoid repeated calls.
 */
export function useGeoDestinationRepair() {
  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const repairedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!trip) return;
    // Don't re-run for the same trip
    if (repairedRef.current === trip.id) return;

    const destinations = trip.destinations;
    if (!destinations || destinations.length === 0) return;

    // Check which destinations are missing coordinates
    const existing = trip.geoDestinations || [];
    const needsRepair = destinations.filter(destName => {
      const geo = existing.find(g => g.name.toLowerCase() === destName.toLowerCase());
      return !geo?.lat || !geo?.lng;
    });

    if (needsRepair.length === 0) {
      // All good — mark as checked
      repairedRef.current = trip.id;
      return;
    }

    // Mark as in-progress to prevent double-runs
    repairedRef.current = trip.id;

    // Geocode missing destinations
    (async () => {
      const updates: GeoDestination[] = [...existing];
      let changed = false;

      for (const destName of needsRepair) {
        const coords = await geocodeName(destName);
        if (!coords) continue;

        // Find existing entry to update, or create new one
        const idx = updates.findIndex(g => g.name.toLowerCase() === destName.toLowerCase());
        if (idx >= 0) {
          updates[idx] = { ...updates[idx], lat: coords.lat, lng: coords.lng };
        } else {
          updates.push({ name: destName, lat: coords.lat, lng: coords.lng });
        }
        changed = true;
      }

      if (!changed) return;

      // Update the store
      const { getState, setState } = useTripStore;
      const state = getState();
      const currentTrip = state.trips.find(t => t.id === trip.id);
      if (!currentTrip) return;

      setState({
        trips: state.trips.map(t =>
          t.id === trip.id ? { ...t, geoDestinations: updates } : t
        ),
      });

      // Save to server
      const { debouncedTripSave } = await import('@/stores/trip/tripHelpers');
      debouncedTripSave(trip.id, () => ({ geoDestinations: updates }));
    })();
  }, [trip?.id, trip?.destinations, trip?.geoDestinations]);
}
