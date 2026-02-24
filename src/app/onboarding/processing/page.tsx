'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PROCESSING_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function ProcessingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hasSynthesized = useRef(false);
  const { allSignals, allMessages, allContradictions, certainties, setGeneratedProfile } = useOnboardingStore();

  // Animate through processing steps — stagger timing so early steps feel snappy,
  // middle steps feel like real work, and the last step holds until the API returns
  useEffect(() => {
    if (hasError) return; // pause animation on error
    if (currentStep < PROCESSING_STEPS.length - 1) {
      // First couple steps go a bit faster, middle steps slower, creating a natural rhythm
      const delay = currentStep < 2 ? 1200 : currentStep < 5 ? 1800 : 2200;
      const timer = setTimeout(() => setCurrentStep((i) => i + 1), delay);
      return () => clearTimeout(timer);
    }
  }, [currentStep, hasError]);

  const runSynthesis = useCallback(async () => {
    setHasError(false);
    try {
      const res = await fetch('/api/onboarding/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signals: allSignals,
          messages: allMessages,
          contradictions: allContradictions,
          certainties,
        }),
      });

      if (!res.ok) throw new Error(`Synthesis returned ${res.status}`);

      const profile = await res.json();
      setGeneratedProfile(profile);

      // Wait for animation to finish before navigating
      // Steps take ~14s total (variable timing), so allow up to that before proceeding
      const minDelay = Math.max(0, PROCESSING_STEPS.length * 1800 - 2000);
      setTimeout(() => setIsDone(true), minDelay);
    } catch (err) {
      console.error('Synthesis failed:', err);
      setHasError(true);
    }
  }, [allSignals, allMessages, allContradictions, certainties, setGeneratedProfile]);

  // Initial synthesis call
  useEffect(() => {
    if (hasSynthesized.current) return;
    hasSynthesized.current = true;
    runSynthesis();
  }, [runSynthesis]);

  // Navigate to reveal when done
  useEffect(() => {
    if (isDone) {
      setTimeout(() => router.push('/onboarding/reveal'), 500);
    }
  }, [isDone, router]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    setCurrentStep(0); // restart animation
    runSynthesis();
  };

  const handleSkipToReveal = () => {
    // Skip synthesis and go to reveal with fallback UI
    router.push('/onboarding/reveal');
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-sm w-full">
        {/* Animated brand mark */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-[32px] text-[var(--t-ink)]">
            {hasError ? 'Hit a snag' : 'Building your profile'}
          </h1>
          {hasError && (
            <p className="text-[15px] text-[var(--t-ink)]/60 mt-2">
              The profile synthesis didn&apos;t go through — this sometimes happens with complex taste profiles.
            </p>
          )}
        </div>

        {/* Processing steps */}
        {!hasError && (
          <div className="space-y-3">
            {PROCESSING_STEPS.map((step, i) => {
              const isActive = i === currentStep;
              const isDoneStep = i < currentStep;
              const isLastStep = i === PROCESSING_STEPS.length - 1;
              return (
                <div
                  key={step}
                  className={`
                    flex items-center gap-3 transition-all duration-500
                    ${isActive ? 'opacity-100' : isDoneStep ? 'opacity-40' : 'opacity-10'}
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                    transition-all duration-300
                    ${isDoneStep
                      ? 'bg-[var(--t-verde)]'
                      : isActive
                        ? 'bg-[var(--t-honey)]'
                        : 'bg-[var(--t-travertine)]'
                    }
                  `}>
                    {isDoneStep ? (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : isActive && isLastStep ? (
                      /* Spinning indicator on the final step so it's clearly still working */
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : isActive ? (
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    ) : null}
                  </div>
                  <span className={`
                    font-mono text-[13px] transition-colors duration-300
                    ${isActive ? 'text-[var(--t-ink)]' : 'text-[var(--t-ink)]/50'}
                  `}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Error actions */}
        {hasError && (
          <div className="space-y-3 mt-6">
            <button
              onClick={handleRetry}
              className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all
                hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--t-ink)' }}
            >
              Try again{retryCount > 0 ? ` (attempt ${retryCount + 2})` : ''}
            </button>
            <button
              onClick={handleSkipToReveal}
              className="w-full py-3 rounded-xl text-[14px] font-medium transition-all
                hover:opacity-70 active:scale-[0.98]"
              style={{ color: 'var(--t-ink)', opacity: 0.5 }}
            >
              Skip — use what you have
            </button>
          </div>
        )}

        {/* Progress bar */}
        {!hasError && (
          <div className="mt-8 h-1 rounded-full bg-[var(--t-travertine)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--t-honey)] transition-all duration-700 ease-out"
              style={{ width: `${((currentStep + 1) / PROCESSING_STEPS.length) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
