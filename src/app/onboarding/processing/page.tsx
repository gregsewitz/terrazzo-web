'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PROCESSING_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function ProcessingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const hasSynthesized = useRef(false);
  const { allSignals, allMessages, allContradictions, certainties, setGeneratedProfile } = useOnboardingStore();

  // Animate through processing steps
  useEffect(() => {
    if (currentStep < PROCESSING_STEPS.length - 1) {
      const timer = setTimeout(() => setCurrentStep((i) => i + 1), 800);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Call synthesis API
  useEffect(() => {
    if (hasSynthesized.current) return;
    hasSynthesized.current = true;

    const synthesize = async () => {
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

        if (res.ok) {
          const profile = await res.json();
          setGeneratedProfile(profile);
        }
      } catch (err) {
        console.error('Synthesis failed:', err);
      }

      // Wait for animation to finish before navigating
      const minDelay = Math.max(0, PROCESSING_STEPS.length * 800 - 2000);
      setTimeout(() => {
        setIsDone(true);
      }, minDelay);
    };

    synthesize();
  }, [allSignals, allMessages, allContradictions, certainties, setGeneratedProfile]);

  useEffect(() => {
    if (isDone) {
      setTimeout(() => router.push('/onboarding/reveal'), 500);
    }
  }, [isDone, router]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-sm w-full">
        {/* Animated brand mark */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-[32px] text-[var(--t-ink)]">
            Building your profile
          </h1>
        </div>

        {/* Processing steps */}
        <div className="space-y-3">
          {PROCESSING_STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDoneStep = i < currentStep;
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
                      ? 'bg-[var(--t-honey)] animate-pulse'
                      : 'bg-[var(--t-travertine)]'
                  }
                `}>
                  {isDoneStep ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isActive ? (
                    <div className="w-2 h-2 rounded-full bg-white" />
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

        {/* Progress bar */}
        <div className="mt-8 h-1 rounded-full bg-[var(--t-travertine)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--t-honey)] transition-all duration-700 ease-out"
            style={{ width: `${((currentStep + 1) / PROCESSING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
