import { useEffect, useRef, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { apiFetch } from '@/lib/api-client';
import type { QuickEntry, ImportedPlace } from '@/types';

// Stagger delay between resolution attempts to avoid hammering the API
const STAGGER_MS = 800;
// Auth retry: if the first attempt gets 401, wait and retry (token may be refreshing)
const AUTH_RETRY_DELAY = 2000;
const MAX_AUTH_RETRIES = 2;

/** Strip time expressions from activityContext so they don't show redundantly in the subtitle
 *  alongside PlaceTimeEditor's formatted time display. */
function stripTimeFromContext(text: string): string {
  return text
    // "at 6:30pm", "at 10am", "@3pm"
    .replace(/(?:at|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/g, '')
    // "6:30pm", "10am" standalone
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/g, '')
    // "at 14:30" 24h with prefix
    .replace(/(?:at|@)\s+\d{1,2}:\d{2}\b/g, '')
    // Clean up artifacts
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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
  // Track failure count per entry to avoid infinite retry loops
  const failCountRef = useRef<Map<string, number>>(new Map());

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
      // Retry on auth errors (401) — Supabase token may be mid-refresh
      let data: any;
      let lastErr: unknown;
      for (let attempt = 0; attempt <= MAX_AUTH_RETRIES; attempt++) {
        try {
          data = await apiFetch<any>('/api/places/resolve-quick-entry', {
            method: 'POST',
            body: JSON.stringify({
              text: entry.text,
              label: entry.label,
              category: entry.category,
              destination,
              lat,
              lng,
            }),
          });
          break; // success
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : '';
          if ((msg.includes('401') || msg.includes('Unauthorized')) && attempt < MAX_AUTH_RETRIES) {
            console.warn(`[useQuickEntryResolver] Auth retry ${attempt + 1}/${MAX_AUTH_RETRIES} for "${entry.label}"`);
            await new Promise(r => setTimeout(r, AUTH_RETRY_DELAY));
            continue;
          }
          throw err; // non-auth error or max retries exhausted
        }
      }

      if (data?.resolved && data.place) {
        // Build ImportedPlace from the resolved data
        // If the classifier detected an activity context (e.g., "9:30am boot camp class"),
        // store it so the card can display the activity prominently.
        const rawActivity: string | undefined = data.activityContext || undefined;
        // Strip redundant time from activityContext — the time is already on
        // specificTime and rendered by PlaceTimeEditor in "Reservation at 8:30 PM" format.
        const activity = rawActivity ? stripTimeFromContext(rawActivity) || undefined : undefined;
        // Use the cleaned label (time already stripped by parser) for userContext,
        // not the raw text which may contain "9:30am" and would show redundantly
        // as a subtitle alongside the PlaceTimeEditor time display.
        const contextNote = activity
          || (entry.label && entry.label !== data.place.name ? entry.label : undefined);
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
          userContext: contextNote,
          activityContext: activity,
          // Carry the entry's time forward on the resolved place so the store
          // action has a fallback even if the QuickEntry was already removed
          // from state (race condition with concurrent resolutions).
          specificTime: entry.specificTime,
          specificTimeLabel: entry.specificTimeLabel,
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
      // Allow retry on next render cycle, but cap at 3 total attempts
      const fails = (failCountRef.current.get(entryKey) || 0) + 1;
      failCountRef.current.set(entryKey, fails);
      if (fails < 3) {
        attemptedRef.current.delete(entryKey);
      }
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
    failCountRef.current.clear();
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
