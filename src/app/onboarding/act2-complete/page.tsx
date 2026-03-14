'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import {
  ACT_1_PHASE_IDS, ACT_2_PHASE_IDS, ACT_3_PHASE_IDS, ALL_PHASE_IDS,
} from '@/constants/onboarding';

/** Friendly domain display names */
const DOMAIN_DISPLAY: Record<string, string> = {
  Character: 'Character & Identity',
  FoodDrink: 'Food & Drink',
  Service: 'Service Philosophy',
  Atmosphere: 'Atmosphere',
  Design: 'Design Language',
  Setting: 'Setting & Place',
  Wellness: 'Wellness',
  Sustainability: 'Sustainability',
};

export default function Act1CompletePage() {
  const router = useRouter();
  const {
    setPhaseIndex, allSignals, certainties,
    act2GapResult, setCurrentAct, skippedPhaseIds,
  } = useOnboardingStore();
  const [stage, setStage] = useState(0); // 0=entering, 1=stats visible, 2=message visible, 3=button visible

  // Count unique signal tags
  const signalCount = new Set(allSignals.map((s) => s.tag)).size;
  // Count how many taste dimensions have meaningful certainty (> 0)
  const dimensionsCovered = Object.values(certainties).filter((v) => v > 0).length;

  // Staggered reveal animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 600),   // stats appear
      setTimeout(() => setStage(2), 1800),  // motivational message
      setTimeout(() => setStage(3), 2800),  // continue button
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Use pre-computed gap result from act transition (no need to call runDomainGapCheck on mount)
  const gapDomains = act2GapResult?.coverage?.gapDomains ?? [];
  const hasGaps = gapDomains.length > 0;

  const handleContinue = () => {
    setCurrentAct(2);
    // Find first non-skipped Act 2 phase
    const store = useOnboardingStore.getState();
    for (let i = 0; i < ACT_3_PHASE_IDS.length; i++) {
      const phaseId = ACT_3_PHASE_IDS[i];
      if (!store.skippedPhaseIds.includes(phaseId)) {
        const globalIdx = (ALL_PHASE_IDS as readonly string[]).indexOf(phaseId);
        setPhaseIndex(globalIdx);
        router.push(`/onboarding/phase/${phaseId}`);
        return;
      }
    }
    // All Act 2 phases skipped (unlikely) — go to processing
    router.push('/onboarding/processing');
  };

  // Progress ring (Acts I + II completed)
  const completedPhaseCount = ACT_1_PHASE_IDS.length + ACT_2_PHASE_IDS.length;
  const progress = completedPhaseCount / ALL_PHASE_IDS.length;
  const circumference = 2 * Math.PI * 44; // radius = 44
  const strokeDashoffset = circumference * (1 - progress);

  // Count remaining Act 2 phases (excluding skipped)
  const remainingAct2 = ACT_3_PHASE_IDS.length - skippedPhaseIds.filter((id) =>
    (ACT_3_PHASE_IDS as readonly string[]).includes(id)
  ).length;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-lg w-full flex flex-col items-center">

        {/* Animated progress ring with checkmark */}
        <div className="relative w-28 h-28 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="var(--t-travertine)"
              strokeWidth="4"
            />
            {/* Progress arc — animates in */}
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="var(--t-honey)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={stage >= 1 ? strokeDashoffset : circumference}
              className="transition-all duration-[1.5s] ease-out"
            />
          </svg>
          {/* Center content — animated checkmark */}
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center
            transition-all duration-700
            ${stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
          `}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t-verde)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="font-mono text-[11px] text-[var(--t-ink)]/40 mt-1">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>

        {/* Headline */}
        <p className={`
          font-mono text-[11px] uppercase tracking-widest text-[var(--t-honey)] mb-3
          transition-all duration-700
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          Act II complete
        </p>

        <h1 className={`
          font-display text-[28px] text-[var(--t-ink)] leading-tight text-center mb-6
          transition-all duration-700
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          Your taste profile is taking shape
        </h1>

        {/* Stats row */}
        <div className={`
          flex gap-4 w-full mb-8
          transition-all duration-700 delay-200
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
        `}>
          {[
            { value: `${completedPhaseCount} of ${ALL_PHASE_IDS.length}`, label: 'Phases complete' },
            { value: signalCount, label: 'Taste signals' },
            { value: `${dimensionsCovered} of 8`, label: 'Dimensions' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex-1 text-center py-3 rounded-xl"
              style={{ backgroundColor: 'var(--t-warm-white)' }}
            >
              <p className="font-display text-[22px] text-[var(--t-ink)] leading-none mb-1">
                {stat.value}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--t-ink)]/40 leading-tight px-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Gap check results — show domain coverage insight */}
        {stage >= 2 && hasGaps && (
          <div className={`
            w-full mb-6 px-4 py-3 rounded-xl
            transition-all duration-700
            ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}
            style={{ backgroundColor: 'var(--t-travertine)', border: '1px solid rgba(28, 26, 23, 0.06)' }}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-2">
              Still developing
            </p>
            <p className="text-[14px] text-[var(--t-ink)]/70 leading-relaxed">
              {gapDomains.map((d) => DOMAIN_DISPLAY[d] || d).join(', ')}
              {' '}&mdash; Act III will deepen these areas.
            </p>
          </div>
        )}

        {/* Motivational message */}
        <p className={`
          text-[15px] text-[var(--t-ink)]/60 leading-relaxed text-center mb-8
          transition-all duration-700
          ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          {hasGaps
            ? "Almost there — the final act digs into the emotional details and nuance that make your profile truly yours."
            : "One last act — we\u2019ll explore the finer details and emotional instincts that separate a good match from a perfect one."
          }
        </p>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          className={`
            w-full py-3.5 rounded-xl text-[15px] font-medium text-white
            transition-all duration-500
            hover:opacity-90 active:scale-[0.98]
            ${stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}
          style={{ backgroundColor: 'var(--t-ink)' }}
          disabled={stage < 3}
        >
          Continue to Act III
        </button>

        <p className={`
          font-mono text-[11px] text-[var(--t-ink)]/25 mt-3
          transition-all duration-500
          ${stage >= 3 ? 'opacity-100' : 'opacity-0'}
        `}>
          {remainingAct2} more phase{remainingAct2 !== 1 ? 's' : ''} to go
        </p>
      </div>
    </div>
  );
}
