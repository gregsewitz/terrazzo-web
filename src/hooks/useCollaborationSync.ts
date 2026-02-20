'use client';

import { useEffect, useRef } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';

const POLL_INTERVAL = 5000; // 5 seconds

/**
 * Polls for new collaboration activity on the given trip.
 * Pauses when the document is hidden (tab in background).
 */
export function useCollaborationSync(tripId: string | null, enabled: boolean) {
  const pollActivity = useCollaborationStore(s => s.pollActivity);
  const loadTripCollaboration = useCollaborationStore(s => s.loadTripCollaboration);
  const reset = useCollaborationStore(s => s.reset);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    if (!tripId || !enabled) {
      reset();
      return;
    }
    loadTripCollaboration(tripId);
  }, [tripId, enabled, loadTripCollaboration, reset]);

  // Polling loop
  useEffect(() => {
    if (!tripId || !enabled) return;

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (!document.hidden) {
          pollActivity(tripId);
        }
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Immediately poll when becoming visible, then restart interval
        pollActivity(tripId);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [tripId, enabled, pollActivity]);
}
