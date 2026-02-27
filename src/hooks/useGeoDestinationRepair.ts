'use client';

import { useEffect, useRef } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { GeoDestination } from '@/types';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Geocode a place name using Google Geocoding API.
 *
 * We previously fell back to Open-Meteo when Google failed, but Open-Meteo
 * is city-focused and returns wrong results for regions (e.g. "Cotswolds"
 * mapped to Hong Kong). Instead, the repair hook now falls back to hotel
 * coordinates from the trip's days when Google geocoding is unavailable.
 */
async function geocodeName(name: string): Promise<{ lat: number; lng: number; placeId?: string; formattedAddress?: string } | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result?.geometry?.location) return null;
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      placeId: result.place_id,
      formattedAddress: result.formatted_address,
    };
  } catch {
    return null;
  }
}

/**
 * Hook that automatically repairs missing geoDestination coordinates.
 *
 * When a trip has `destinations` but `geoDestinations` is missing or has
 * entries without lat/lng, this hook geocodes them using Google Geocoding
 * API and falls back to hotel coordinates from the trip's days when Google
 * is unavailable. A 200 km sanity check rejects wildly wrong geocodes.
 *
 * Runs once per trip load — a ref tracks which trip ID was last repaired.
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

      // Build hotel-coord lookup for sanity-checking geocoded results
      const hotelByDest = new Map<string, { lat: number; lng: number }>();
      trip.days?.forEach((day: { destination?: string; hotelInfo?: { lat?: number; lng?: number } }) => {
        if (day.destination && day.hotelInfo?.lat && day.hotelInfo?.lng && !hotelByDest.has(day.destination.toLowerCase())) {
          hotelByDest.set(day.destination.toLowerCase(), { lat: day.hotelInfo.lat, lng: day.hotelInfo.lng });
        }
      });

      for (const destName of needsRepair) {
        let coords = await geocodeName(destName);

        // If Google geocoding failed (no API key, network error, etc.),
        // fall back to hotel coordinates so geoDestinations still gets
        // populated with reasonable coords for the picks filter.
        if (!coords) {
          const hotel = hotelByDest.get(destName.toLowerCase());
          if (!hotel) continue;
          coords = { lat: hotel.lat, lng: hotel.lng };
        }

        // Belt-and-suspenders: if we have hotel coords, reject geocoded
        // results that are wildly off (>200km) and use hotel coords instead.
        const hotel = hotelByDest.get(destName.toLowerCase());
        if (hotel) {
          const R = 6371;
          const dLat = (coords.lat - hotel.lat) * Math.PI / 180;
          const dLng = (coords.lng - hotel.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(hotel.lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const drift = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (drift > 200) {
            console.warn(`[GeoRepair] Geocoded "${destName}" to (${coords.lat}, ${coords.lng}) but hotel is ${drift.toFixed(0)}km away — using hotel coords instead`);
            coords.lat = hotel.lat;
            coords.lng = hotel.lng;
            delete coords.placeId;
            delete coords.formattedAddress;
          }
        }

        // Find existing entry to update, or create new one
        const idx = updates.findIndex(g => g.name.toLowerCase() === destName.toLowerCase());
        if (idx >= 0) {
          updates[idx] = {
            ...updates[idx],
            lat: coords.lat,
            lng: coords.lng,
            ...(coords.placeId && { placeId: coords.placeId }),
            ...(coords.formattedAddress && { formattedAddress: coords.formattedAddress }),
          };
        } else {
          updates.push({
            name: destName,
            lat: coords.lat,
            lng: coords.lng,
            ...(coords.placeId && { placeId: coords.placeId }),
            ...(coords.formattedAddress && { formattedAddress: coords.formattedAddress }),
          });
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
