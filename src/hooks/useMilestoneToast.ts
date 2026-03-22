'use client';

import { useEffect, useRef, useCallback } from 'react';

const MILESTONE_PREFIX = 'terrazzo_milestone_';

interface MilestoneConfig {
  key: string;
  condition: boolean;
  message: string;
}

/**
 * Hook that checks milestone conditions and fires a toast when reached.
 * Each milestone fires only once (persisted to localStorage).
 */
export function useMilestoneToast(
  milestones: MilestoneConfig[],
  showToast: (message: string) => void,
): void {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const m of milestones) {
      if (!m.condition) continue;
      if (firedRef.current.has(m.key)) continue;

      const storageKey = `${MILESTONE_PREFIX}${m.key}`;
      if (typeof window !== 'undefined' && localStorage.getItem(storageKey)) continue;

      // Fire!
      firedRef.current.add(m.key);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }

      // Slight delay so it doesn't compete with the action that triggered it
      setTimeout(() => showToast(m.message), 600);
      break; // Only fire one milestone per render cycle
    }
  }, [milestones, showToast]);
}
