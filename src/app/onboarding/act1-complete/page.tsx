'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { ACT_2_PHASE_IDS } from '@/constants/onboarding';

export default function Act1CompletePage() {
  const router = useRouter();
  const { finishOnboarding, setPhaseIndex } = useOnboardingStore();

  const handleContinue = () => {
    // Continue to Act 2
    const act2Start = 7; // index of 'details-matter'
    setPhaseIndex(act2Start);
    router.push(`/onboarding/phase/${ACT_2_PHASE_IDS[0]}`);
  };

  const handleFastTrack = () => {
    finishOnboarding('act_1_only');
    router.push('/onboarding/processing');
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--t-cream)]">
      <div className="max-w-sm w-full text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-honey)] mb-4">
          Foundation complete
        </p>

        <h1 className="font-serif text-[32px] text-[var(--t-ink)] leading-tight mb-4">
          I already have a strong picture
        </h1>

        <p className="text-[15px] text-[var(--t-ink)]/60 leading-relaxed mb-8">
          I know enough to start showing you places you&apos;ll love. But if you have a few more minutes,
          I can go deeper — the details, the visual instincts, the emotional core. It makes
          the recommendations significantly sharper.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all
              hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--t-ink)' }}
          >
            Go deeper — I have time
          </button>

          <button
            onClick={handleFastTrack}
            className="w-full py-3 rounded-xl text-[14px] font-medium text-[var(--t-ink)]
              border border-[var(--t-travertine)] transition-all
              hover:border-[var(--t-honey)] active:scale-[0.98]"
          >
            Show me what you&apos;ve got
          </button>
        </div>

        <p className="text-[12px] text-[var(--t-ink)]/30 mt-4">
          You can always come back and refine later
        </p>
      </div>
    </div>
  );
}
