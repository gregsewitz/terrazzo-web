'use client';

import { StateCreator } from 'zustand';
import type {
  OnboardingDepth,
  DomainGapCheckResult,
} from '@/types';
import type { ActNumber } from '@/constants/onboarding';
import { apiFetch } from '@/lib/api-client';
import { dbSave, flushSaves } from '@/lib/db-save';
import type { OnboardingState } from './types';
import { INITIAL_PROFILE_STATE } from './profileSlice';
import { INITIAL_CONTEXT_STATE } from './contextSlice';
import { INITIAL_MOSAIC_STATE } from './mosaicSlice';

// ─── Helper: Save profile data to DB ─────────────────────────────────────
function saveProgressToDB(data: Record<string, unknown>) {
  dbSave('/api/profile/save', 'POST', data);
}

// ─── Initial State ──────────────────────────────────────────────────────
export const INITIAL_PROGRESS_STATE = {
  isComplete: false,
  currentPhaseIndex: 0,
  completedPhaseIds: [] as string[],
  currentPhaseProgress: 0,
  onboardingDepth: null as OnboardingDepth | null,
  gapCheckResult: null as DomainGapCheckResult | null,
  gapCheckLoading: false,
  currentAct: 1 as ActNumber,
  skippedPhaseIds: [] as string[],
  act1GapResult: null as DomainGapCheckResult | null,
  act2GapResult: null as DomainGapCheckResult | null,
  dbHydrated: false,
};

// ─── Progress Slice State ─────────────────────────────────────────────────
export interface OnboardingProgressState {
  // Phase navigation & routing
  isComplete: boolean;
  currentPhaseIndex: number;
  completedPhaseIds: string[];
  currentPhaseProgress: number; // 0-1, how far along the current phase conversation is
  onboardingDepth: OnboardingDepth | null;

  // Domain gap analysis
  gapCheckResult: DomainGapCheckResult | null;
  gapCheckLoading: boolean;

  // 3-Act adaptive routing
  currentAct: ActNumber;
  skippedPhaseIds: string[];
  act1GapResult: DomainGapCheckResult | null;
  act2GapResult: DomainGapCheckResult | null;

  // Hydration state
  dbHydrated: boolean;

  // Progress actions
  setPhaseIndex: (index: number) => void;
  setCurrentPhaseProgress: (progress: number) => void;
  completePhase: (phaseId: string) => void;
  runDomainGapCheck: () => Promise<DomainGapCheckResult | null>;
  setCurrentAct: (act: ActNumber) => void;
  runGapAnalysisForActTransition: (completedAct: 1 | 2) => Promise<void>;
  finishOnboarding: (depth: OnboardingDepth) => Promise<void>;
  setDbHydrated: (hydrated: boolean) => void;
  reset: () => void;
  resetForRedo: () => void;
}

