'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import {
  ONBOARDING_PHASES,
  ALL_PHASE_IDS,
  REFINEMENT_PHASES,
  REFINEMENT_PHASE_IDS,
  REFINEMENT_PHASE_FIELDS,
} from '@/constants/onboarding';
import type { RefinementPhaseId } from '@/constants/onboarding';
import type { OnboardingPhase } from '@/types';
import ConversationView from '@/components/onboarding/ConversationView';
import SliderPhaseView from '@/components/onboarding/SliderPhaseView';
import SwipePhaseView from '@/components/onboarding/SwipePhaseView';
import SpectrumPhaseView from '@/components/onboarding/SpectrumPhaseView';
import CertaintyBar from '@/components/onboarding/CertaintyBar';
import { apiFetch } from '@/lib/api-client';
import { FONT, INK } from '@/constants/theme';

/**
 * /profile/refine — Dynamic "Fill the gaps" flow
 *
 * Two layers of gap detection:
 *
 * 1. PHASE-BASED: Checks which onboarding phases the user hasn't completed.
 *    New modality phases (slider/swipe/spectrum) added after a user's original
 *    onboarding will surface here automatically — no hardcoding needed.
 *    Interactive phases come first since they're quick and fun.
 *
 * 2. FIELD-BASED: Checks specific User DB columns for the deeper conversation
 *    refinement phases (sustainability, rhythm, cultural engagement).
 *    These only show if the specific columns are still empty/default.
 *
 * On completion, triggers re-synthesis to incorporate new signals.
 */

interface UserV2Fields {
  sustainabilitySensitivity: string | null;
  sustainabilityPriorities: string[];
  sustainabilityDealbreakers: string[];
  sustainabilityWillingnessToPayPremium: number | null;
  tasteTrajectoryDirection: string | null;
  tasteTrajectoryDescription: string | null;
}

/** IDs of onboarding phases that use interactive modalities (slider, swipe, spectrum).
 *  These are detected as gaps purely by phase completion status. */
const INTERACTIVE_PHASE_IDS = ALL_PHASE_IDS.filter((id) => {
  const phase = ONBOARDING_PHASES.find((p) => p.id === id);
  return phase && ['slider', 'swipe', 'spectrum'].includes(phase.modality);
});

/** Check if a conversation-based refinement phase has gaps that need filling */
function refinementPhaseHasGaps(phaseId: RefinementPhaseId, fields: UserV2Fields): boolean {
  switch (phaseId) {
    case 'refine-sustainability':
      return (
        !fields.sustainabilitySensitivity ||
        fields.sustainabilitySensitivity === 'PASSIVE' ||
        fields.sustainabilityPriorities.length === 0
      );
    case 'refine-rhythm':
      return !fields.tasteTrajectoryDirection || !fields.tasteTrajectoryDescription;
    case 'refine-cultural':
      // Cultural engagement signals are always additive — always offer unless completed
      return true;
    default:
      return false;
  }
}

