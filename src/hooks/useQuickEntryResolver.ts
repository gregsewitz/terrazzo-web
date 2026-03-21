import { useEffect, useRef, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import type { QuickEntry, ImportedPlace } from '@/types';

/**
 * Hook that watches for new quick entries and silently attempts to resolve
 * them into real place cards via the resolve-quick-entry API.
 *
 * Runs as a background process — entries appear instantly, resolution
 * happens async and swaps in when ready.
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

    // Get destination info for location bias
    const destination = trip.destinations?.[0];
    const geo = trip.geoDestinations?.[0];
    const lat = geo?.lat;
    const lng = geo?.lng;

    for (const day of trip.days) {
      for (const slot of day.slots) {
        for (const entry of (slot.quickEntries || [])) {
          // Only attempt resolution for confirmed entries we haven't tried yet
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
}
