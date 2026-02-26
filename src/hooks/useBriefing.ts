'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BriefingData } from '@/types';

const BASE_INTERVAL = 3000;   // Start at 3s while pipeline is actively running
const MAX_INTERVAL = 15000;   // Cap at 15s
const BACKOFF_FACTOR = 1.5;   // Multiply by 1.5x each poll with same status
const MAX_POLLS = 60;         // Safety: stop after 60 polls (~3 min at base rate)

interface UseBriefingResult {
  data: BriefingData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches briefing data for a place and polls while the pipeline is running.
 * Uses exponential backoff when status hasn't changed between polls.
 * Stops polling once status is 'complete' or 'failed', or after MAX_POLLS.
 */
export function useBriefing(googlePlaceId: string | undefined): UseBriefingResult {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeIdRef = useRef(googlePlaceId);
  const intervalMs = useRef(BASE_INTERVAL);
  const lastStatus = useRef<string>('');
  const pollCount = useRef(0);

  const clearPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async (placeId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/intelligence/${placeId}`);
      if (res.status === 404) {
        setData(null);
        setLoading(false);
        return false; // stop polling
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BriefingData = await res.json();
      setData(json);
      setError(null);

      // Check if status changed since last poll
      const statusChanged = json.status !== lastStatus.current;
      lastStatus.current = json.status || '';

      // Stop polling if pipeline is done
      if (json.status === 'complete' || json.status === 'failed') {
        setLoading(false);
        return false; // stop polling
      }

      // Back off if status hasn't changed
      if (!statusChanged) {
        intervalMs.current = Math.min(intervalMs.current * BACKOFF_FACTOR, MAX_INTERVAL);
      } else {
        // Status changed (e.g. new stage) — reset to fast polling
        intervalMs.current = BASE_INTERVAL;
      }

      return true; // continue polling
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      return false; // stop polling
    }
  }, []);

  useEffect(() => {
    placeIdRef.current = googlePlaceId;
    clearPoll();
    intervalMs.current = BASE_INTERVAL;
    lastStatus.current = '';
    pollCount.current = 0;

    if (!googlePlaceId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const schedulePoll = async () => {
      if (placeIdRef.current !== googlePlaceId) return;
      if (pollCount.current >= MAX_POLLS) {
        setLoading(false);
        return;
      }

      pollCount.current++;
      const shouldContinue = await fetchData(googlePlaceId);

      if (shouldContinue && placeIdRef.current === googlePlaceId) {
        timeoutRef.current = setTimeout(schedulePoll, intervalMs.current);
      }
    };

    // Initial fetch, then schedule polling
    schedulePoll();

    return () => clearPoll();
  }, [googlePlaceId, fetchData, clearPoll]);

  return { data, loading, error };
}
