'use client';

import { useState, useCallback, useMemo } from 'react';
import type { EloState, EloItem } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { EXPERIENCE_POOL } from '@/constants/onboarding';
import { initEloState, pickNextPair, recordChoice, extractSignals } from '@/lib/elo';

const TOTAL_ROUNDS = 10;

interface QuickDiagnosticViewProps {
  onComplete: () => void;
}

export default function QuickDiagnosticView({ onComplete }: QuickDiagnosticViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [eloState, setEloState] = useState<EloState>(() =>
    initEloState(
      EXPERIENCE_POOL.map(exp => ({
        id: exp.id,
        cluster: exp.cluster,
        signals: exp.signals,
        category: exp.category,
        metadata: { label: exp.label },
      }))
    )
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentPair = useMemo(
    () => pickNextPair(eloState, TOTAL_ROUNDS),
    [eloState]
  );

  const round = eloState.round;

  const handleSelect = useCallback((winner: EloItem, loser: EloItem) => {
    if (isAnimating) return;
    setSelectedId(winner.id);
    setIsAnimating(true);

    setTimeout(() => {
      const nextState = recordChoice(eloState, winner.id, loser.id, TOTAL_ROUNDS);
      setEloState(nextState);

      // Update phase progress for CertaintyBar
      setCurrentPhaseProgress(Math.min((nextState.round) / TOTAL_ROUNDS, 1));

      if (nextState.round >= TOTAL_ROUNDS) {
        // Extract final ranked signals and complete
        const signals = extractSignals(nextState);
        addSignals(signals);
        onComplete();
      } else {
        setSelectedId(null);
        setIsAnimating(false);
      }
    }, 400);
  }, [eloState, isAnimating, addSignals, onComplete, setCurrentPhaseProgress]);

  if (!currentPair) {
    // Exhausted all pairs before reaching TOTAL_ROUNDS — complete early
    const signals = extractSignals(eloState);
    addSignals(signals);
    onComplete();
    return null;
  }

  const [itemA, itemB] = currentPair;

  return (
    <div className="flex flex-col h-full px-5 py-6">
      {/* Progress bar — fills incrementally */}
      <div className="flex gap-1 mb-8">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full transition-all duration-500"
            style={{
              backgroundColor: i < round
                ? 'var(--t-ink)'
                : i === round
                  ? 'var(--t-honey)'
                  : 'var(--t-travertine)',
            }}
          />
        ))}
      </div>

      {/* Prompt */}
      <div className="text-center mb-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-2">
          {round < 3
            ? 'Broad strokes'
            : round < 7
              ? 'Getting warmer'
              : 'Fine-tuning'}
        </p>
        <h2 className="font-serif text-[26px] text-[var(--t-ink)] leading-tight">
          Which sounds more like you?
        </h2>
      </div>

      {/* Experience cards */}
      <div className="flex-1 flex flex-col gap-3 justify-center max-w-sm mx-auto w-full">
        <button
          onClick={() => handleSelect(itemA, itemB)}
          disabled={isAnimating}
          className={`
            relative py-6 px-5 rounded-2xl border-2 text-center transition-all duration-300
            ${selectedId === itemA.id
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-[var(--t-cream)] scale-[1.02]'
              : selectedId === itemB.id
                ? 'border-[var(--t-travertine)] text-[var(--t-ink)]/30 scale-[0.98]'
                : 'border-[var(--t-travertine)] text-[var(--t-ink)] hover:border-[var(--t-honey)]'
            }
          `}
        >
          <span className="text-[17px] font-medium">
            {itemA.metadata.label as string}
          </span>
        </button>

        <div className="flex items-center gap-3 px-8">
          <div className="flex-1 h-px bg-[var(--t-travertine)]" />
          <span className="text-[11px] font-mono text-[var(--t-ink)]/30 uppercase">or</span>
          <div className="flex-1 h-px bg-[var(--t-travertine)]" />
        </div>

        <button
          onClick={() => handleSelect(itemB, itemA)}
          disabled={isAnimating}
          className={`
            relative py-6 px-5 rounded-2xl border-2 text-center transition-all duration-300
            ${selectedId === itemB.id
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-[var(--t-cream)] scale-[1.02]'
              : selectedId === itemA.id
                ? 'border-[var(--t-travertine)] text-[var(--t-ink)]/30 scale-[0.98]'
                : 'border-[var(--t-travertine)] text-[var(--t-ink)] hover:border-[var(--t-honey)]'
            }
          `}
        >
          <span className="text-[17px] font-medium">
            {itemB.metadata.label as string}
          </span>
        </button>
      </div>

      {/* Round counter */}
      <p className="text-center text-[12px] font-mono text-[var(--t-ink)]/30 mt-4">
        {round + 1} / {TOTAL_ROUNDS}
      </p>
    </div>
  );
}
