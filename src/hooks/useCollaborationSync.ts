'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';

const BASE_INTERVAL = 5000;     // Start at 5s
const MAX_INTERVAL = 30000;     // Cap at 30s
const BACKOFF_FACTOR = 1.5;     // Multiply interval by 1.5x on each no-change poll
const STALE_RESET_THRESHOLD = 3; // After 3 consecutive no-change polls, start backing off

/**
 * Polls for new collaboration activity on the given trip.
 * Uses exponential backoff when no changes are detected.
 * Resets to fast polling when changes arrive or tab becomes visible.
 */
export function useCollaborationSync(tripId: string | null, enabled: boolean) {
  const pollActivity = useCollaborationStore(s => s.pollActivity);
  const loadTripCollaboration = useCollaborationStore(s => s.loadTripCollaboration);
  const reset = useCollaborationStore(s => s.reset);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalMs = useRef(BASE_INTERVAL);
  const noChangeCount = useRef(0);
  const lastDataHash = useRef<string>('');

  const clearPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetInterval = useCallback(() => {
    intervalMs.current = BASE_INTERVAL;
    noChangeCount.current = 0;
  }, []);

  // Initial load
  useEffect(() => {
    if (!tripId || !enabled) {
      reset();
      return;
    }
    loadTripCollaboration(tripId);
  }, [tripId, enabled, loadTripCollaboration, reset]);

  // Polling loop with exponential backoff
  useEffect(() => {
    if (!tripId || !enabled) return;

    const schedulePoll = () => {
      clearPoll();
      timeoutRef.current = setTimeout(async () => {
        if (document.hidden) {
          // Tab is hidden — schedule next poll at current interval but don't fetch
          schedulePoll();
          return;
        }

        // Capture store state before poll for change detection
        const stateBefore = JSON.stringify(useCollaborationStore.getState().activities?.length ?? 0);

        await pollActivity(tripId);

        const stateAfter = JSON.stringify(useCollaborationStore.getState().activities?.length ?? 0);

        if (stateBefore === stateAfter) {
          // No changes detected — back off
          noChangeCount.current++;
          if (noChangeCount.current >= STALE_RESET_THRESHOLD) {
            intervalMs.current = Math.min(intervalMs.current * BACKOFF_FACTOR, MAX_INTERVAL);
          }
        } else {
          // Changes detected — reset to fast polling
          resetInterval();
        }

        schedulePoll();
      }, intervalMs.current);
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        // Tab became visible — reset to fast polling and poll immediately
        resetInterval();
        clearPoll();
        pollActivity(tripId);
        schedulePoll();
      }
    };

    schedulePoll();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearPoll();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [tripId, enabled, pollActivity, clearPoll, resetInterval]);
}
