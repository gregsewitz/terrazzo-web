'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSavedStore } from '@/stores/savedStore';
import { apiFetch } from '@/lib/api-client';
import type { ImportedPlace } from '@/types';

const POLL_INTERVAL_MS = 8_000;  // 8 seconds between polls
const MAX_POLLS = 30;            // Stop after ~4 minutes
const SETTLE_DELAY_MS = 3_000;   // Wait 3s after mount before first poll
const RECENT_WINDOW_MS = 10 * 60 * 1000; // Only poll places added in last 10 min

interface RefreshResult {
  id: string;
  type?: string;
  location?: string;
  matchScore?: number;
  tasteNote?: string;
  google?: ImportedPlace['google'];
  enrichment?: ImportedPlace['enrichment'];
  whatToOrder?: string[];
  tips?: string[];
  alsoKnownAs?: string;
  terrazzoInsight?: ImportedPlace['terrazzoInsight'];
  enrichmentStatus?: string;
}

/**
 * App-level hook that automatically polls /api/places/refresh for
 * recently-imported places that are still under-enriched (no photoUrl,
 * no tasteNote, type still 'activity').
 *
 * Mounted once in the root layout via <EnrichmentWatcher />.
 * Patches go directly into useSavedStore.myPlaces, so every view
 * (library, collections, picks strip, rail, etc.) updates automatically.
 *
 * Stops when all recent places are enriched or after MAX_POLLS (~4 min).
 */
export function useEnrichmentPolling() {
  const patchPlaces = useSavedStore(s => s.patchPlaces);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  // Find recently-added places that still need enrichment
  const getUnderEnrichedIds = useCallback(() => {
    const cutoff = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
    return myPlaces
      .filter(p =>
        // Only poll recently-added places (avoids re-enriching old data)
        p.savedAt && p.savedAt >= cutoff
      )
      .filter(p =>
        !p.google?.photoUrl ||       // No photo yet
        !p.tasteNote ||              // No taste note yet
        p.type === 'activity'        // Still generic type
      )
      .map(p => p.id);
  }, [myPlaces]);

  const poll = useCallback(async () => {
    if (!activeRef.current) return;

    const needsRefresh = getUnderEnrichedIds();

    // All enriched or nothing to poll — stop
    if (needsRefresh.length === 0 || pollCount.current >= MAX_POLLS) {
      return;
    }

    pollCount.current++;

    try {
      // Cap at 50 per request (server limit)
      const batch = needsRefresh.slice(0, 50);
      const { places } = await apiFetch<{ places: RefreshResult[] }>('/api/places/refresh', {
        method: 'POST',
        body: JSON.stringify({ placeIds: batch }),
      });

      if (!activeRef.current) return;

      // Only patch places that actually have new data
      const patches = places
        .filter(p =>
          p.google?.photoUrl ||
          p.tasteNote ||
          (p.type && p.type !== 'activity') ||
          p.enrichmentStatus === 'complete'
        )
        .map(p => ({
          id: p.id,
          ...(p.type && p.type !== 'activity' ? { type: p.type } : {}),
          ...(p.tasteNote ? { tasteNote: p.tasteNote } : {}),
          ...(p.matchScore ? { matchScore: p.matchScore } : {}),
          ...(p.google ? { google: p.google } : {}),
          ...(p.whatToOrder ? { whatToOrder: p.whatToOrder } : {}),
          ...(p.tips ? { tips: p.tips } : {}),
          ...(p.alsoKnownAs ? { alsoKnownAs: p.alsoKnownAs } : {}),
          ...(p.terrazzoInsight ? { terrazzoInsight: p.terrazzoInsight } : {}),
        })) as Partial<ImportedPlace>[];

      if (patches.length > 0) {
        patchPlaces(patches);
      }

      // Check if there are still under-enriched places after patching
      const allComplete = places.every(
        p => p.enrichmentStatus === 'complete' || p.enrichmentStatus === 'failed'
      );

      if (!allComplete && activeRef.current) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.warn('[useEnrichmentPolling] Poll failed:', err);
      // Retry on next interval
      if (activeRef.current && pollCount.current < MAX_POLLS) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
  }, [getUnderEnrichedIds, patchPlaces]);

  // Start polling when under-enriched places exist
  const underEnrichedCount = getUnderEnrichedIds().length;

  useEffect(() => {
    activeRef.current = true;
    pollCount.current = 0;

    // Don't poll if nothing needs enrichment
    if (underEnrichedCount === 0) return;

    // Short delay before first poll to let the pipeline start
    timerRef.current = setTimeout(poll, SETTLE_DELAY_MS);

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Re-start when new under-enriched places appear (e.g., new import)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [underEnrichedCount > 0]);

  // No return value needed — patches go directly into the store
}
