'use client';

/**
 * useTripSuggestions — lazy-loaded, cached Claude suggestions for a trip day.
 *
 * Shared between TripMapView and DayPlanner. Calls the suggestion API
 * when a day is first viewed, caches results by day + confirmed place IDs.
 * Cache auto-invalidates when confirmed places change (hash mismatch).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SuggestionItem, SuggestionResponse, ImportedPlace, Trip } from '@/types';
import { SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { apiFetch } from '@/lib/api-client';

interface CacheEntry {
  suggestions: SuggestionItem[];
  cacheKey: string;
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface UseTripSuggestionsOptions {
  enabled?: boolean;
  libraryPlaces?: ImportedPlace[];
}

interface UseTripSuggestionsResult {
  suggestions: SuggestionItem[];
  isLoading: boolean;
  error: string | null;
  isCached: boolean;
  refetch: () => void;
}

export function useTripSuggestions(
  trip: Trip | null | undefined,
  dayNumber: number | null,
  options: UseTripSuggestionsOptions = {}
): UseTripSuggestionsResult {
  const { enabled = true, libraryPlaces = [] } = options;

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Session-lived cache: Map<cacheKey, CacheEntry>
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Compute cache key from day + confirmed place IDs
  const cacheKey = useMemo(() => {
    if (!trip || dayNumber === null) return null;
    const day = trip.days.find(d => d.dayNumber === dayNumber);
    if (!day) return null;

    const confirmedIds = day.slots
      .flatMap(s => s.places.map(p => p.id))
      .sort()
      .join(',');
    return `${trip.id}:${dayNumber}:${simpleHash(confirmedIds)}`;
  }, [trip, dayNumber]);

  // Get current day data
  const day = useMemo(() => {
    if (!trip || dayNumber === null) return null;
    return trip.days.find(d => d.dayNumber === dayNumber) || null;
  }, [trip, dayNumber]);

  // Filter library candidates for this destination
  const candidates = useMemo(() => {
    if (!day?.destination || !libraryPlaces.length) return [];
    const dest = day.destination.toLowerCase();

    // Get all placed IDs to exclude
    const placedIds = new Set(
      day.slots.flatMap(s => s.places.map(p => p.id))
    );

    // Get slot types that are empty (these are the types we need)
    const emptySlotTypes = new Set<string>();
    day.slots.forEach(slot => {
      if (slot.places.length === 0) {
        const affinityTypes = SLOT_TYPE_AFFINITY[slot.id] || [];
        affinityTypes.forEach(t => emptySlotTypes.add(t));
      }
    });

    return libraryPlaces
      .filter(p => {
        if (placedIds.has(p.id)) return false;
        if (!p.google?.lat || !p.google?.lng) return false;
        // Location must roughly match destination
        const locMatch = p.location?.toLowerCase().includes(dest) || false;
        // Type should fit at least one empty slot
        const typeMatch = emptySlotTypes.has(p.type);
        return locMatch && typeMatch;
      })
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, 20);
  }, [day, libraryPlaces]);

  // Core fetch function
  const fetchSuggestions = useCallback(async (force = false) => {
    if (!trip || !day || dayNumber === null || !cacheKey) return;
    if (candidates.length === 0) {
      setSuggestions([]);
      return;
    }

    // Check cache (unless force refresh)
    if (!force) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setSuggestions(cached.suggestions);
        setIsCached(true);
        setError(null);
        return;
      }
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setIsCached(false);

    try {
      const response = await apiFetch<SuggestionResponse>(
        `/api/trips/${trip.id}/suggestions/generate`,
        {
          method: 'POST',
          body: JSON.stringify({
            dayNumber,
            tripName: trip.name || '',
            travelContext: trip.travelContext,
            groupSize: trip.groupSize,
            // Pass geo coordinates + ISO date for weather lookup
            ...(() => {
              const geo = trip.geoDestinations?.find(g =>
                g.name.toLowerCase().includes((day.destination || '').toLowerCase()) ||
                (day.destination || '').toLowerCase().includes(g.name.toLowerCase())
              ) || trip.geoDestinations?.[0];
              return geo?.lat && geo?.lng ? { destLat: geo.lat, destLng: geo.lng } : {};
            })(),
            day: {
              dayNumber: day.dayNumber,
              // Compute ISO date from trip.startDate + dayNumber offset
              // (day.date is human-readable like "Jun 12", not ISO)
              // For flexible-date trips, skip date entirely
              date: (() => {
                if (trip.flexibleDates || !trip.startDate) return undefined;
                const d = new Date(trip.startDate + 'T12:00:00');
                d.setDate(d.getDate() + (day.dayNumber - 1));
                return d.toISOString().split('T')[0];
              })(),
              dayOfWeek: day.dayOfWeek,
              destination: day.destination,
              slots: day.slots.map(s => ({
                id: s.id,
                label: s.label,
                time: s.time,
                places: s.places.map(p => ({
                  id: p.id,
                  name: p.name,
                  type: p.type,
                  location: p.location,
                })),
              })),
            },
            candidates: candidates.map(c => ({
              id: c.id,
              name: c.name,
              type: c.type,
              location: c.location,
              matchScore: c.matchScore,
              matchBreakdown: c.matchBreakdown,
              tasteNote: c.tasteNote,
            })),
          }),
          signal: controller.signal,
        }
      );

      // Only update if this request wasn't aborted
      if (!controller.signal.aborted) {
        setSuggestions(response.suggestions);
        setIsCached(false);

        // Store in cache
        cacheRef.current.set(cacheKey, {
          suggestions: response.suggestions,
          cacheKey,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // expected on abort
      console.error('[useTripSuggestions] Fetch error:', err);
      setError(err?.message || 'Failed to load suggestions');
      // Keep existing suggestions on error (graceful degradation)
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [trip, day, dayNumber, cacheKey, candidates]);

  // Auto-fetch when dependencies change and enabled
  useEffect(() => {
    if (!enabled || dayNumber === null || !cacheKey) {
      return;
    }
    fetchSuggestions();

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, cacheKey]); // cacheKey changes when confirmed places change

  // Manual refetch (force bypasses cache)
  const refetch = useCallback(() => {
    fetchSuggestions(true);
  }, [fetchSuggestions]);

  return { suggestions, isLoading, error, isCached, refetch };
}

// ─── Simple hash ──────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
