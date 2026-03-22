'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';

const FEEDBACK_PREFIX = 'terrazzo_feedback_';
const SESSION_COUNT_KEY = 'terrazzo_total_sessions';

type FeedbackTrigger = 'first_session' | 'third_session';

interface FeedbackPrompt {
  trigger: FeedbackTrigger;
  title: string;
  question: string;
  placeholder: string;
}

const FEEDBACK_PROMPTS: FeedbackPrompt[] = [
  {
    trigger: 'first_session',
    title: 'Quick check-in',
    question: 'How did your first session feel? Anything confusing or missing?',
    placeholder: 'Be honest — this helps us make Terrazzo better...',
  },
  {
    trigger: 'third_session',
    title: 'One more thing',
    question: 'What\'s the one thing that would make you come back more often?',
    placeholder: 'A feature, a feeling, a fix...',
  },
];

/**
 * Tracks session counts across browser visits using localStorage.
 * Increments once per unique session (uses sessionStorage guard).
 */
function getAndIncrementSessionCount(): number {
  if (typeof window === 'undefined') return 0;

  // Only increment once per session
  const alreadyCounted = sessionStorage.getItem('terrazzo_session_counted');
  const currentCount = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);

  if (!alreadyCounted) {
    const newCount = currentCount + 1;
    localStorage.setItem(SESSION_COUNT_KEY, String(newCount));
    sessionStorage.setItem('terrazzo_session_counted', 'true');
    return newCount;
  }

  return currentCount;
}

/**
 * Hook that determines if an alpha feedback prompt should be shown.
 * Shows after first session (24h delay simulated by next visit)
 * and after third session.
 */
export function useAlphaFeedback(): {
  activePrompt: FeedbackPrompt | null;
  submitFeedback: (rating: number, text: string) => Promise<void>;
  dismissFeedback: () => void;
} {
  const [activePrompt, setActivePrompt] = useState<FeedbackPrompt | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    const count = getAndIncrementSessionCount();
    setSessionCount(count);

    // Check which feedback to show based on session count
    // First session feedback: show on session 2+ (i.e., they come back after first session)
    // Third session feedback: show on session 3+
    for (const prompt of FEEDBACK_PROMPTS) {
      const seen = localStorage.getItem(`${FEEDBACK_PREFIX}${prompt.trigger}`);
      if (seen) continue;

      if (prompt.trigger === 'first_session' && count >= 2) {
        // Small delay so it doesn't show immediately on load
        const timer = setTimeout(() => setActivePrompt(prompt), 3000);
        return () => clearTimeout(timer);
      }
      if (prompt.trigger === 'third_session' && count >= 3) {
        const timer = setTimeout(() => setActivePrompt(prompt), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const dismissFeedback = useCallback(() => {
    if (activePrompt) {
      localStorage.setItem(`${FEEDBACK_PREFIX}${activePrompt.trigger}`, 'dismissed');
    }
    setActivePrompt(null);
  }, [activePrompt]);

  const submitFeedback = useCallback(async (rating: number, text: string) => {
    if (!activePrompt) return;

    // Mark as submitted
    localStorage.setItem(`${FEEDBACK_PREFIX}${activePrompt.trigger}`, 'submitted');

    // Fire and forget to server
    try {
      await apiFetch('/api/analytics/feedback', {
        method: 'POST',
        body: JSON.stringify({
          trigger: activePrompt.trigger,
          rating,
          text,
          sessionCount,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Analytics should never break the app
    }

    setActivePrompt(null);
  }, [activePrompt, sessionCount]);

  return { activePrompt, submitFeedback, dismissFeedback };
}