// ─── Progress Slice Factory ─────────────────────────────────────────────
export const createProgressSlice: StateCreator<OnboardingState, [], [], OnboardingProgressState> = (set, get) => ({
  ...INITIAL_PROGRESS_STATE,

  setPhaseIndex: (index) => set({ currentPhaseIndex: index, currentPhaseProgress: 0 }),

  setCurrentPhaseProgress: (progress) => set({ currentPhaseProgress: Math.min(1, Math.max(0, progress)) }),

  completePhase: (phaseId) => set((state) => ({
    currentPhaseProgress: 1,
    completedPhaseIds: state.completedPhaseIds.includes(phaseId)
      ? state.completedPhaseIds
      : [...state.completedPhaseIds, phaseId],
  })),

  runDomainGapCheck: async () => {
    const state = get();
    if (!state.allSignals.length || !state.generatedProfile?.radarData?.length) {
      console.warn('[gap-check] Skipping — insufficient data');
      return null;
    }
    set({ gapCheckLoading: true });
    try {
      const result = await apiFetch<DomainGapCheckResult>('/api/onboarding/domain-gap-check', {
        method: 'POST',
        body: JSON.stringify({
          signals: state.allSignals,
          radarData: state.generatedProfile.radarData,
          existingAnchorIds: state.propertyAnchors.map((a) => a.googlePlaceId),
        }),
      });
      set({ gapCheckResult: result, gapCheckLoading: false });
      console.log('[gap-check] Result:', result?.coverage?.gapDomains?.length, 'gap domains');
      return result;
    } catch (err) {
      console.error('[gap-check] Failed:', err);
      set({ gapCheckLoading: false });
      return null;
    }
  },

  setCurrentAct: (act) => set({ currentAct: act }),

  runGapAnalysisForActTransition: async (completedAct) => {
    const state = get();
    set({ gapCheckLoading: true });

    try {
      const result = await apiFetch<DomainGapCheckResult>('/api/onboarding/domain-gap-check', {
        method: 'POST',
        body: JSON.stringify({
          signals: state.allSignals,
          radarData: state.generatedProfile?.radarData ?? [],
          existingAnchorIds: state.propertyAnchors.map((a) => a.googlePlaceId),
        }),
      });

      if (completedAct === 1) {
        set({ act1GapResult: result });
        const gapDomains = result?.coverage?.gapDomains ?? [];
        console.log('[gap-analysis] After Act 1 → cold domains:', gapDomains.length > 0 ? gapDomains : 'none');
      } else if (completedAct === 2) {
        set({ act2GapResult: result, gapCheckResult: result });

        const gapDomains = result?.coverage?.gapDomains ?? [];
        if (gapDomains.length === 0) {
          set((s) => ({
            skippedPhaseIds: [...s.skippedPhaseIds, 'gap-fill-reactions'],
          }));
          console.log('[gap-analysis] After Act 2 → no cold domains, skipping gap-fill-reactions');
        } else {
          console.log('[gap-analysis] After Act 2 → cold domains:', gapDomains);
        }
      }
    } catch (err) {
      console.error('[gap-analysis] Failed (fail-open — not skipping adaptive phases):', err);
      if (completedAct === 1) {
        set({ act1GapResult: null });
      } else {
        set({ act2GapResult: null });
      }
    } finally {
      set({ gapCheckLoading: false });
    }
  },

  finishOnboarding: async (depth) => {
    set({ isComplete: true, onboardingDepth: depth });
    const state = get();
    const payload = {
      tasteProfile: state.generatedProfile,
      lifeContext: state.lifeContext,
      allSignals: state.allSignals,
      allMessages: state.allMessages,
      allContradictions: state.allContradictions,
      sustainabilitySignals: state.sustainabilitySignals,
      seedTrips: state.seedTrips,
      trustedSources: state.trustedSources,
      propertyAnchors: state.propertyAnchors,
      completedPhaseIds: state.completedPhaseIds,
      isOnboardingComplete: true,
      onboardingDepth: depth,
      currentAct: state.currentAct,
      skippedPhaseIds: state.skippedPhaseIds,
      act1GapResult: state.act1GapResult,
      act2GapResult: state.act2GapResult,
    };

    // Primary path: queue-based save with retry
    saveProgressToDB(payload);
    const flushed = await flushSaves();

    // Fallback: if the queued save failed (e.g. auth timing), try a direct call.
    // This is the most critical save in the app — losing signals here means the
    // user's entire onboarding data is gone.
    if (!flushed) {
      console.warn('[onboarding] Queued save failed — attempting direct save as fallback');
      try {
        await apiFetch('/api/profile/save', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        console.log('[onboarding] Direct fallback save succeeded');
      } catch (err) {
        console.error('[onboarding] CRITICAL: Both queued and direct saves failed. Onboarding data may be lost.', err);
      }
    }

    apiFetch('/api/onboarding/compute-vectors', { method: 'POST' })
      .then((res) => console.log('[onboarding] Vectors computed:', res))
      .catch((err) => console.warn('[onboarding] Vector computation failed (non-blocking):', err));
  },

  setDbHydrated: (hydrated) => set({ dbHydrated: hydrated }),

  reset: () => set({
    ...INITIAL_PROGRESS_STATE,
    ...INITIAL_PROFILE_STATE,
    ...INITIAL_CONTEXT_STATE,
    ...INITIAL_MOSAIC_STATE,
  }),

  resetForRedo: () => set({
    isComplete: false,
    currentPhaseIndex: 0,
    completedPhaseIds: [],
    currentPhaseProgress: 0,
    onboardingDepth: null,
    currentAct: 1 as ActNumber,
    skippedPhaseIds: [],
    act1GapResult: null,
    act2GapResult: null,
  }),
});
