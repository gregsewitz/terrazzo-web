'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  TasteSignal, TasteContradiction, ConversationMessage,
  GeneratedTasteProfile, TrustedSource, GoBackPlace,
  SeedTripInput, OnboardingLifeContext, OnboardingDepth,
} from '@/types';
import { ALL_PHASE_IDS, ACT_1_PHASE_IDS } from '@/constants/onboarding';
import { apiFetch } from '@/lib/api-client';

/** Fire-and-forget profile save to DB */
function saveProfileToDB(data: Record<string, unknown>) {
  apiFetch('/api/profile/save', {
    method: 'POST',
    body: JSON.stringify(data),
  }).catch(err => console.warn('[onboardingStore] DB save failed:', err));
}

interface OnboardingState {
  // ─── Progress ───
  isComplete: boolean;
  currentPhaseIndex: number;
  completedPhaseIds: string[];
  currentPhaseProgress: number; // 0-1, how far along the current phase conversation is
  onboardingDepth: OnboardingDepth | null;

  // ─── Taste Profiling ───
  certainties: Record<string, number>;
  allSignals: TasteSignal[];
  allMessages: ConversationMessage[];
  allContradictions: TasteContradiction[];
  generatedProfile: GeneratedTasteProfile | null;

  // ─── Life Context ───
  lifeContext: OnboardingLifeContext;

  // ─── Trip Seeding ───
  seedTrips: SeedTripInput[];

  // ─── Trusted Sources ───
  trustedSources: TrustedSource[];

  // ─── Go-Back Place ───
  goBackPlace: GoBackPlace | null;

  // ─── Mode ───
  isLiveMode: boolean;

  // ─── Actions ───
  setPhaseIndex: (index: number) => void;
  setCurrentPhaseProgress: (progress: number) => void;
  completePhase: (phaseId: string) => void;
  updateCertainties: (values: Record<string, number>) => void;
  addSignals: (signals: TasteSignal[]) => void;
  addMessages: (messages: ConversationMessage[]) => void;
  addContradictions: (contradictions: TasteContradiction[]) => void;
  setGeneratedProfile: (profile: GeneratedTasteProfile) => void;
  setLifeContext: (update: Partial<OnboardingLifeContext>) => void;
  addSeedTrip: (trip: SeedTripInput) => void;
  addTrustedSource: (source: TrustedSource) => void;
  setGoBackPlace: (place: GoBackPlace) => void;
  setLiveMode: (live: boolean) => void;
  finishOnboarding: (depth: OnboardingDepth) => void;
  reset: () => void;
}

const INITIAL_CERTAINTIES: Record<string, number> = {
  Design: 5, Character: 5, Service: 5, Food: 5, Location: 5, Wellness: 5,
};

const INITIAL_LIFE_CONTEXT: OnboardingLifeContext = {
  primaryCompanions: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // ─── Initial State ───
      isComplete: false,
      currentPhaseIndex: 0,
      completedPhaseIds: [],
      currentPhaseProgress: 0,
      onboardingDepth: null,
      certainties: { ...INITIAL_CERTAINTIES },
      allSignals: [],
      allMessages: [],
      allContradictions: [],
      generatedProfile: null,
      lifeContext: { ...INITIAL_LIFE_CONTEXT },
      seedTrips: [],
      trustedSources: [],
      goBackPlace: null,
      isLiveMode: false,

      // ─── Actions ───
      setPhaseIndex: (index) => set({ currentPhaseIndex: index, currentPhaseProgress: 0 }),

      setCurrentPhaseProgress: (progress) => set({ currentPhaseProgress: Math.min(1, Math.max(0, progress)) }),

      completePhase: (phaseId) => set((state) => ({
        currentPhaseProgress: 1, // fill the bar when phase completes
        completedPhaseIds: state.completedPhaseIds.includes(phaseId)
          ? state.completedPhaseIds
          : [...state.completedPhaseIds, phaseId],
      })),

      updateCertainties: (values) => set((state) => ({
        certainties: { ...state.certainties, ...values },
      })),

      addSignals: (signals) => set((state) => ({
        allSignals: [...state.allSignals, ...signals],
      })),

      addMessages: (messages) => set((state) => ({
        allMessages: [...state.allMessages, ...messages],
      })),

      addContradictions: (contradictions) => set((state) => ({
        allContradictions: [...state.allContradictions, ...contradictions],
      })),

      setGeneratedProfile: (profile) => {
        set({ generatedProfile: profile });
        saveProfileToDB({ tasteProfile: profile });
      },

      setLifeContext: (update) => set((state) => ({
        lifeContext: { ...state.lifeContext, ...update },
      })),

      addSeedTrip: (trip) => set((state) => ({
        seedTrips: [...state.seedTrips, trip],
      })),

      addTrustedSource: (source) => set((state) => ({
        trustedSources: [...state.trustedSources, source],
      })),

      setGoBackPlace: (place) => set({ goBackPlace: place }),

      setLiveMode: (live) => set({ isLiveMode: live }),

      finishOnboarding: (depth) => {
        set({ isComplete: true, onboardingDepth: depth });
        const state = get();
        saveProfileToDB({
          tasteProfile: state.generatedProfile,
          lifeContext: state.lifeContext,
          allSignals: state.allSignals,
          allContradictions: state.allContradictions,
          seedTrips: state.seedTrips,
          trustedSources: state.trustedSources,
          isOnboardingComplete: true,
          onboardingDepth: depth,
        });
      },

      reset: () => set({
        isComplete: false,
        currentPhaseIndex: 0,
        completedPhaseIds: [],
        currentPhaseProgress: 0,
        onboardingDepth: null,
        certainties: { ...INITIAL_CERTAINTIES },
        allSignals: [],
        allMessages: [],
        allContradictions: [],
        generatedProfile: null,
        lifeContext: { ...INITIAL_LIFE_CONTEXT },
        seedTrips: [],
        trustedSources: [],
        goBackPlace: null,
      }),
    }),
    {
      name: 'terrazzo-onboarding', // localStorage key
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
        allSignals: state.allSignals,
        allMessages: state.allMessages,
        allContradictions: state.allContradictions,
        generatedProfile: state.generatedProfile,
        lifeContext: state.lifeContext,
        seedTrips: state.seedTrips,
        trustedSources: state.trustedSources,
        goBackPlace: state.goBackPlace,
      }),
    }
  )
);

// ─── Selectors ───

export const selectCurrentPhaseId = (state: OnboardingState) =>
  ALL_PHASE_IDS[state.currentPhaseIndex] ?? null;

export const selectIsAct1Complete = (state: OnboardingState) =>
  ACT_1_PHASE_IDS.every((id) => state.completedPhaseIds.includes(id));

export const selectProfileIsComplete = (state: OnboardingState) =>
  Object.values(state.certainties).every((v) => v >= 70);
