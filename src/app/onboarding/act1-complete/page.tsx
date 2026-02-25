'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { ACT_1_PHASE_IDS, ACT_2_PHASE_IDS, ALL_PHASE_IDS } from '@/constants/onboarding';

const MILESTONE_STATS = [
  { label: 'Phases complete', value: `${ACT_1_PHASE_IDS.length} of ${ALL_PHASE_IDS.length}` },
  { label: 'Taste signals captured', accessor: 'signals' as const },
  { label: 'Dimensions covered', accessor: 'dimensions' as const },
];

export default function Act1CompletePage() {
  const router = useRouter();
  const { setPhaseIndex, allSignals, certainties } = useOnboardingStore();
  const [stage, setStage] = useState(0); // 0=entering, 1=stats visible, 2=message visible, 3=button visible

  // Count unique signal tags
  const signalCount = new Set(allSignals.map((s) => s.tag)).size;
  // Count how many of the 6 taste dimensions have meaningful certainty (> 0)
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

  const handleContinue = () => {
    const act2Start = ACT_1_PHASE_IDS.length;
    setPhaseIndex(act2Start);
    router.push(`/onboarding/phase/${ACT_2_PHASE_IDS[0]}`);
  };

  // Progress ring values (64% complete after Act 1)
  const progress = ACT_1_PHASE_IDS.length / ALL_PHASE_IDS.length;
  const circumference = 2 * Math.PI * 44; // radius = 44
  const strokeDashoffset = circumference * (1 - progress);

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
          Act I complete
        </p>

        <h1 className={`
          font-serif text-[28px] text-[var(--t-ink)] leading-tight text-center mb-6
          transition-all duration-700
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          You&apos;re off to a great start
        </h1>

        {/* Stats row */}
        <div className={`
          flex gap-4 w-full mb-8
          transition-all duration-700 delay-200
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
        `}>
          {MILESTONE_STATS.map((stat, i) => {
            const value = stat.value
              ?? (stat.accessor === 'signals' ? signalCount : `${dimensionsCovered} of 6`);
            return (
              <div
                key={stat.label}
                className="flex-1 text-center py-3 rounded-xl"
                style={{
                  backgroundColor: 'var(--t-warm-white)',
                  animationDelay: `${i * 150}ms`,
                }}
              >
                <p className="font-serif text-[22px] text-[var(--t-ink)] leading-none mb-1">
                  {value}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--t-ink)]/40 leading-tight px-1">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Motivational message */}
        <p className={`
          text-[15px] text-[var(--t-ink)]/60 leading-relaxed text-center mb-8
          transition-all duration-700
          ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          Now let&apos;s get into the fun stuff — the visual instincts, the small details that
          make a place feel like <em>yours</em>, and the emotional core of how you travel.
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
          Let&apos;s keep going
        </button>

        <p className={`
          font-mono text-[11px] text-[var(--t-ink)]/25 mt-3
          transition-all duration-500
          ${stage >= 3 ? 'opacity-100' : 'opacity-0'}
        `}>
          {ACT_2_PHASE_IDS.length} more phases to go
        </p>
      </div>
    </div>
  );
}
