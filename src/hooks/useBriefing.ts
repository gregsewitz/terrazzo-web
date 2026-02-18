'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BriefingData } from '@/types';

interface UseBriefingResult {
  data: BriefingData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches briefing data for a place and polls while the pipeline is running.
 * Stops polling once status is 'complete' or 'failed'.
 */
export function useBriefing(googlePlaceId: string | undefined): UseBriefingResult {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const placeIdRef = useRef(googlePlaceId);

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async (placeId: string) => {
    try {
      const res = await fetch(`/api/intelligence/${placeId}`);
      if (res.status === 404) {
        setData(null);
        setLoading(false);
        clearPoll();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BriefingData = await res.json();
      setData(json);
      setError(null);

      // Stop polling if pipeline is done
      if (json.status === 'complete' || json.status === 'failed') {
        setLoading(false);
        clearPoll();
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      clearPoll();
    }
  }, [clearPoll]);

  useEffect(() => {
    placeIdRef.current = googlePlaceId;
    clearPoll();

    if (!googlePlaceId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Initial fetch
    fetchData(googlePlaceId);

    // Start polling — will self-stop when complete/failed
    intervalRef.current = setInterval(() => {
      if (placeIdRef.current === googlePlaceId) {
        fetchData(googlePlaceId);
      }
    }, 3000);

    return () => clearPoll();
  }, [googlePlaceId, fetchData, clearPoll]);

  return { data, loading, error };
}
