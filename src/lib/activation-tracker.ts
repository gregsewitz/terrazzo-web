'use client';

import { apiFetch } from '@/lib/api-client';

export type ActivationMilestone =
  | 'viewed_discover'
  | 'saved_place'
  | 'created_trip'
  | 'added_to_trip'
  | 'imported_external';

const ACTIVATION_KEY = 'terrazzo_activation';

interface ActivationState {
  milestones: Record<ActivationMilestone, string | null>; // ISO timestamp or null
  activatedAt: string | null;
}

function getState(): ActivationState {
  if (typeof window === 'undefined') {
    return {
      milestones: {
        viewed_discover: null,
        saved_place: null,
        created_trip: null,
        added_to_trip: null,
        imported_external: null,
      },
      activatedAt: null,
    };
  }
  try {
    const raw = localStorage.getItem(ACTIVATION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse errors
  }
  return {
    milestones: {
      viewed_discover: null,
      saved_place: null,
      created_trip: null,
      added_to_trip: null,
      imported_external: null,
    },
    activatedAt: null,
  };
}

function setState(state: ActivationState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVATION_KEY, JSON.stringify(state));
}

/**
 * Record an activation milestone. Idempotent — first occurrence wins.
 */
export function recordActivation(milestone: ActivationMilestone): void {
  const state = getState();
  if (state.milestones[milestone]) return; // Already recorded

  state.milestones[milestone] = new Date().toISOString();

  // Check if user is now activated (3 of 5 milestones)
  const completedCount = Object.values(state.milestones).filter(Boolean).length;
  if (completedCount >= 3 && !state.activatedAt) {
    state.activatedAt = new Date().toISOString();
    // Fire and forget: report activation to server
    reportActivation(state).catch(() => {});
  }

  setState(state);
}

/**
 * Check if user has been activated.
 */
export function isActivated(): boolean {
  return getState().activatedAt !== null;
}

/**
 * Get the current activation state for debugging/analytics.
 */
export function getActivationState(): ActivationState {
  return getState();
}

/**
 * Report activation to server for alpha analytics.
 */
async function reportActivation(state: ActivationState): Promise<void> {
  try {
    await apiFetch('/api/analytics/activation', {
      method: 'POST',
      body: JSON.stringify(state),
    });
  } catch {
    // Silently fail — analytics should never break the app
  }
}
