'use client';

import { useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { initSavedDemoData } from '@/stores/savedStore';
import { initTripDemoData } from '@/stores/tripStore';

/**
 * Triggers zustand persist hydration AND lazy-loads demo seed data.
 * Demo data is code-split via dynamic import() so it doesn't bloat the
 * initial JS bundle (~1,750 lines deferred).
 */
export default function StoreHydration() {
  useEffect(() => {
    useOnboardingStore.persist.rehydrate();
    // Fire-and-forget: demo data loads in parallel, populates stores once ready
    initSavedDemoData();
    initTripDemoData();
  }, []);
  return null;
}
