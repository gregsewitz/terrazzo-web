'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { ONBOARDING_PHASES, ACT_1_PHASE_IDS, ACT_2_PHASE_IDS, ACT_3_PHASE_IDS, ALL_PHASE_IDS, ACT_PHASE_MAP } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CertaintyBar from '@/components/onboarding/CertaintyBar';
import ConversationView from '@/components/onboarding/ConversationView';
import QuickDiagnosticView from '@/components/onboarding/QuickDiagnosticView';
import VisualTasteView from '@/components/onboarding/VisualTasteView';
import TripSeedView from '@/components/onboarding/TripSeedView';
import SliderPhaseView from '@/components/onboarding/SliderPhaseView';
import SwipePhaseView from '@/components/onboarding/SwipePhaseView';
import SpectrumPhaseView from '@/components/onboarding/SpectrumPhaseView';
import QuickBioFormView from '@/components/onboarding/QuickBioFormView';
import SustainabilityScaleView from '@/components/onboarding/SustainabilityScaleView';
import PropertyReactionPhaseView from '@/components/onboarding/PropertyReactionPhaseView';
import ForceRankView from '@/components/onboarding/ForceRankView';
import QuickChoiceView from '@/components/onboarding/QuickChoiceView';
import SceneChoiceView from '@/components/onboarding/SceneChoiceView';
import ImagePairView from '@/components/onboarding/ImagePairView';
import { apiFetch } from '@/lib/api-client';

const ACT_LABELS: Record<number, string> = { 1: 'Quick Read', 2: 'Your Story', 3: 'Deep Taste' };

