'use client';

import { useState, useEffect, useCallback } from 'react';

const PROMPT_PREFIX = 'terrazzo_prompt_seen_';

export type PromptKey =
  | 'collect_intro'      // First visit to Collect page with seed places
  | 'trip_detail_intro'  // First visit to a trip detail page
  | 'add_bar_intro'      // First time opening the add bar
  | 'post_save_plan'     // After saving 3+ places
  | 'trip_day_complete'; // After completing first trip day

/**
 * Hook to manage first-action prompt visibility.
 * Each prompt shows once, then is permanently dismissed.
 */
export function useFirstActionPrompt(key: PromptKey): {
  isVisible: boolean;
  dismiss: () => void;
} {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(`${PROMPT_PREFIX}${key}`);
    if (!seen) {
      setIsVisible(true);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${PROMPT_PREFIX}${key}`, 'true');
    }
  }, [key]);

  return { isVisible, dismiss };
}

/**
 * Check if a prompt has been seen (without triggering visibility).
 */
export function hasSeenPrompt(key: PromptKey): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(`${PROMPT_PREFIX}${key}`) === 'true';
}
