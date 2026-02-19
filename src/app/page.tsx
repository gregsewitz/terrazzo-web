'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function Home() {
  const router = useRouter();
  const isComplete = useOnboardingStore((s) => s.isComplete);

  useEffect(() => {
    if (isComplete) {
      router.replace('/trips');
    } else {
      router.replace('/onboarding');
    }
  }, [isComplete, router]);

  // Brief loading state while redirecting
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--t-cream)]">
      <h1 className="font-serif text-[32px] text-[var(--t-ink)] animate-pulse">
        Terrazzo
      </h1>
    </div>
  );
}
