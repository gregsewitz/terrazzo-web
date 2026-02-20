'use client';

import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { initSavedDemoData, useSavedStore, DBSavedPlace, DBShortlist } from '@/stores/savedStore';
import { initTripDemoData, useTripStore, DBTrip } from '@/stores/tripStore';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import type { OnboardingDepth } from '@/types';

/**
 * Auth-aware store hydration.
 * - Authenticated: load user data from database
 * - Not authenticated: load demo data (code-split)
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
      // Load demo data for unauthenticated users
      hydrated.current = true;
      initSavedDemoData();
      initTripDemoData();
    }
  }, [isAuthenticated, isLoading]);

  return null;
}

async function loadUserData() {
  try {
    // Load saved places + shortlists
    const data = await apiFetch<{ places: DBSavedPlace[]; shortlists: DBShortlist[] }>('/api/places/mine');
    useSavedStore.getState().hydrateFromDB(data.places || [], data.shortlists || []);

    // Load trips
    const tripsData = await apiFetch<{ trips: DBTrip[] }>('/api/trips/mine');
    useTripStore.getState().hydrateFromDB(tripsData.trips || []);

    // Load profile data (taste profile, signals, etc.)
    // Use setState directly to avoid triggering write-through back to DB
    const profile = await apiFetch<{ user: Record<string, unknown> }>('/api/profile/mine');
    if (profile.user?.tasteProfile) {
      const onboarding = useOnboardingStore.getState();
      const updates: Record<string, unknown> = {};
      if (!onboarding.generatedProfile && profile.user.tasteProfile) {
        updates.generatedProfile = profile.user.tasteProfile;
      }
      if (!onboarding.isComplete && profile.user.isOnboardingComplete) {
        updates.isComplete = true;
        updates.onboardingDepth = (profile.user.onboardingDepth as OnboardingDepth) || 'full_flow';
      }
      if (profile.user.lifeContext) updates.lifeContext = profile.user.lifeContext;
      if (profile.user.allSignals) updates.allSignals = profile.user.allSignals;
      if (profile.user.allContradictions) updates.allContradictions = profile.user.allContradictions;
      if (profile.user.seedTrips) updates.seedTrips = profile.user.seedTrips;
      if (profile.user.trustedSources) updates.trustedSources = profile.user.trustedSources;
      if (Object.keys(updates).length > 0) {
        useOnboardingStore.setState(updates);
      }
    }
  } catch (err) {
    console.error('Failed to load user data, falling back to demo:', err);
    initSavedDemoData();
    initTripDemoData();
  }
}
