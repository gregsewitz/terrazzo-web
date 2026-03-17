'use client';

import { StateCreator } from 'zustand';
import type {
  OnboardingLifeContext,
  SeedTripInput,
  TrustedSource,
  GoBackPlace,
  PropertyAnchor,
} from '@/types';
import type { OnboardingState } from './types';

// ─── Initial State ──────────────────────────────────────────────────────
const INITIAL_LIFE_CONTEXT: OnboardingLifeContext = {
  primaryCompanions: [],
};

export const INITIAL_CONTEXT_STATE = {
  lifeContext: { ...INITIAL_LIFE_CONTEXT },
  seedTrips: [] as SeedTripInput[],
  trustedSources: [] as TrustedSource[],
  goBackPlace: null as GoBackPlace | null,
  propertyAnchors: [] as PropertyAnchor[],
  pendingAnchors: [] as PropertyAnchor[],
};

// ─── Context Slice State ────────────────────────────────────────────────
export interface OnboardingContextState {
  // Life context
  lifeContext: OnboardingLifeContext;
  seedTrips: SeedTripInput[];
  trustedSources: TrustedSource[];
  goBackPlace: GoBackPlace | null;

  // Property anchors (resolved place mentions)
  propertyAnchors: PropertyAnchor[];
  pendingAnchors: PropertyAnchor[];

  // Context actions
  setLifeContext: (update: Partial<OnboardingLifeContext>) => void;
  addSeedTrip: (trip: SeedTripInput) => void;
  addTrustedSource: (source: TrustedSource) => void;
  setGoBackPlace: (place: GoBackPlace) => void;
  addPropertyAnchors: (anchors: PropertyAnchor[]) => void;
  removePropertyAnchor: (googlePlaceId: string) => void;
  addPendingAnchors: (anchors: PropertyAnchor[]) => void;
  flushPendingAnchors: () => PropertyAnchor[];
  removePendingAnchor: (googlePlaceId: string) => void;
}

// ─── Context Slice Factory ──────────────────────────────────────────────
export const createContextSlice: StateCreator<OnboardingState, [], [], OnboardingContextState> = (set, get) => ({
  ...INITIAL_CONTEXT_STATE,

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

  addPropertyAnchors: (anchors) => set((state) => {
    const existing = new Map(state.propertyAnchors.map((a) => [a.googlePlaceId, a]));
    for (const anchor of anchors) {
      const prev = existing.get(anchor.googlePlaceId);
      if (!prev || Math.abs(anchor.blendWeight) > Math.abs(prev.blendWeight)) {
        existing.set(anchor.googlePlaceId, anchor);
      }
    }
    return { propertyAnchors: Array.from(existing.values()) };
  }),

  removePropertyAnchor: (googlePlaceId) => set((state) => ({
    propertyAnchors: state.propertyAnchors.filter((a) => a.googlePlaceId !== googlePlaceId),
  })),

  addPendingAnchors: (anchors) => set((state) => {
    const existing = new Map(state.pendingAnchors.map((a) => [a.googlePlaceId, a]));
    for (const anchor of anchors) {
      const prev = existing.get(anchor.googlePlaceId);
      if (!prev || Math.abs(anchor.blendWeight) > Math.abs(prev.blendWeight)) {
        existing.set(anchor.googlePlaceId, anchor);
      }
    }
    return { pendingAnchors: Array.from(existing.values()) };
  }),

  flushPendingAnchors: () => {
    const state = get();
    const pending = state.pendingAnchors;
    if (!pending.length) return [];
    const existingMap = new Map(state.propertyAnchors.map((a) => [a.googlePlaceId, a]));
    for (const anchor of pending) {
      const prev = existingMap.get(anchor.googlePlaceId);
      if (!prev || Math.abs(anchor.blendWeight) > Math.abs(prev.blendWeight)) {
        existingMap.set(anchor.googlePlaceId, anchor);
      }
    }
    set({ propertyAnchors: Array.from(existingMap.values()), pendingAnchors: [] });
    return pending;
  },

  removePendingAnchor: (googlePlaceId) => set((state) => ({
    pendingAnchors: state.pendingAnchors.filter((a) => a.googlePlaceId !== googlePlaceId),
  })),
});
