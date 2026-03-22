import { useMemo } from 'react';
import { Trip, ImportedPlace } from '@/types';
import { getAllPlaces } from './helpers';

export function useBriefingData(trip: Trip) {
  return useMemo(() => {
    const allPlaces = getAllPlaces(trip);
    const totalDays = trip.days.length;
    const destinations = trip.destinations || [trip.location];

    // Group places by destination
    const placesByDest = new Map<string, ImportedPlace[]>();
    trip.days.forEach(d => {
      const dest = d.destination || trip.location;
      const existing = placesByDest.get(dest) || [];
      existing.push(...d.slots.flatMap(s => s.places));
      placesByDest.set(dest, existing);
    });

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    allPlaces.forEach(p => {
      const src = p.source?.type || 'manual';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });

    // Friends — empty since friendAttribution is removed
    const friends: Array<{ name: string; count: number; places: string[]; note?: string }> = [];

    // Featured places — all confirmed itinerary places, richest editorial content first
    const featured = [...allPlaces]
      .sort((a, b) => {
        const scoreA = (a.terrazzoInsight?.why ? 2 : 0) + (a.whatToOrder?.length ? 1 : 0) + (a.tips?.length ? 1 : 0);
        const scoreB = (b.terrazzoInsight?.why ? 2 : 0) + (b.whatToOrder?.length ? 1 : 0) + (b.tips?.length ? 1 : 0);
        return scoreB - scoreA;
      });

    // Hotels
    const hotels = trip.days
      .filter(d => d.hotelInfo?.name || d.hotel)
      .map(d => ({ name: d.hotelInfo?.name || d.hotel || '', destination: d.destination }));
    const uniqueHotels = Array.from(new Set(hotels.map(h => h.name)));

    // Place types breakdown
    const typeMap: Record<string, number> = {};
    allPlaces.forEach(p => { typeMap[p.type] = (typeMap[p.type] || 0) + 1; });

    return {
      allPlaces, totalDays, destinations, placesByDest,
      sourceMap, friends, featured, uniqueHotels, typeMap,
    };
  }, [trip]);
}
