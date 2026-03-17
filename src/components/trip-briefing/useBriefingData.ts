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
      const src = p.ghostSource || 'manual';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });

    // Friends
    const friendMap = new Map<string, { name: string; count: number; places: string[]; note?: string }>();
    allPlaces.forEach(p => {
      if (p.friendAttribution?.name) {
        const f = friendMap.get(p.friendAttribution.name) || {
          name: p.friendAttribution.name, count: 0, places: [],
        };
        f.count += 1;
        f.places.push(p.name);
        if (p.friendAttribution.note) f.note = p.friendAttribution.note;
        friendMap.set(p.friendAttribution.name, f);
      }
    });
    const friends = Array.from(friendMap.values()).sort((a, b) => b.count - a.count);

    // Featured places — ones with the best editorial content (insights, tips, what to order)
    const featured = [...allPlaces]
      .filter(p => p.terrazzoInsight?.why || (p.whatToOrder && p.whatToOrder.length > 0) || p.tips?.length)
      .sort((a, b) => {
        // Prefer places with more editorial richness
        const scoreA = (a.terrazzoInsight?.why ? 2 : 0) + (a.whatToOrder?.length ? 1 : 0) + (a.tips?.length ? 1 : 0);
        const scoreB = (b.terrazzoInsight?.why ? 2 : 0) + (b.whatToOrder?.length ? 1 : 0) + (b.tips?.length ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 6);

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
