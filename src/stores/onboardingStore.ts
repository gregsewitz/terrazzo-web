'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  TasteSignal, TasteContradiction, ConversationMessage,
  GeneratedTasteProfile, TrustedSource, GoBackPlace,
  SeedTripInput, OnboardingLifeContext, OnboardingDepth,
  SustainabilitySignal, TasteDomain,
} from '@/types';
import { ALL_TASTE_DOMAINS, CORE_TASTE_DOMAINS, PREFERENCE_DIMENSIONS } from '@/types';
import { ALL_PHASE_IDS, ACT_1_PHASE_IDS } from '@/constants/onboarding';

// ─── V1→V2 Domain Migration (one-time) ─────────────────────────────────────
// Maps legacy v1 domain/category names to canonical v2 TasteDomain keys.
// Used only by migrateStoreToV2() to remap existing signals and certainties.
const V1_TO_V2: Record<string, TasteDomain> = {
  // v2 domain names — identity mappings
  'Design': 'Design', 'Atmosphere': 'Atmosphere', 'Character': 'Character',
  'Service': 'Service', 'FoodDrink': 'FoodDrink', 'Setting': 'Setting',
  'Wellness': 'Wellness', 'Sustainability': 'Sustainability',
  // Display name variants the LLM may produce
  'Design Language': 'Design', 'Design Sensibility': 'Design',
  'Character & Identity': 'Character',
  'Service Philosophy': 'Service', 'Service Style': 'Service',
  'Food & Drink': 'FoodDrink', 'Culinary': 'FoodDrink', 'F&B': 'FoodDrink',
  'Location & Context': 'Setting', 'Setting & Place': 'Setting',
  'Retreat & Wellbeing': 'Wellness',
  'Values & Sustainability': 'Sustainability',
};

const V2_DOMAIN_SET = new Set<string>(ALL_TASTE_DOMAINS);
import { apiFetch } from '@/lib/api-client';
import { dbSave, flushSaves } from '@/lib/db-save';

/** Save profile data to DB with retry + error surfacing */
function saveProfileToDB(data: Record<string, unknown>) {
  dbSave('/api/profile/save', 'POST', data);
}

/** Milestones at which we re-synthesize the full taste profile */
const RESYNTHESIS_MILESTONES = new Set([10, 25, 50, 75, 95]);

/** Re-synthesize the full taste profile from all signals + contradictions */
async function resynthesizeProfile() {
  try {
    const state = useOnboardingStore.getState();
    const res = await apiFetch<GeneratedTasteProfile>('/api/onboarding/synthesize', {
      method: 'POST',
      body: JSON.stringify({
        signals: state.allSignals,
        messages: state.allMessages,
        contradictions: state.allContradictions,
        certainties: state.certainties,
      }),
    });

    if (res && res.overallArchetype) {
      useOnboardingStore.setState({ generatedProfile: res });
      // Persist to DB
      saveProfileToDB({ tasteProfile: res });
      console.log('[mosaic] Profile re-synthesized:', res.overallArchetype);
    }
  } catch (err) {
    console.warn('[mosaic] Re-synthesis failed (non-blocking):', err);
  }
}

/** A single mosaic answer record for persistence */
export interface MosaicAnswer {
  questionId: number;
  axes: Record<string, number>;   // axis deltas applied
  signals: string[];              // signals emitted
  answeredAt: number;             // timestamp
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

  // ─── Sustainability Signals ───
  sustainabilitySignals: SustainabilitySignal[];

  // ─── Expand Your Mosaic ───
  mosaicAnswers: MosaicAnswer[];      // full answer log (persisted)
  mosaicAxes: Record<string, number>; // accumulated axis values (running totals, start at 0.5)

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

  // ─── Hydration ───
  /** True once DB profile data has been loaded (or skipped for unauth users) */
  dbHydrated: boolean;

