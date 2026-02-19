'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { ONBOARDING_PHASES, ALL_PHASE_IDS, ACT_1_PHASE_IDS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CertaintyBar from '@/components/onboarding/CertaintyBar';
import ConversationView from '@/components/onboarding/ConversationView';
import QuickDiagnosticView from '@/components/onboarding/QuickDiagnosticView';
import VisualTasteView from '@/components/onboarding/VisualTasteView';
import TripSeedView from '@/components/onboarding/TripSeedView';

export default function PhasePage() {
  const params = useParams();
  const router = useRouter();
  const phaseId = params.id as string;

  const { completePhase, setPhaseIndex, completedPhaseIds, lifeContext } = useOnboardingStore();

  const phase = useMemo(
    () => ONBOARDING_PHASES.find((p) => p.id === phaseId),
    [phaseId]
  );

  // Interpolate dynamic content (partner name, companion info) into phase prompts
  const interpolatedPhase = useMemo(() => {
    if (!phase) return null;
    const partnerName = lifeContext.partnerName || 'your partner';
    const companions = lifeContext.primaryCompanions;
    const companionDesc = companions?.length
      ? companions.join(', ')
      : 'someone';

    const interpolate = (text: string) =>
      text
        .replace(/\[partner name\]/gi, partnerName)
        .replace(/\[partner\]/gi, partnerName)
        .replace(/Sarah/g, partnerName !== 'your partner' ? partnerName : 'your partner')
        .replace(/\[companions?\]/gi, companionDesc);

    return {
      ...phase,
      aiPrompt: interpolate(phase.aiPrompt),
      followUps: phase.followUps.map(interpolate),
    };
  }, [phase, lifeContext.partnerName, lifeContext.primaryCompanions]);

  const currentIndex = ALL_PHASE_IDS.indexOf(phaseId);
  const isLastAct1 = phaseId === ACT_1_PHASE_IDS[ACT_1_PHASE_IDS.length - 1];

  const handlePhaseComplete = useCallback(() => {
    completePhase(phaseId);

    if (isLastAct1) {
      // After Act 1 ends, offer the fast-track exit
      router.push('/onboarding/act1-complete');
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < ALL_PHASE_IDS.length) {
      setPhaseIndex(nextIndex);
      router.push(`/onboarding/phase/${ALL_PHASE_IDS[nextIndex]}`);
    } else {
      // All phases done
      router.push('/onboarding/processing');
    }
  }, [phaseId, currentIndex, isLastAct1, completePhase, setPhaseIndex, router]);

  if (!phase) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--t-cream)]">
        <p className="text-[var(--t-ink)]/50">Phase not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--t-cream)] max-w-lg mx-auto">
      {/* Phase header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-ink)]/30">
              {phase.act === 1 ? 'Act I' : 'Act II'} &middot; Phase {phase.phaseNumber}
            </p>
            <h1 className="font-serif text-[22px] text-[var(--t-ink)] leading-tight">
              {phase.title}
            </h1>
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] text-[var(--t-ink)]/30">
              {completedPhaseIds.length}/{ALL_PHASE_IDS.length}
            </span>
          </div>
        </div>
        <CertaintyBar />
      </div>

      {/* Phase content — varies by modality */}
      <div className="flex-1 flex flex-col min-h-0">
        {(phase.modality === 'voice' || phase.modality === 'voice+cards') && interpolatedPhase && (
          <ConversationView phase={interpolatedPhase} onComplete={handlePhaseComplete} />
        )}
        {phase.modality === 'cards' && (
          <QuickDiagnosticView onComplete={handlePhaseComplete} />
        )}
        {phase.modality === 'visual' && (
          <VisualTasteView onComplete={handlePhaseComplete} />
        )}
        {phase.modality === 'trip-seed' && (
          <TripSeedView onComplete={handlePhaseComplete} />
        )}
      </div>
    </div>
  );
}
