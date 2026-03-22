'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { ACT_1_PHASE_IDS, ACT_2_PHASE_IDS, ALL_PHASE_IDS } from '@/constants/onboarding';
import { DOMAIN_DISPLAY } from '@/constants/profile';

export default function Act0CompletePage() {
  const router = useRouter();
  const {
    setPhaseIndex, allSignals, certainties,
    act1GapResult, setCurrentAct, skippedPhaseIds,
  } = useOnboardingStore();
  const [stage, setStage] = useState(0); // 0=entering, 1=stats, 2=message, 3=button

  // Count unique signal tags
  const signalCount = new Set(allSignals.map((s) => s.tag)).size;
  // Count taste dimensions with meaningful certainty
  const dimensionsCovered = Object.values(certainties).filter((v) => v > 0).length;

  // Staggered reveal animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1600),
      setTimeout(() => setStage(3), 2400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Identify strong and gap domains from pre-computed Act 0 gap result
  const gapDomains = act1GapResult?.coverage?.gapDomains ?? [];
  // Derive strong domains: those with coverage >= 30% that aren't in gapDomains
  const strongDomains = (act1GapResult?.coverage?.domains ?? [])
    .filter((d) => d.coverage >= 0.3 && !gapDomains.includes(d.domain))
    .map((d) => d.domain);
  const hasGaps = gapDomains.length > 0;

  const handleContinue = () => {
    setCurrentAct(1);
    // Find first non-skipped Act 1 phase
    const store = useOnboardingStore.getState();
    for (let i = 0; i < ACT_2_PHASE_IDS.length; i++) {
      const phaseId = ACT_2_PHASE_IDS[i];
      if (!store.skippedPhaseIds.includes(phaseId)) {
        const globalIdx = (ALL_PHASE_IDS as readonly string[]).indexOf(phaseId);
        setPhaseIndex(globalIdx);
        router.push(`/onboarding/phase/${phaseId}`);
        return;
      }
    }
    // Fallback — shouldn't happen but route to first Act 1 phase
    router.push(`/onboarding/phase/${ACT_2_PHASE_IDS[0]}`);
  };

  // Progress ring (Act I = ~33% of total)
  const progress = ACT_1_PHASE_IDS.length / ALL_PHASE_IDS.length;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-lg w-full flex flex-col items-center">

        {/* Animated progress ring */}
        <div className="relative w-28 h-28 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="var(--t-travertine)"
              strokeWidth="4"
            />
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="var(--t-ochre)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={stage >= 1 ? strokeDashoffset : circumference}
              className="transition-all duration-[1.5s] ease-out"
            />
          </svg>
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center
            transition-all duration-700
            ${stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
          `}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t-dark-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="font-mono text-[11px] text-[var(--t-navy)]/40 mt-1">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>

        {/* Headline */}
        <p className={`
          font-mono text-[11px] uppercase tracking-widest text-[var(--t-ochre)] mb-3
          transition-all duration-700
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          Act I complete
        </p>

        <h1 className={`
          font-display text-[28px] text-[var(--t-navy)] leading-tight text-center mb-6
          transition-all duration-700
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          Already know a lot about your taste
        </h1>

        {/* Stats row */}
        <div className={`
          flex gap-4 w-full mb-8
          transition-all duration-700 delay-200
          ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
        `}>
          {[
            { value: signalCount, label: 'Taste signals' },
            { value: `${dimensionsCovered} of 8`, label: 'Dimensions' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="flex-1 text-center py-3 rounded-xl"
              style={{ backgroundColor: 'var(--t-warm-white)' }}
            >
              <p className="font-display text-[22px] text-[var(--t-navy)] leading-none mb-1">
                {stat.value}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--t-navy)]/40 leading-tight px-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Domain coverage insight */}
        {stage >= 2 && strongDomains.length > 0 && (
          <div
            className={`
              w-full mb-4 px-4 py-3 rounded-xl
              transition-all duration-700
              ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
            `}
            style={{ backgroundColor: 'var(--t-travertine)', border: '1px solid rgba(28, 26, 23, 0.06)' }}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-dark-teal)] mb-2">
              Strong coverage
            </p>
            <p className="text-[14px] text-[var(--t-navy)]/70 leading-relaxed">
              {strongDomains.map((d) => DOMAIN_DISPLAY[d] || d).join(', ')}
            </p>
          </div>
        )}

        {stage >= 2 && hasGaps && (
          <div
            className={`
              w-full mb-6 px-4 py-3 rounded-xl
              transition-all duration-700
              ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
            `}
            style={{ backgroundColor: 'var(--t-warm-white)', border: '1px solid rgba(28, 26, 23, 0.06)' }}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-navy)]/40 mb-2">
              Needs more depth
            </p>
            <p className="text-[14px] text-[var(--t-navy)]/50 leading-relaxed">
              {gapDomains.map((d: string) => DOMAIN_DISPLAY[d] || d).join(', ')}
            </p>
          </div>
        )}

        {/* Motivational message */}
        <p className={`
          text-[15px] text-[var(--t-navy)]/60 leading-relaxed text-center mb-8
          transition-all duration-700
          ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        `}>
          {hasGaps
            ? "Next up: a few focused questions and a conversation about the stays that shaped your taste."
            : "Great foundation. Now let\u2019s go deeper — the service details, the memorable stays, and the emotional side of how you travel."
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
          style={{ backgroundColor: 'var(--t-navy)' }}
          disabled={stage < 3}
        >
          Continue to Act II
        </button>

        <p className={`
          font-mono text-[11px] text-[var(--t-navy)]/25 mt-3
          transition-all duration-500
          ${stage >= 3 ? 'opacity-100' : 'opacity-0'}
        `}>
          {ACT_2_PHASE_IDS.length - skippedPhaseIds.filter((id) =>
            (ACT_2_PHASE_IDS as readonly string[]).includes(id)
          ).length} phases in Act II
        </p>
      </div>
    </div>
  );
}
