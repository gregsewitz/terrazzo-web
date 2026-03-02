'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { REFINEMENT_PHASES, REFINEMENT_PHASE_IDS, REFINEMENT_PHASE_FIELDS } from '@/constants/onboarding';
import type { RefinementPhaseId } from '@/constants/onboarding';
import ConversationView from '@/components/onboarding/ConversationView';
import CertaintyBar from '@/components/onboarding/CertaintyBar';
import { apiFetch } from '@/lib/api-client';
import { FONT, INK } from '@/constants/theme';

/**
 * /profile/refine — "Fill the gaps" flow
 *
 * Loads the user's current profile, detects which v2 fields are empty/default,
 * and only surfaces the refinement phases that would fill those gaps.
 * On completion, patches the profile via /api/profile/save without touching existing data.
 */

interface UserV2Fields {
  sustainabilitySensitivity: string | null;
  sustainabilityPriorities: string[];
  sustainabilityDealbreakers: string[];
  sustainabilityWillingnessToPayPremium: number | null;
  tasteTrajectoryDirection: string | null;
  tasteTrajectoryDescription: string | null;
}

/** Check if a refinement phase has gaps that need filling */
function phaseHasGaps(phaseId: RefinementPhaseId, fields: UserV2Fields): boolean {
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
      // Cultural engagement signals are always additive — always offer this phase
      // unless the user explicitly completed it before
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

  // Fetch user's current v2 fields to detect gaps
  useEffect(() => {
    if (hasLoaded.current || authLoading || !isAuthenticated) return;
    hasLoaded.current = true;

    (async () => {
      try {
        const data = await apiFetch<UserV2Fields>('/api/profile/v2-fields');
        setUserFields(data);
      } catch (err) {
        console.error('Failed to load v2 fields:', err);
        // Default to all gaps — show everything
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

  // Determine which phases to show based on gaps
  const phasesToShow = useMemo(() => {
    if (!userFields) return [];
    return REFINEMENT_PHASE_IDS
      .filter((id) => phaseHasGaps(id, userFields))
      .filter((id) => !completedPhaseIds.includes(id)); // skip already-completed refinement phases
  }, [userFields, completedPhaseIds]);

  const currentPhase = useMemo(() => {
    if (phasesToShow.length === 0) return null;
    const phaseId = phasesToShow[currentPhaseIdx];
    return REFINEMENT_PHASES.find((p) => p.id === phaseId) || null;
  }, [phasesToShow, currentPhaseIdx]);

  // Handle phase completion — advance to next gap phase or finish
  const handlePhaseComplete = useCallback(() => {
    if (!currentPhase) return;
    completePhase(currentPhase.id);
    setCurrentPhaseProgress(0);

    if (currentPhaseIdx < phasesToShow.length - 1) {
      setCurrentPhaseIdx((i) => i + 1);
    } else {
      // All refinement phases done — trigger re-synthesis
      setIsComplete(true);
    }
  }, [currentPhase, currentPhaseIdx, phasesToShow.length, completePhase, setCurrentPhaseProgress]);

  // When all refinement phases are done, re-synthesize the profile
  useEffect(() => {
    if (!isComplete || isSaving) return;
    setIsSaving(true);

    (async () => {
      try {
        // Trigger a full re-synthesis which will incorporate the new signals
        const store = useOnboardingStore.getState();
        await store.triggerResynthesis();
      } catch (err) {
        console.error('Re-synthesis failed:', err);
      }
      // Navigate back to profile
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
            Your profile already has all the v2 dimensions filled in.
            Your taste profile is as complete as it gets.
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

  // Active phase conversation
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

      {/* Conversation */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentPhase && (
          <ConversationView
            key={currentPhase.id}
            phase={currentPhase}
            onComplete={handlePhaseComplete}
          />
        )}
      </div>
    </div>
  );
}
