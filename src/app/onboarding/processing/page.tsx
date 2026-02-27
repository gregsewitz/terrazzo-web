'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PROCESSING_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { apiFetch } from '@/lib/api-client';
import type { GeneratedTasteProfile } from '@/types';

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
      const profile = await apiFetch<GeneratedTasteProfile>('/api/onboarding/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          signals: allSignals,
          messages: allMessages,
          contradictions: allContradictions,
          certainties,
        }),
      });
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

  const pct = ((currentStep + 1) / PROCESSING_STEPS.length) * 100;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-lg w-full">
        {/* Animated brand mark */}
        <div className="text-center mb-10">
          <motion.h1
            className="font-serif text-[32px] text-[var(--t-ink)]"
            initial={{ opacity: 0, y: -10 }}
            animate={hasError ? { opacity: 1, y: 0, x: [0, -4, 4, -4, 0] } : { opacity: 1, y: 0 }}
            transition={hasError ? { duration: 0.6, x: { duration: 0.5, delay: 0.1 } } : { duration: 0.6 }}
          >
            {hasError ? 'Hit a snag' : 'Building your profile'}
          </motion.h1>
          {hasError && (
            <motion.p
              className="text-[15px] text-[var(--t-ink)]/60 mt-2"
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
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    <motion.div
                      className={`
                        w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                        ${isDoneStep
                          ? 'bg-[var(--t-verde)]'
                          : isActive
                            ? 'bg-[var(--t-honey)]'
                            : 'bg-[var(--t-travertine)]'
                        }
                      `}
                      animate={isActive && !isLastStep ? { scale: [1, 1.4, 1] } : {}}
                      transition={isActive && !isLastStep ? { duration: 1.2, repeat: Infinity } : {}}
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
                        ${isActive ? 'text-[var(--t-ink)]' : 'text-[var(--t-ink)]/50'}
                      `}
                      animate={{
                        color: isActive ? 'var(--t-ink)' : 'color: var(--t-ink)/50)',
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
              style={{ backgroundColor: 'var(--t-ink)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Try again{retryCount > 0 ? ` (attempt ${retryCount + 2})` : ''}
            </motion.button>
            <motion.button
              onClick={handleSkipToReveal}
              className="w-full py-3 rounded-xl text-[14px] font-medium transition-all"
              style={{ color: 'var(--t-ink)', opacity: 0.5 }}
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
              className="h-full rounded-full bg-[var(--t-honey)]"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