export default function PhasePage() {
  const params = useParams();
  const router = useRouter();
  const phaseId = params.id as string;

  const { completePhase, setPhaseIndex, completedPhaseIds, lifeContext, skippedPhaseIds } = useOnboardingStore();

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

  // Determine active phase count (excluding skipped)
  const activePhaseCount = ALL_PHASE_IDS.length - skippedPhaseIds.length;
  const completedCount = completedPhaseIds.filter(
    (id) => (ALL_PHASE_IDS as readonly string[]).includes(id)
  ).length;

  const handlePhaseComplete = useCallback(async () => {
    completePhase(phaseId);

    // Fire-and-forget save of accumulated signals + progress to DB
    const store = useOnboardingStore.getState();
    apiFetch('/api/profile/save', {
      method: 'POST',
      body: JSON.stringify({
        allSignals: store.allSignals,
        allContradictions: store.allContradictions,
        sustainabilitySignals: store.sustainabilitySignals,
        completedPhaseIds: store.completedPhaseIds,
        propertyAnchors: store.propertyAnchors,
        lifeContext: store.lifeContext,
        // V3 act-routing state — needed for cross-device resume
        currentAct: store.currentAct,
        skippedPhaseIds: store.skippedPhaseIds,
        act1GapResult: store.act1GapResult,
        act2GapResult: store.act2GapResult,
      }),
    }).catch((err) => console.error('Failed to save phase progress:', err));

    if (!phase) return;

    // Get the act's phase list
    const actPhases = ACT_PHASE_MAP[phase.act as keyof typeof ACT_PHASE_MAP];
    const idxInAct = (actPhases as readonly string[]).indexOf(phaseId);

    // Find next non-skipped phase in this act
    for (let i = idxInAct + 1; i < actPhases.length; i++) {
      const nextId = actPhases[i];
      if (!store.skippedPhaseIds.includes(nextId)) {
        const globalIdx = (ALL_PHASE_IDS as readonly string[]).indexOf(nextId);
        setPhaseIndex(globalIdx);
        router.push(`/onboarding/phase/${nextId}`);
        return;
      }
    }

    // End of act — run gap analysis and transition
    if (phase.act === 1) {
      await store.runGapAnalysisForActTransition(1);
      store.setCurrentAct(2);
      router.push('/onboarding/act1-complete');
    } else if (phase.act === 2) {
      await store.runGapAnalysisForActTransition(2);
      store.setCurrentAct(3);
      router.push('/onboarding/act2-complete');
    } else {
      // End of Act 3 → processing
      router.push('/onboarding/processing');
    }
  }, [phaseId, phase, completePhase, setPhaseIndex, router]);

  if (!phase) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--t-cream)]">
        <p className="text-[var(--t-ink)]/50">Phase not found</p>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-[var(--t-cream)] overflow-hidden">
      {/* Phase header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3 w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-ink)]/30">
              {ACT_LABELS[phase.act] ?? `Act ${phase.act}`}
            </p>
            <h1 className="font-serif text-[22px] text-[var(--t-ink)] leading-tight">
              {phase.title}
            </h1>
            {phase.subtitle && (
              <p className="text-[12px] text-[var(--t-ink)]/40 mt-0.5">
                {phase.subtitle}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] text-[var(--t-ink)]/30">
              {completedCount}/{activePhaseCount}
            </span>
          </div>
        </div>
        <CertaintyBar />
      </div>

      {/* Phase content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* ── Voice / Conversation ── */}
        {(phase.modality === 'voice' || phase.modality === 'voice+cards') && interpolatedPhase && (
          <ConversationView phase={interpolatedPhase} onComplete={handlePhaseComplete} />
        )}

        {/* ── Cards (Elo experience pairs) ── */}
        {phase.modality === 'cards' && (
          <QuickDiagnosticView onComplete={handlePhaseComplete} />
        )}

        {/* ── Visual (Designer mood boards) ── */}
        {phase.modality === 'visual' && (
          <VisualTasteView onComplete={handlePhaseComplete} />
        )}

        {/* ── Trip Seed (legacy, kept for compat) ── */}
        {phase.modality === 'trip-seed' && (
          <TripSeedView onComplete={handlePhaseComplete} />
        )}

        {/* ── Slider ── */}
        {phase.modality === 'slider' && (
          <SliderPhaseView onComplete={handlePhaseComplete} sliders={phase.sliderDefs!} />
        )}

        {/* ── Swipe (legacy, kept for compat) ── */}
        {phase.modality === 'swipe' && (
          <SwipePhaseView onComplete={handlePhaseComplete} cards={phase.swipeCards!} />
        )}

        {/* ── Spectrum (legacy, kept for compat) ── */}
        {phase.modality === 'spectrum' && (
          <SpectrumPhaseView onComplete={handlePhaseComplete} />
        )}

        {/* ── NEW: Quick Bio Form ── */}
        {phase.modality === 'form' && (
          <QuickBioFormView onComplete={handlePhaseComplete} />
        )}

        {/* ── NEW: Sustainability Scale ── */}
        {phase.modality === 'scale' && (
          <SustainabilityScaleView onComplete={handlePhaseComplete} />
        )}

        {/* ── NEW: Property Reactions ── */}
        {phase.modality === 'property-reactions' && (
          <PropertyReactionPhaseView
            onComplete={handlePhaseComplete}
            targetDomains={phase.targetDomains}
            cardCount={phase.cardCount ?? 10}
          />
        )}

        {/* ── NEW: Force Rank ── */}
        {phase.modality === 'force-rank' && phase.forceRankItems && (
          <ForceRankView
            onComplete={handlePhaseComplete}
            items={phase.forceRankItems}
          />
        )}

        {/* ── NEW: Quick Choice ── */}
        {phase.modality === 'quick-choice' && phase.quickChoiceOptions && (
          <QuickChoiceView
            onComplete={handlePhaseComplete}
            options={phase.quickChoiceOptions}
            maxSelections={phase.quickChoiceMax ?? 3}
            minSelections={phase.quickChoiceMin ?? 2}
          />
        )}

        {/* ── NEW: Scene Choice (multi-question stepper) ── */}
        {phase.modality === 'scene' && phase.sceneQuestions && (
          <SceneChoiceView
            onComplete={handlePhaseComplete}
            questions={phase.sceneQuestions}
          />
        )}

        {/* ── NEW: Image Pair (A/B photo comparison) ── */}
        {phase.modality === 'image-pair' && phase.imagePairQuestions && (
          <ImagePairView
            onComplete={handlePhaseComplete}
            questions={phase.imagePairQuestions}
          />
        )}
      </div>
    </div>
  );
}
