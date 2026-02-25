'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useTripStore } from '@/stores/tripStore';
import { seedTripToCreationData } from '@/lib/seedTrips';
import RevealSequence from '@/components/onboarding/RevealSequence';

export default function RevealPage() {
  const router = useRouter();
  const { generatedProfile, finishOnboarding, onboardingDepth, seedTrips } = useOnboardingStore();
  const createTrip = useTripStore((s) => s.createTrip);
  const hasCreatedTrips = useRef(false);

  const handleComplete = () => {
    if (!onboardingDepth) {
      finishOnboarding('full_flow');
    }

    // Create seed trips from onboarding data
    if (!hasCreatedTrips.current && seedTrips.length > 0) {
      hasCreatedTrips.current = true;
      seedTrips.forEach((seed) => {
        const data = seedTripToCreationData(seed);
        createTrip(data);
      });
    }

    router.push('/trips');
  };

  if (!generatedProfile) {
    // Fallback: if no profile was generated (API failure), skip reveal
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
        <div className="max-w-lg w-full text-center">
          <h2 className="font-serif text-[28px] text-[var(--t-ink)] mb-3">
            You&apos;re all set
          </h2>
          <p className="text-[15px] text-[var(--t-ink)]/60 mb-6">
            We captured enough to start showing you personalized recommendations.
            Your profile will sharpen as you use the app.
          </p>
          <button
            onClick={handleComplete}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all
              hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--t-ink)' }}
          >
            Start exploring
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--t-cream)]">
      <RevealSequence profile={generatedProfile} onComplete={handleComplete} />
    </div>
  );
}
