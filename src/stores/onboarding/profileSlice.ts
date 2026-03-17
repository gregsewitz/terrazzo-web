'use client';

import { StateCreator } from 'zustand';
import type {
  TasteSignal,
  TasteContradiction,
  ConversationMessage,
  GeneratedTasteProfile,
  SustainabilitySignal,
  TasteDomain,
} from '@/types';
import { ALL_TASTE_DOMAINS, CORE_TASTE_DOMAINS } from '@/types';
import { apiFetch } from '@/lib/api-client';
import { dbSave } from '@/lib/db-save';
import type { OnboardingState } from './types';

// ─── V1→V2 Domain Migration (one-time) ───────────────────────────────────
const V1_TO_V2: Record<string, TasteDomain> = {
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

export const V2_DOMAIN_SET = new Set<string>(ALL_TASTE_DOMAINS);

// ─── Resynthesis Milestones ─────────────────────────────────────────────
export const RESYNTHESIS_MILESTONES = new Set([10, 25, 50, 75, 95]);

// ─── Helper: Save profile data to DB ─────────────────────────────────────
function saveProfileToDB(data: Record<string, unknown>) {
  dbSave('/api/profile/save', 'POST', data);
}

// ─── Helper: Re-synthesize profile ──────────────────────────────────────
async function resynthesizeProfile(getState: () => OnboardingState) {
  try {
    const state = getState();
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
      const storeState = getState();
      storeState.setGeneratedProfile(res);
      console.log('[profile] Profile re-synthesized:', res.overallArchetype);
    }
  } catch (err) {
    console.warn('[profile] Re-synthesis failed (non-blocking):', err);
  }
}

// ─── Initial State ──────────────────────────────────────────────────────
const INITIAL_CERTAINTIES: Record<TasteDomain, number> = {
  Design: 5,
  Atmosphere: 5,
  Character: 5,
  Service: 5,
  FoodDrink: 5,
  Geography: 5,
  Wellness: 10,
  Sustainability: 10,
};

export const INITIAL_PROFILE_STATE = {
  certainties: { ...INITIAL_CERTAINTIES },
  allSignals: [] as TasteSignal[],
  allMessages: [] as ConversationMessage[],
  allContradictions: [] as TasteContradiction[],
  generatedProfile: null as GeneratedTasteProfile | null,
  sustainabilitySignals: [] as SustainabilitySignal[],
};

// ─── Profile Slice State ────────────────────────────────────────────────
export interface OnboardingProfileState {
  // Taste profiling
  certainties: Record<string, number>;
  allSignals: TasteSignal[];
  allMessages: ConversationMessage[];
  allContradictions: TasteContradiction[];
  generatedProfile: GeneratedTasteProfile | null;
  sustainabilitySignals: SustainabilitySignal[];

  // Profile actions
  updateCertainties: (values: Record<string, number>) => void;
  addSignals: (signals: TasteSignal[]) => void;
  addMessages: (messages: ConversationMessage[]) => void;
  addContradictions: (contradictions: TasteContradiction[]) => void;
  addSustainabilitySignals: (signals: SustainabilitySignal[]) => void;
  setGeneratedProfile: (profile: GeneratedTasteProfile) => void;
  triggerResynthesis: () => Promise<boolean>;
  migrateStoreToV2: () => Promise<boolean>;
}

// ─── Profile Slice Factory ──────────────────────────────────────────────
export const createProfileSlice: StateCreator<OnboardingState, [], [], OnboardingProfileState> = (set, get) => ({
  ...INITIAL_PROFILE_STATE,

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

  triggerResynthesis: async () => {
    try {
      await resynthesizeProfile(get);
      return true;
    } catch {
      return false;
    }
  },

  migrateStoreToV2: async () => {
    try {
      const state = get();

      const migratedSignals = state.allSignals.map((s) => {
        const mapped = V1_TO_V2[s.cat];
        return mapped && mapped !== s.cat ? { ...s, cat: mapped } : s;
      });

      const migratedCertainties: Record<string, number> = { ...INITIAL_CERTAINTIES };
      for (const [key, value] of Object.entries(state.certainties)) {
        const mapped = V1_TO_V2[key];
        if (mapped) {
          migratedCertainties[mapped] = Math.max(migratedCertainties[mapped] ?? 0, value);
        }
      }

      set({
        allSignals: migratedSignals,
        certainties: migratedCertainties,
      });

      console.log('[profile] Store migrated to v2 taxonomy — triggering re-synthesis');

      await resynthesizeProfile(get);
      return true;
    } catch (err) {
      console.error('[profile] V2 migration failed:', err);
      return false;
    }
  },
});
