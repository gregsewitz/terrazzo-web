'use client';

import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useSavedStore, DBSavedPlace, DBCollection } from '@/stores/savedStore';
import { useTripStore, DBTrip } from '@/stores/tripStore';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { ALL_PHASE_IDS, ALL_PHASE_IDS_V2 } from '@/constants/onboarding';
import type { OnboardingDepth } from '@/types';

/**
 * Auth-aware store hydration.
 * - Authenticated: load user data from database
 * - Not authenticated: start with empty stores
 */
export default function StoreHydration() {
  const { isAuthenticated, isLoading } = useAuth();
  const hydrated = useRef(false);

  useEffect(() => {
    // Always rehydrate onboarding from localStorage first
    useOnboardingStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (isLoading || hydrated.current) return;

    if (isAuthenticated) {
      // Load real user data from database
      hydrated.current = true;
      loadUserData();
    } else {
      // Unauthenticated users start with empty stores
      hydrated.current = true;
      useOnboardingStore.getState().setDbHydrated(true);
    }
  }, [isAuthenticated, isLoading]);

  return null;
}

async function loadUserData() {
  try {
    // Load saved places + collections
    const data = await apiFetch<{ places: DBSavedPlace[]; collections: DBCollection[] }>('/api/places/mine');
    useSavedStore.getState().hydrateFromDB(data.places || [], data.collections || []);

    // Load trips
    const tripsData = await apiFetch<{ trips: DBTrip[] }>('/api/trips/mine');
    useTripStore.getState().hydrateFromDB(tripsData.trips || []);

    // Load profile data from DB — DB is the source of truth for all taste data.
    // localStorage is only used for in-progress onboarding session state (phase progress,
    // messages accumulated during the current session before they're saved to DB).
    const profile = await apiFetch<{ user: Record<string, unknown> }>('/api/profile/mine');
    if (profile.user) {
      const onboarding = useOnboardingStore.getState();
      const updates: Record<string, unknown> = {};

      // DB always wins for taste profile data
      if (profile.user.tasteProfile) {
        updates.generatedProfile = profile.user.tasteProfile;
      }

      // Only restore completion status if we're not in a redo flow.
      // A redo sets isComplete=false + completedPhaseIds=[] while keeping the profile,
      // so if we have a profile but empty progress, the user is redoing — don't override.
      const isRedoInProgress = !onboarding.isComplete && onboarding.generatedProfile !== null
        && onboarding.completedPhaseIds.length === 0;
      if (!onboarding.isComplete && profile.user.isOnboardingComplete && !isRedoInProgress) {
        updates.isComplete = true;
        updates.onboardingDepth = (profile.user.onboardingDepth as OnboardingDepth) || 'full_flow';
      }

      // DB wins for all persisted taste data
      if (profile.user.lifeContext) updates.lifeContext = profile.user.lifeContext;
      if (profile.user.allSignals) updates.allSignals = profile.user.allSignals;
      if (profile.user.allContradictions) updates.allContradictions = profile.user.allContradictions;
      if (profile.user.seedTrips) updates.seedTrips = profile.user.seedTrips;
      if (profile.user.trustedSources) updates.trustedSources = profile.user.trustedSources;

      // Hydrate mosaic data from DB
      const mosaicData = profile.user.mosaicData as { answers?: unknown[]; axes?: Record<string, number> } | null;
      if (mosaicData?.answers) updates.mosaicAnswers = mosaicData.answers;
      if (mosaicData?.axes) updates.mosaicAxes = mosaicData.axes;

      // Hydrate property anchors from DB
      if (profile.user.propertyAnchors) updates.propertyAnchors = profile.user.propertyAnchors;

      // Hydrate sustainability signals from DB (stored as relation, returned as array)
      if (Array.isArray(profile.user.sustainabilitySignals) && (profile.user.sustainabilitySignals as unknown[]).length > 0) {
        updates.sustainabilitySignals = profile.user.sustainabilitySignals;
      }

      // Hydrate v3 act-routing state from DB single JSON column
      const routing = profile.user.onboardingRouting as {
        currentAct?: number;
        skippedPhaseIds?: string[];
        act0GapResult?: unknown;
        act1GapResult?: unknown;
      } | null;
      if (routing) {
        if (routing.currentAct !== undefined) updates.currentAct = routing.currentAct;
        if (routing.skippedPhaseIds) updates.skippedPhaseIds = routing.skippedPhaseIds;
        if (routing.act0GapResult) updates.act0GapResult = routing.act0GapResult;
        if (routing.act1GapResult) updates.act1GapResult = routing.act1GapResult;
      }

      // Merge completedPhaseIds from DB + localStorage (union — don't lose progress from either source)
      const dbPhaseIds = (profile.user.completedPhaseIds as string[]) || [];
      if (dbPhaseIds.length > 0) {
        const localPhaseIds = onboarding.completedPhaseIds || [];
        const merged = [...new Set([...localPhaseIds, ...dbPhaseIds])];
        updates.completedPhaseIds = merged;
        // Derive currentPhaseIndex from the furthest completed phase — try V2 list first, fall back to V1
        const maxIdxV2 = Math.max(...merged.map(id => (ALL_PHASE_IDS_V2 as readonly string[]).indexOf(id)).filter(i => i >= 0));
        if (maxIdxV2 >= 0 && maxIdxV2 + 1 < ALL_PHASE_IDS_V2.length) {
          updates.currentPhaseIndex = maxIdxV2 + 1;
        } else {
          // Fall back to legacy phase list for old sessions
          const maxIdx = Math.max(...merged.map(id => ALL_PHASE_IDS.indexOf(id)).filter(i => i >= 0));
          if (maxIdx >= 0 && maxIdx + 1 < ALL_PHASE_IDS.length) {
            updates.currentPhaseIndex = maxIdx + 1;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        useOnboardingStore.setState(updates);
      }
    }

    // Mark DB hydration complete — consumers can now trust the store data
    useOnboardingStore.getState().setDbHydrated(true);
  } catch (err) {
    console.error('Failed to load user data from database:', err);
    // Mark hydrated so UI doesn't hang, but do NOT load demo data for
    // authenticated users — showing fake data is worse than showing empty.
    // The user's localStorage data (if any) remains intact from the
    // rehydrate() call above.
    useOnboardingStore.getState().setDbHydrated(true);
  }
}
