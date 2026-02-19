'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_PHASE_IDS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK } from '@/constants/theme';

const isDev = process.env.NODE_ENV === 'development';

export default function OnboardingIntro() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const {
    finishOnboarding,
    reset,
    completedPhaseIds,
    currentPhaseIndex,
    isComplete,
  } = useOnboardingStore();

  // Wait for zustand hydration from localStorage before showing resume UI
  useEffect(() => {
    // Check if already hydrated (StoreHydration component triggers this in layout)
    const check = () => {
      if (useOnboardingStore.persist.hasHydrated()) {
        setHydrated(true);
      } else {
        // Not yet — listen for hydration finish
        const unsub = useOnboardingStore.persist.onFinishHydration(() => {
          setHydrated(true);
          unsub();
        });
      }
    };
    // Small delay to let StoreHydration run first
    const timer = setTimeout(check, 50);
    return () => clearTimeout(timer);
  }, []);

  const hasInProgressSession = hydrated && !isComplete && completedPhaseIds.length > 0;
  const currentPhaseId = ALL_PHASE_IDS[currentPhaseIndex] || ALL_PHASE_IDS[0];

  const handleStart = () => {
    reset(); // clear any previous session
    setIsStarting(true);
    setTimeout(() => {
      router.push(`/onboarding/phase/${ALL_PHASE_IDS[0]}`);
    }, 400);
  };

  const handleResume = () => {
    setIsStarting(true);
    setTimeout(() => {
      router.push(`/onboarding/phase/${currentPhaseId}`);
    }, 400);
  };

  const handleDevSkip = () => {
    finishOnboarding('act_1_only');
    router.push('/trips');
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div
        className={`max-w-sm w-full text-center transition-all duration-500 ${isStarting ? 'opacity-0 translate-y-4' : 'opacity-100'}`}
      >
        {/* Logo / brand mark */}
        <div className="mb-10">
          <h1 className="font-serif text-[42px] text-[var(--t-ink)] leading-none">
            Terrazzo
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--t-ink)]/40 mt-1">
            Your bespoke travel concierge
          </p>
        </div>

        {/* Welcome copy */}
        <div className="space-y-4 mb-10">
          {hasInProgressSession ? (
            <>
              <p className="text-[17px] leading-relaxed text-[var(--t-ink)]/80">
                Welcome back — you&apos;re {completedPhaseIds.length} of {ALL_PHASE_IDS.length} sections
                into building your taste profile.
              </p>
              <p className="text-[15px] leading-relaxed text-[var(--t-ink)]/50">
                Pick up right where you left off, or start fresh.
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] leading-relaxed text-[var(--t-ink)]/80">
                I&apos;m going to learn how you see the world when you travel — the details you notice,
                the places that stuck with you, the things that drive you crazy.
              </p>
              <p className="text-[15px] leading-relaxed text-[var(--t-ink)]/50">
                Takes about 5 minutes. You can talk or type — whatever feels natural.
              </p>
            </>
          )}
        </div>

        {/* Action buttons */}
        {hasInProgressSession ? (
          <div className="space-y-3">
            <button
              onClick={handleResume}
              className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all
                hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--t-ink)' }}
            >
              Continue where I left off
            </button>
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-xl text-[14px] font-medium transition-all
                hover:opacity-70 active:scale-[0.98]"
              style={{ color: 'var(--t-ink)', opacity: 0.5 }}
            >
              Start over
            </button>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all
              hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--t-ink)' }}
          >
            Let&apos;s get started
          </button>
        )}

        {/* Subtle reassurance */}
        <p className="text-[12px] text-[var(--t-ink)]/30 mt-4">
          You can always refine your profile later
        </p>

        {/* Skip to app */}
        <button
          onClick={handleDevSkip}
          className="mt-6 text-[12px] font-medium transition-colors hover:opacity-70"
          style={{
            color: INK['35'],
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT.sans,
          }}
        >
          Skip to app →
        </button>
      </div>
    </div>
  );
}