  // ─── Actions ───
  setPhaseIndex: (index: number) => void;
  setCurrentPhaseProgress: (progress: number) => void;
  completePhase: (phaseId: string) => void;
  updateCertainties: (values: Record<string, number>) => void;
  addSignals: (signals: TasteSignal[]) => void;
  addMessages: (messages: ConversationMessage[]) => void;
  addContradictions: (contradictions: TasteContradiction[]) => void;
  addSustainabilitySignals: (signals: SustainabilitySignal[]) => void;
  setGeneratedProfile: (profile: GeneratedTasteProfile) => void;
  setLifeContext: (update: Partial<OnboardingLifeContext>) => void;
  addSeedTrip: (trip: SeedTripInput) => void;
  addTrustedSource: (source: TrustedSource) => void;
  setGoBackPlace: (place: GoBackPlace) => void;
  setLiveMode: (live: boolean) => void;
  finishOnboarding: (depth: OnboardingDepth) => Promise<void>;
  recordMosaicAnswer: (questionId: number, axes: Record<string, number>, signals: string[]) => void;
  /** Manually trigger a full re-synthesis of the taste profile (e.g. after prompt updates) */
  triggerResynthesis: () => Promise<boolean>;
  /** Remap v1 signals/certainties to v2 domains, then re-synthesize */
  migrateStoreToV2: () => Promise<boolean>;
  reset: () => void;
  /** Soft reset for "redo onboarding" — keeps all taste data & profile, only resets progress */
  resetForRedo: () => void;
  setDbHydrated: (hydrated: boolean) => void;
}

