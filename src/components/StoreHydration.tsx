'use client';

import { useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';

/**
 * Triggers zustand persist hydration on the client side.
 * Must be rendered inside a client component (e.g., layout).
 * With skipHydration: true, the store won't try to access localStorage during SSR.
 */
export default function StoreHydration() {
  useEffect(() => {
    useOnboardingStore.persist.rehydrate();
  }, []);
  return null;
}
