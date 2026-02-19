'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function Home() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const isComplete = useOnboardingStore((s) => s.isComplete);

  // Wait for store hydration before redirecting
  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useOnboardingStore.persist.onFinishHydration(() => {
        setHydrated(true);
        unsub();
      });
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isComplete) {
      router.replace('/trips');
    } else {
      router.replace('/onboarding');
    }
  }, [hydrated, isComplete, router]);

  // Brief loading state while hydrating + redirecting
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--t-cream)]">
      <h1 className="font-serif text-[32px] text-[var(--t-ink)] animate-pulse">
        Terrazzo
      </h1>
    </div>
  );
}
