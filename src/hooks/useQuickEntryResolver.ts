import { useEffect, useRef, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import type { QuickEntry, ImportedPlace } from '@/types';

// Stagger delay between resolution attempts to avoid hammering the API
const STAGGER_MS = 800;

/**
 * Hook that watches for new quick entries and silently attempts to resolve
 * them into real place cards via the resolve-quick-entry API.
 *
 * Runs as a background process — entries appear instantly, resolution
 * happens async and swaps in when ready.
 *
 * Returns `resolveAll()` — a one-shot function that re-attempts resolution
 * for all existing confirmed quick entries in the current trip.
 */
export function useQuickEntryResolver() {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const updateQuickEntry = useTripStore(s => s.updateQuickEntry);
  const resolveQuickEntry = useTripStore(s => s.resolveQuickEntry);

  // Track which entries we've already attempted to resolve
  const attemptedRef = useRef<Set<string>>(new Set());

  const trip = trips.find(t => t.id === currentTripId);

  const attemptResolve = useCallback(async (
    dayNumber: number,
    slotId: string,
    entry: QuickEntry,
    destination: string | undefined,
    lat: number | undefined,
    lng: number | undefined,
  ) => {
    const entryKey = entry.id;
    if (attemptedRef.current.has(entryKey)) return;
    attemptedRef.current.add(entryKey);

    // Skip tentative entries — wait for user to confirm
    if (entry.status === 'tentative') return;

    // Mark as resolving (shows shimmer on card)
    updateQuickEntry(dayNumber, slotId, entry.id, { status: 'resolving' });

    try {
      const res = await fetch('/api/places/resolve-quick-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: entry.text,
          label: entry.label,
          category: entry.category,
          destination,
          lat,
          lng,
        }),
      });

      if (!res.ok) {
        // Revert to confirmed on failure
        updateQuickEntry(dayNumber, slotId, entry.id, { status: 'confirmed' });
        return;
      }

      const data = await res.json();

      if (data.resolved && data.place) {
        // Build ImportedPlace from the resolved data
        const resolvedPlace: ImportedPlace = {
          id: `resolved-${entry.id}-${Date.now()}`,
          name: data.place.name,
          type: data.place.type || 'activity',
          location: data.place.location || destination || '',
          source: data.place.source || { type: 'quick_entry', name: 'Quick Entry' },
          matchScore: data.place.matchScore || 0,
          matchBreakdown: data.place.matchBreakdown || {},
          google: data.place.google || undefined,
          enrichment: data.place.enrichment || undefined,
          status: 'placed',
          userContext: entry.text !== entry.label ? entry.text : undefined,
          savedAt: new Date().toISOString(),
        };

        // Atomic swap: remove quick entry, add resolved place
        resolveQuickEntry(dayNumber, slotId, entry.id, resolvedPlace);
      } else {
        // Not a place or couldn't resolve — revert to confirmed
        updateQuickEntry(dayNumber, slotId, entry.id, { status: 'confirmed' });
      }
    } catch (err) {
      console.error('[useQuickEntryResolver] Resolution failed:', err);
      updateQuickEntry(dayNumber, slotId, entry.id, { status: 'confirmed' });
    }
  }, [updateQuickEntry, resolveQuickEntry]);

  // Watch for new confirmed quick entries and attempt resolution
  useEffect(() => {
    if (!trip) return;

    const destination = trip.destinations?.[0];
    const geo = trip.geoDestinations?.[0];
    const lat = geo?.lat;
    const lng = geo?.lng;

    for (const day of trip.days) {
      for (const slot of day.slots) {
        for (const entry of (slot.quickEntries || [])) {
          if (entry.status === 'confirmed' && !attemptedRef.current.has(entry.id)) {
            attemptResolve(day.dayNumber, slot.id, entry, destination, lat, lng);
          }
        }
      }
    }
  }, [trip, attemptResolve]);

  // Clear attempted set when trip changes
  useEffect(() => {
    attemptedRef.current.clear();
  }, [currentTripId]);

  /**
   * One-shot: re-attempt resolution for ALL existing confirmed quick entries
   * in the current trip. Clears the "already attempted" set and staggers
   * requests so we don't slam the API.
   */
  const resolveAll = useCallback(async () => {
    if (!trip) {
      console.warn('[resolveAll] No current trip');
      return;
    }

    const destination = trip.destinations?.[0];
    const geo = trip.geoDestinations?.[0];
    const lat = geo?.lat;
    const lng = geo?.lng;

    // Collect all confirmed quick entries
    const entries: Array<{ dayNumber: number; slotId: string; entry: QuickEntry }> = [];
    for (const day of trip.days) {
      for (const slot of day.slots) {
        for (const entry of (slot.quickEntries || [])) {
          if (entry.status === 'confirmed' || entry.status === 'tentative') {
            entries.push({ dayNumber: day.dayNumber, slotId: slot.id, entry });
          }
        }
      }
    }

    if (entries.length === 0) {
      console.log('[resolveAll] No quick entries to resolve');
      return;
    }

    console.log(`[resolveAll] Attempting resolution for ${entries.length} quick entries…`);

    // Clear the attempted set so all entries are eligible
    attemptedRef.current.clear();

    // Stagger requests to avoid hammering the API
    for (let i = 0; i < entries.length; i++) {
      const { dayNumber, slotId, entry } = entries[i];
      // Force status to confirmed so tentative entries also get resolved
      if (entry.status === 'tentative') {
        updateQuickEntry(dayNumber, slotId, entry.id, { status: 'confirmed' });
      }
      attemptResolve(dayNumber, slotId, { ...entry, status: 'confirmed' }, destination, lat, lng);
      if (i < entries.length - 1) {
        await new Promise(r => setTimeout(r, STAGGER_MS));
      }
    }
  }, [trip, attemptResolve, updateQuickEntry]);

  return { resolveAll };
}
