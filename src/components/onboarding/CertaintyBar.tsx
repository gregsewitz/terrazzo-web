'use client';

import { usePathname } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { ONBOARDING_PHASES } from '@/constants/onboarding';
import {
  ACT_1_PHASE_IDS,
  ACT_2_PHASE_IDS,
  ACT_3_PHASE_IDS,
  ACT_PHASE_MAP,
} from '@/constants/onboarding';

// Friendly milestone labels — one per phase, matched to v2 phase IDs
const MILESTONES: Record<string, string> = {
  // Act 1
  'quick-bio': 'The basics',
  'email-connect': 'Email connect',
  'instinct-round': 'Quick instincts',
  'visual-taste': 'Visual eye',
  'property-reactions-0': 'First impressions',
  // Act 2
  'behavioral-anchoring': 'Anchoring',
  'service-style': 'Service style',
  'sustainability-check': 'Values',
  'memorable-stays': 'Your story',
  'trip-memories': 'Trip memories',
  'anti-stay': 'The anti-stay',
  'last-trip': 'Your last trip',
  'dream-destinations': 'Dream trips',
  'nobody-asks': 'Your detail',
  // Act 3
  'food-and-senses': 'Food & senses',
  'visual-pairs': 'Design language',
  'details-matter': 'The details',
  'emotional-core': 'Why you travel',
  'travel-scenarios': 'How you travel',
  'dining-depth': 'How you eat',
  'cultural-immersion': 'How deep you go',
  'rhythm-and-pace': 'Your rhythm',
  'movement-and-wellness': 'Body & movement',
  'scent-and-texture': 'Scent & texture',
  'browsing-and-discovery': 'Browsing',
  'trade-offs': 'Trade-offs',
  'deal-breakers': 'Deal-breakers',
  'consistency-check': 'Final reads',
  'gap-fill-reactions': 'Last reactions',
};

export default function CertaintyBar() {
  const pathname = usePathname();
  const { completedPhaseIds, currentPhaseProgress, skippedPhaseIds } = useOnboardingStore();

  // Find the current phase from whichever phase page is active
  const currentPhaseId = pathname?.split('/').pop() ?? '';

  // Determine which act this phase belongs to
  const currentPhase = ONBOARDING_PHASES.find((p) => p.id === currentPhaseId);
  const currentAct = currentPhase?.act ?? 1;

  // Utility phases that shouldn't appear as progress segments (not substantive taste phases)
  const HIDDEN_FROM_PROGRESS = new Set(['email-connect']);

  // Get phases for this act (excluding skipped and utility phases)
  const actPhaseIds = [...(ACT_PHASE_MAP[currentAct as keyof typeof ACT_PHASE_MAP] ?? ACT_1_PHASE_IDS)];
  const visiblePhases = actPhaseIds.filter((id) => !skippedPhaseIds.includes(id) && !HIDDEN_FROM_PROGRESS.has(id));

  return (
    <div className="flex gap-1 items-center">
      {visiblePhases.map((id) => {
        const isDone = completedPhaseIds.includes(id);
        const isCurrent = id === currentPhaseId;
        const isFuture = !isDone && !isCurrent;

        const fillPercent = isDone ? 100 : isCurrent ? Math.round(currentPhaseProgress * 100) : 0;

        return (
          <div key={id} className="flex-1">
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
          </div>
        );
      })}
    </div>
  );
}
