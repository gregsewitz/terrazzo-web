'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createProgressSlice, type OnboardingProgressState } from './onboarding/progressSlice';
import { createProfileSlice, type OnboardingProfileState } from './onboarding/profileSlice';
import { createContextSlice, type OnboardingContextState } from './onboarding/contextSlice';
import { createMosaicSlice, type OnboardingMosaicState } from './onboarding/mosaicSlice';
import type { OnboardingState } from './onboarding/types';
import {
  ACT_1_PHASE_IDS,
  ACT_2_PHASE_IDS,
  ACT_3_PHASE_IDS,
  ALL_PHASE_IDS,
} from '@/constants/onboarding';
import { CORE_TASTE_DOMAINS, PREFERENCE_DIMENSIONS } from '@/types';
import { dbSave, flushSaves } from '@/lib/db-save';
import { V2_DOMAIN_SET } from './onboarding/profileSlice';

// ─── V1→V2 Domain Migration (for selectors) ────────────────────────────
const V1_TO_V2: Record<string, string> = {
  'Design': 'Design',
  'Atmosphere': 'Atmosphere',
  'Character': 'Character',
  'Service': 'Service',
  'FoodDrink': 'FoodDrink',
  'Geography': 'Geography',
  'Wellness': 'Wellness',
  'Sustainability': 'Sustainability',
  'Design Language': 'Design',
  'Design Sensibility': 'Design',
  'Character & Identity': 'Character',
  'Service Philosophy': 'Service',
  'Service Style': 'Service',
  'Food & Drink': 'FoodDrink',
  'Culinary': 'FoodDrink',
  'F&B': 'FoodDrink',
  'Location & Context': 'Geography',
  'Setting & Place': 'Geography',
  'Retreat & Wellbeing': 'Wellness',
  'Values & Sustainability': 'Sustainability',
};

// ═══════════════════════════════════════════
// Composed onboarding store (single store with all slices)
// ═══════════════════════════════════════════

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (...args) => ({
      ...createProgressSlice(...args),
      ...createProfileSlice(...args),
      ...createContextSlice(...args),
      ...createMosaicSlice(...args),
    }),
    {
      name: 'terrazzo-onboarding', // localStorage key
      version: 2, // v2 taxonomy migration
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // hydrate manually to avoid SSR issues
      // Don't persist actions or transient UI state
      partialize: (state) => ({
        isComplete: state.isComplete,
        currentPhaseIndex: state.currentPhaseIndex,
        completedPhaseIds: state.completedPhaseIds,
        currentPhaseProgress: state.currentPhaseProgress,
        onboardingDepth: state.onboardingDepth,
        certainties: state.certainties,
        allSignals: state.allSignals, // @deprecated — in-session only; TasteNode is canonical store
        allMessages: state.allMessages,
        allContradictions: state.allContradictions,
        sustainabilitySignals: state.sustainabilitySignals,
        generatedProfile: state.generatedProfile,
        mosaicAnswers: state.mosaicAnswers,
        mosaicAxes: state.mosaicAxes,
        lifeContext: state.lifeContext,
        seedTrips: state.seedTrips,
        trustedSources: state.trustedSources,
        goBackPlace: state.goBackPlace,
        propertyAnchors: state.propertyAnchors,
        pendingAnchors: state.pendingAnchors,
        gapCheckResult: state.gapCheckResult,
        currentAct: state.currentAct,
        skippedPhaseIds: state.skippedPhaseIds,
        act1GapResult: state.act1GapResult,
        act2GapResult: state.act2GapResult,
      }),
    }
  )
);

// ─── Flush pending saves on tab close ───
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useOnboardingStore.getState();
    if (!state.isComplete && state.allSignals.length > 0) {
      flushSaves();
    }
  });
}

// ═══════════════════════════════════════════
// Selectors
// ═══════════════════════════════════════════

export const selectCurrentPhaseId = (state: OnboardingState) =>
  ALL_PHASE_IDS[state.currentPhaseIndex] ?? null;

export const selectIsAct1Complete = (state: OnboardingState) =>
  ACT_1_PHASE_IDS.every((id) => state.completedPhaseIds.includes(id));

export const selectProfileIsComplete = (state: OnboardingState) => {
  const c = state.certainties;
  const coreComplete = CORE_TASTE_DOMAINS.every(d => (c[d] ?? 0) >= 70);
  const prefComplete = PREFERENCE_DIMENSIONS.every(d => (c[d] ?? 0) >= 50);
  return coreComplete && prefComplete;
};

/**
 * Detect whether the user's store data has v1 taxonomy artifacts that need migration.
 * Checks signals (cat field) and certainty keys for non-v2 domain names.
 */
export const selectNeedsV2Migration = (state: OnboardingState): boolean => {
  const hasV1Signals = state.allSignals.some(
    (s) => !V2_DOMAIN_SET.has(s.cat) && V1_TO_V2[s.cat] !== undefined
  );
  if (hasV1Signals) return true;

  const hasV1Certainties = Object.keys(state.certainties).some(
    (k) => !V2_DOMAIN_SET.has(k) && V1_TO_V2[k] !== undefined
  );
  if (hasV1Certainties) return true;

  const profile = state.generatedProfile;
  if (profile?.radarData?.length) {
    const hasV1Axes = profile.radarData.some(
      (r: { axis: string }) => !V2_DOMAIN_SET.has(r.axis) && V1_TO_V2[r.axis] !== undefined
    );
    if (hasV1Axes) return true;
  }

  return false;
};

// ─── Act-Completion Selectors ───

export const selectCurrentPhaseIdV2 = (state: OnboardingState) =>
  ALL_PHASE_IDS[state.currentPhaseIndex] ?? null;

export const selectIsAct1Complete2 = (state: OnboardingState) =>
  ACT_1_PHASE_IDS.every((id) => state.completedPhaseIds.includes(id));

export const selectIsAct2Complete2 = (state: OnboardingState) =>
  ACT_2_PHASE_IDS.every((id) =>
    state.completedPhaseIds.includes(id) || state.skippedPhaseIds.includes(id)
  );

export const selectIsAct3Complete = (state: OnboardingState) =>
  ACT_3_PHASE_IDS.every((id) =>
    state.completedPhaseIds.includes(id) || state.skippedPhaseIds.includes(id)
  );

// ─── Re-exports ───

export type { MosaicAnswer } from './onboarding/mosaicSlice';
