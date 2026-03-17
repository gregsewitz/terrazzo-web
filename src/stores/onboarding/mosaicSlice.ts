'use client';

import { StateCreator } from 'zustand';
import type { TasteSignal } from '@/types';
import { dbSave } from '@/lib/db-save';
import { RESYNTHESIS_MILESTONES } from './profileSlice';
import type { OnboardingState } from './types';

// ─── Mosaic Answer Type ────────────────────────────────────────────────
export interface MosaicAnswer {
  questionId: number;
  axes: Record<string, number>;
  signals: string[];
  answeredAt: number;
}

// ─── Helper: Save mosaic data to DB ────────────────────────────────────
function saveMosaicToDB(data: Record<string, unknown>) {
  dbSave('/api/profile/save', 'POST', data);
}

// ─── Helper: Re-synthesize profile (used for milestone triggers) ───────
async function resynthesizeProfile(getState: () => OnboardingState) {
  try {
    const state = getState();
    // Import here to avoid circular dependencies
    const { apiFetch } = await import('@/lib/api-client');
    const res = await apiFetch<any>('/api/onboarding/synthesize', {
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
      console.log('[mosaic] Profile re-synthesized:', res.overallArchetype);
    }
  } catch (err) {
    console.warn('[mosaic] Re-synthesis failed (non-blocking):', err);
  }
}

// ─── Initial State ──────────────────────────────────────────────────────
export const INITIAL_MOSAIC_STATE = {
  mosaicAnswers: [] as MosaicAnswer[],
  mosaicAxes: {} as Record<string, number>,
};

// ─── Mosaic Slice State ────────────────────────────────────────────────
export interface OnboardingMosaicState {
  // Mosaic expansion
  mosaicAnswers: MosaicAnswer[];
  mosaicAxes: Record<string, number>;

  // Mosaic actions
  setMosaicAxes: (axes: Record<string, number>) => void;
  recordMosaicAnswer: (questionId: number, axes: Record<string, number>, signals: string[]) => void;
}

// ─── Mosaic Slice Factory ──────────────────────────────────────────────
export const createMosaicSlice: StateCreator<OnboardingState, [], [], OnboardingMosaicState> = (set, get) => ({
  ...INITIAL_MOSAIC_STATE,

  setMosaicAxes: (axes) => {
    set({ mosaicAxes: axes });
    const state = get();
    saveMosaicToDB({
      mosaicData: { answers: state.mosaicAnswers, axes },
    });
  },

  recordMosaicAnswer: (questionId, axes, signals) => {
    const state = get();

    const answer: MosaicAnswer = { questionId, axes, signals, answeredAt: Date.now() };
    const newAnswers = [...state.mosaicAnswers, answer];

    const newAxes = { ...state.mosaicAxes };
    for (const [axis, delta] of Object.entries(axes)) {
      const current = newAxes[axis] ?? 0.5;
      newAxes[axis] = Math.max(0, Math.min(1, current + delta));
    }

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

    saveMosaicToDB({
      allSignals: newAllSignals,
      mosaicData: { answers: newAnswers, axes: newAxes },
    });

    if (RESYNTHESIS_MILESTONES.has(newAnswers.length)) {
      resynthesizeProfile(get);
    }
  },
});
