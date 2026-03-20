'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PROCESSING_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { pregenerateDiscoverFeed } from '@/lib/pregenerate-discover';
import type { GeneratedTasteProfile } from '@/types';

export default function ProcessingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hasSynthesized = useRef(false);
  const { allSignals, allMessages, allContradictions, certainties, setGeneratedProfile } = useOnboardingStore();

  // Animate through processing steps — timing covers the API wait.
  // Parallel synthesis takes ~8-12s, so steps ramp at a leisurely pace.
  // The last step holds (spinner) until the API actually returns.
  useEffect(() => {
    if (hasError) return; // pause animation on error
    if (currentStep < PROCESSING_STEPS.length - 1) {
      // Ramp: 1800 → 2050 → 2300 → 2550 → 2800 → 3050 → 3300 ≈ 17.85s total
      const delay = 1800 + currentStep * 250;
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

      const profile: GeneratedTasteProfile = await res.json();
      setGeneratedProfile(profile);

      // Fire and forget discover pre-generation — don't block the processing animation
      const lifeContext = useOnboardingStore.getState().lifeContext;
      if (profile) {
        pregenerateDiscoverFeed(profile, lifeContext).catch(() => {});
      }

      // Wait for animation to finish before navigating
      // Steps take ~17.85s total (ramped timing), give a small buffer so the last check
      // mark has time to appear before we transition
      const totalAnimTime = Array.from({ length: PROCESSING_STEPS.length - 1 }, (_, i) => 1800 + i * 250)
        .reduce((sum, d) => sum + d, 0);
      const minDelay = Math.max(0, totalAnimTime + 1000);
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

  const pct = ((currentStep + 1) / PROCESSING_STEPS.length) * 100;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-lg w-full">
        {/* Animated brand mark */}
        <div className="text-center mb-10">
          <motion.h1
            className="font-display text-[32px] text-[var(--t-navy)]"
            initial={{ opacity: 0, y: -10 }}
            animate={hasError ? { opacity: 1, y: 0, x: [0, -4, 4, -4, 0] } : { opacity: 1, y: 0 }}
            transition={hasError ? { duration: 0.6, x: { duration: 0.5, delay: 0.1 } } : { duration: 0.6 }}
          >
            {hasError ? 'Hit a snag' : 'Building your profile'}
          </motion.h1>
          {!hasError && (
            <motion.p
              className="text-[14px] text-[var(--t-navy)]/45 mt-2 italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              This may take a minute or two — please don&apos;t close this screen.
            </motion.p>
          )}
          {hasError && (
            <motion.p
              className="text-[15px] text-[var(--t-navy)]/60 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              The profile synthesis didn&apos;t go through — this sometimes happens with complex taste profiles.
            </motion.p>
          )}
        </div>

        {/* Processing steps */}
        {!hasError && (
          <motion.div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {PROCESSING_STEPS.map((step, i) => {
                const isActive = i === currentStep;
                const isDoneStep = i < currentStep;
                const isLastStep = i === PROCESSING_STEPS.length - 1;
                return (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{
                      opacity: isActive ? 1 : isDoneStep ? 0.4 : 0.1,
                      x: 0,
                    }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3"
                  >
                    <motion.div
                      className={`
                        w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                        ${isDoneStep
                          ? 'bg-[var(--t-dark-teal)]'
                          : isActive
                            ? 'bg-[var(--t-ochre)]'
                            : 'bg-[var(--t-travertine)]'
                        }
                      `}
                      animate={isActive && !isLastStep ? { scale: [1, 1.3, 1] } : {}}
                      transition={isActive && !isLastStep ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                    >
                      {isDoneStep ? (
                        <motion.svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                      ) : isActive && isLastStep ? (
                        /* Spinning indicator on the final step so it's clearly still working */
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" className="animate-spin">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : isActive ? null : null}
                    </motion.div>
                    <motion.span
                      className={`
                        font-mono text-[13px]
                        ${isActive ? 'text-[var(--t-navy)]' : 'text-[var(--t-navy)]/50'}
                      `}
                      animate={{
                        color: isActive ? 'var(--t-navy)' : 'color: var(--t-navy)/50)',
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {step}
                    </motion.span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Error actions */}
        {hasError && (
          <motion.div
            className="space-y-3 mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.button
              onClick={handleRetry}
              className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all"
              style={{ backgroundColor: 'var(--t-navy)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Try again{retryCount > 0 ? ` (attempt ${retryCount + 2})` : ''}
            </motion.button>
            <motion.button
              onClick={handleSkipToReveal}
              className="w-full py-3 rounded-xl text-[14px] font-medium transition-all"
              style={{ color: 'var(--t-navy)', opacity: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Skip — use what you have
            </motion.button>
          </motion.div>
        )}

        {/* Progress bar */}
        {!hasError && (
          <div className="mt-8 h-1 rounded-full bg-[var(--t-travertine)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--t-ochre)]"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
