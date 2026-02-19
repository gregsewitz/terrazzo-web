'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';
import { ALL_PHASE_IDS, ACT_1_PHASE_IDS } from '@/constants/onboarding';

// Friendly milestone labels that feel encouraging, not technical
const MILESTONES: Record<string, string> = {
  'welcome': 'Getting to know you',
  'memorable-stays': 'Your story',
  'anti-stay': 'Dealbreakers',
  'companion-context': 'Travel crew',
  'seed-trips': 'Your trips',
  'trusted-sources': 'Trusted taste',
  'go-back-place': 'Your anchor',
  'details-matter': 'The details',
  'quick-diagnostic': 'Quick instincts',
  'visual-taste': 'Visual eye',
  'emotional-core': 'Why you travel',
};

export default function CertaintyBar() {
  const { completedPhaseIds, currentPhaseIndex, currentPhaseProgress } = useOnboardingStore();

  // Determine which act we're in for display
  const isAct2 = currentPhaseIndex >= ACT_1_PHASE_IDS.length;
  const actPhases = isAct2
    ? ALL_PHASE_IDS.slice(ACT_1_PHASE_IDS.length)
    : ACT_1_PHASE_IDS;
  const actOffset = isAct2 ? ACT_1_PHASE_IDS.length : 0;
  const currentIndexInAct = currentPhaseIndex - actOffset;

  return (
    <div className="flex gap-1 items-center">
      {actPhases.map((id, i) => {
        const isDone = completedPhaseIds.includes(id);
        const isCurrent = i === currentIndexInAct;
        const isFuture = !isDone && !isCurrent;

        // Fill percentage: completed = 100%, current = progressive, future = 0%
        const fillPercent = isDone ? 100 : isCurrent ? Math.round(currentPhaseProgress * 100) : 0;

        return (
          <div key={id} className="flex-1 flex flex-col items-center gap-1">
            {/* Segment bar — background track + fill */}
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{
                backgroundColor: isFuture ? 'var(--t-travertine)' : 'color-mix(in srgb, var(--t-travertine) 60%, transparent)',
                opacity: isFuture ? 0.4 : 1,
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${fillPercent}%`,
                  backgroundColor: isDone ? 'var(--t-honey)' : 'var(--t-ink)',
                  opacity: isDone ? 1 : 0.7,
                }}
              />
            </div>
            {/* Show label only for current phase */}
            {isCurrent && (
              <span className="text-[8px] font-mono uppercase tracking-wider text-[var(--t-ink)]/40 whitespace-nowrap">
                {MILESTONES[id] || id}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