const INITIAL_CERTAINTIES: Record<TasteDomain, number> = {
  // 6 Taste Domains — start low, rich signal space to fill
  Design: 5, Atmosphere: 5, Character: 5, Service: 5, FoodDrink: 5, Setting: 5,
  // 2 Preference Dimensions — start slightly higher, thinner signal space
  Wellness: 10, Sustainability: 10,
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
      sustainabilitySignals: [],
      generatedProfile: null,
      mosaicAnswers: [],
      mosaicAxes: {},
      lifeContext: { ...INITIAL_LIFE_CONTEXT },
      seedTrips: [],
      trustedSources: [],
      goBackPlace: null,
      isLiveMode: false,
      dbHydrated: false,

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

      addSustainabilitySignals: (signals) => set((state) => ({
        sustainabilitySignals: [...state.sustainabilitySignals, ...signals],
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

      finishOnboarding: async (depth) => {
        set({ isComplete: true, onboardingDepth: depth });
        const state = get();
        saveProfileToDB({
          tasteProfile: state.generatedProfile,
          lifeContext: state.lifeContext,
          allSignals: state.allSignals,
          allContradictions: state.allContradictions,
          seedTrips: state.seedTrips,
          trustedSources: state.trustedSources,
          completedPhaseIds: state.completedPhaseIds,
          isOnboardingComplete: true,
          onboardingDepth: depth,
        });
        // Wait for all pending saves to complete — this is the critical moment
        await flushSaves();
      },

      recordMosaicAnswer: (questionId, axes, signals) => {
        const state = get();

        // Build new answer record
        const answer: MosaicAnswer = { questionId, axes, signals, answeredAt: Date.now() };
        const newAnswers = [...state.mosaicAnswers, answer];

        // Accumulate axis deltas (start at 0.5, clamp 0–1)
        const newAxes = { ...state.mosaicAxes };
        for (const [axis, delta] of Object.entries(axes)) {
          const current = newAxes[axis] ?? 0.5;
          newAxes[axis] = Math.max(0, Math.min(1, current + delta));
        }

        // Convert to TasteSignals and append to allSignals
        const newTasteSignals: TasteSignal[] = signals.map(tag => ({
          tag,
          cat: 'Mosaic',
          confidence: 0.75,
        }));
        const newAllSignals = [...state.allSignals, ...newTasteSignals];

        set({
          mosaicAnswers: newAnswers,
          mosaicAxes: newAxes,
          allSignals: newAllSignals,
        });

        // Fire-and-forget save to DB — persist signals + mosaic axes
        saveProfileToDB({
          allSignals: newAllSignals,
          mosaicData: { answers: newAnswers, axes: newAxes },
        });

        // Trigger re-synthesis at milestones (non-blocking)
        if (RESYNTHESIS_MILESTONES.has(newAnswers.length)) {
          resynthesizeProfile();
        }
      },

      triggerResynthesis: async () => {
        try {
          await resynthesizeProfile();
          return true;
        } catch {
          return false;
        }
      },

      migrateStoreToV2: async () => {
        try {
          const state = get();

          // Remap signal categories
          const migratedSignals = state.allSignals.map((s) => {
            const mapped = V1_TO_V2[s.cat];
            return mapped && mapped !== s.cat ? { ...s, cat: mapped } : s;
          });

          // Remap certainty keys — merge into v2 structure
          const migratedCertainties: Record<string, number> = { ...INITIAL_CERTAINTIES };
          for (const [key, value] of Object.entries(state.certainties)) {
            const mapped = V1_TO_V2[key];
            if (mapped) {
              // Take the higher value when multiple v1 keys map to the same v2 domain
              migratedCertainties[mapped] = Math.max(migratedCertainties[mapped] ?? 0, value);
            }
          }

          // Update store with remapped data
          set({
            allSignals: migratedSignals,
            certainties: migratedCertainties,
          });

          console.log('[mosaic] Store migrated to v2 taxonomy — triggering re-synthesis');

          // Re-synthesize with v2-native prompts
          await resynthesizeProfile();
          return true;
        } catch (err) {
          console.error('[mosaic] V2 migration failed:', err);
          return false;
        }
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
        sustainabilitySignals: [],
        generatedProfile: null,
        mosaicAnswers: [],
        mosaicAxes: {},
        lifeContext: { ...INITIAL_LIFE_CONTEXT },
        seedTrips: [],
        trustedSources: [],
        goBackPlace: null,
      }),

      resetForRedo: () => set({
        // Only reset progress tracking — keep all taste data intact
        isComplete: false,
        currentPhaseIndex: 0,
        completedPhaseIds: [],
        currentPhaseProgress: 0,
        onboardingDepth: null,
        // Everything else (signals, messages, contradictions, generatedProfile,
        // mosaicAnswers, mosaicAxes, lifeContext, seedTrips, trustedSources,
        // goBackPlace, certainties) is intentionally preserved
      }),

      setDbHydrated: (hydrated) => set({ dbHydrated: hydrated }),
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
        allSignals: state.allSignals,
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
      }),
    }
  )
);

// ─── Flush pending saves on tab close ───
// During onboarding, profile data is saved via fire-and-forget `dbSave`.
// If the user closes/refreshes the tab before `finishOnboarding` is called,
// those queued writes could be lost. This listener flushes them synchronously.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useOnboardingStore.getState();
    // Only flush if onboarding is in progress (has signals but isn't complete)
    if (!state.isComplete && state.allSignals.length > 0) {
      flushSaves();
    }
  });
}

// ─── Selectors ───

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
  // Check if any signal has a non-v2 category
  const hasV1Signals = state.allSignals.some(
    (s) => !V2_DOMAIN_SET.has(s.cat) && V1_TO_V2[s.cat] !== undefined
  );
  if (hasV1Signals) return true;

  // Check if any certainty key is a v1 name
  const hasV1Certainties = Object.keys(state.certainties).some(
    (k) => !V2_DOMAIN_SET.has(k) && V1_TO_V2[k] !== undefined
  );
  if (hasV1Certainties) return true;

  // Check if stored profile radarData has v1 axis names
  const profile = state.generatedProfile;
  if (profile?.radarData?.length) {
    const hasV1Axes = profile.radarData.some(
      (r: { axis: string }) => !V2_DOMAIN_SET.has(r.axis) && V1_TO_V2[r.axis] !== undefined
    );
    if (hasV1Axes) return true;
  }

  return false;
};