export default function RefinePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { completedPhaseIds, completePhase, setPhaseIndex, setCurrentPhaseProgress } = useOnboardingStore();

  const [userFields, setUserFields] = useState<UserV2Fields | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasLoaded = useRef(false);

  // Fetch user's current v2 fields for conversation-phase gap detection
  useEffect(() => {
    if (hasLoaded.current || authLoading || !isAuthenticated) return;
    hasLoaded.current = true;

    (async () => {
      try {
        const data = await apiFetch<UserV2Fields>('/api/profile/v2-fields');
        setUserFields(data);
      } catch (err) {
        console.error('Failed to load v2 fields:', err);
        setUserFields({
          sustainabilitySensitivity: null,
          sustainabilityPriorities: [],
          sustainabilityDealbreakers: [],
          sustainabilityWillingnessToPayPremium: null,
          tasteTrajectoryDirection: null,
          tasteTrajectoryDescription: null,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, isAuthenticated]);

  // Build the dynamic list of phases to show
  const phasesToShow = useMemo((): OnboardingPhase[] => {
    if (!userFields) return [];

    const phases: OnboardingPhase[] = [];

    // Layer 1: Interactive modality phases the user hasn't completed yet
    // These come first — they're quick, fun, and require no typing
    for (const phaseId of INTERACTIVE_PHASE_IDS) {
      if (completedPhaseIds.includes(phaseId)) continue;
      const phase = ONBOARDING_PHASES.find((p) => p.id === phaseId);
      if (phase) phases.push(phase);
    }

    // Layer 2: Conversation-based refinement phases with field-level gap detection
    for (const phaseId of REFINEMENT_PHASE_IDS) {
      if (completedPhaseIds.includes(phaseId)) continue;
      if (!refinementPhaseHasGaps(phaseId, userFields)) continue;
      const phase = REFINEMENT_PHASES.find((p) => p.id === phaseId);
      if (phase) phases.push(phase);
    }

    return phases;
  }, [userFields, completedPhaseIds]);

  const currentPhase = phasesToShow[currentPhaseIdx] ?? null;

  // Handle phase completion — advance to next gap phase or finish
  const handlePhaseComplete = useCallback(() => {
    if (!currentPhase) return;
    completePhase(currentPhase.id);
    setCurrentPhaseProgress(0);

    if (currentPhaseIdx < phasesToShow.length - 1) {
      setCurrentPhaseIdx((i) => i + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentPhase, currentPhaseIdx, phasesToShow.length, completePhase, setCurrentPhaseProgress]);

  // When all refinement phases are done, re-synthesize the profile
  useEffect(() => {
    if (!isComplete || isSaving) return;
    setIsSaving(true);

    (async () => {
      try {
        const store = useOnboardingStore.getState();
        await store.triggerResynthesis();
      } catch (err) {
        console.error('Re-synthesis failed:', err);
      }
      setTimeout(() => router.push('/profile'), 1500);
    })();
  }, [isComplete, isSaving, router]);

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    router.replace('/login');
    return null;
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <div className="animate-pulse text-[13px]" style={{ color: INK['85'], fontFamily: FONT.sans }}>
          Checking your profile…
        </div>
      </div>
    );
  }

  // No gaps — profile is already complete
  if (phasesToShow.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: 'var(--t-cream)' }}>
        <div className="max-w-lg w-full text-center">
          <h2 className="font-serif text-[28px] text-[var(--t-ink)] mb-3">All caught up</h2>
          <p className="text-[15px] text-[var(--t-ink)]/60 mb-6" style={{ fontFamily: FONT.sans }}>
            Your taste profile is fully calibrated — all dimensions covered.
          </p>
          <button
            onClick={() => router.push('/profile')}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--t-ink)' }}
          >
            Back to profile
          </button>
        </div>
      </div>
    );
  }

  // Saving / re-synthesizing state
  if (isComplete) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: 'var(--t-cream)' }}>
        <div className="max-w-lg w-full text-center">
          <h2 className="font-serif text-[28px] text-[var(--t-ink)] mb-3">
            Updating your profile
          </h2>
          <p className="text-[15px] text-[var(--t-ink)]/60 mb-6" style={{ fontFamily: FONT.sans }}>
            Weaving the new signals into your taste profile…
          </p>
          <div className="flex justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t-honey)" strokeWidth="2" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Active refinement phase — render based on modality
  const modality = currentPhase?.modality;

  return (
    <div className="h-dvh flex flex-col bg-[var(--t-cream)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3 w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-ink)]/30">
              Profile Refinement &middot; {currentPhaseIdx + 1} of {phasesToShow.length}
            </p>
            <h1 className="font-serif text-[22px] text-[var(--t-ink)] leading-tight">
              {currentPhase?.title}
            </h1>
            {currentPhase?.subtitle && (
              <p className="text-[12px] text-[var(--t-ink)]/40 mt-0.5">
                {currentPhase.subtitle}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="text-[12px] font-medium"
            style={{ color: INK['50'], background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.sans }}
          >
            Skip &amp; exit
          </button>
        </div>
        <CertaintyBar />
      </div>

      {/* Phase content — renders correct component based on modality */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentPhase && (modality === 'voice' || modality === 'voice+cards') && (
          <ConversationView
            key={currentPhase.id}
            phase={currentPhase}
            onComplete={handlePhaseComplete}
          />
        )}
        {currentPhase && modality === 'slider' && (
          <SliderPhaseView key={currentPhase.id} onComplete={handlePhaseComplete} />
        )}
        {currentPhase && modality === 'swipe' && (
          <SwipePhaseView key={currentPhase.id} onComplete={handlePhaseComplete} />
        )}
        {currentPhase && modality === 'spectrum' && (
          <SpectrumPhaseView key={currentPhase.id} onComplete={handlePhaseComplete} />
        )}
      </div>
    </div>
  );
}
