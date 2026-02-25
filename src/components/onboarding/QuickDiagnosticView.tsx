'use client';

import { useState, useCallback, useMemo } from 'react';
import type { EloState, EloItem } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { EXPERIENCE_POOL } from '@/constants/onboarding';
import { initEloState, pickNextPair, recordChoice, extractSignals } from '@/lib/elo';

const TOTAL_ROUNDS = 10;

/**
 * Cluster-based warm gradients — muted, editorial tones
 */
const CLUSTER_GRADIENTS: Record<string, string> = {
  cocoon:          'linear-gradient(145deg, #d7ccc8 0%, #efebe9 50%, #fafafa 100%)',
  explorer:        'linear-gradient(145deg, #c8e6c9 0%, #e8f5e9 50%, #fafafa 100%)',
  scene:           'linear-gradient(145deg, #ffe0b2 0%, #fff3e0 50%, #fafafa 100%)',
  retreat:         'linear-gradient(145deg, #b2dfdb 0%, #e0f2f1 50%, #fafafa 100%)',
  refined:         'linear-gradient(145deg, #d1c4e9 0%, #ede7f6 50%, #fafafa 100%)',
  structure:       'linear-gradient(145deg, #cfd8dc 0%, #eceff1 50%, #fafafa 100%)',
  'design-forward':'linear-gradient(145deg, #b0bec5 0%, #eceff1 50%, #fafafa 100%)',
  warm:            'linear-gradient(145deg, #ffe0b2 0%, #fff8e1 50%, #fafafa 100%)',
  urban:           'linear-gradient(145deg, #bdbdbd 0%, #eeeeee 50%, #fafafa 100%)',
  efficiency:      'linear-gradient(145deg, #b0bec5 0%, #eceff1 50%, #fafafa 100%)',
  ritual:          'linear-gradient(145deg, #d7ccc8 0%, #efebe9 50%, #fafafa 100%)',
};

/** Accent dot color per cluster */
const CLUSTER_ACCENTS: Record<string, string> = {
  cocoon:          '#8d6e63',
  explorer:        '#66bb6a',
  scene:           '#ffa726',
  retreat:         '#26a69a',
  refined:         '#7e57c2',
  structure:       '#78909c',
  'design-forward':'#546e7a',
  warm:            '#ff8a65',
  urban:           '#757575',
  efficiency:      '#546e7a',
  ritual:          '#a1887f',
};

function getGradient(cluster: string): string {
  return CLUSTER_GRADIENTS[cluster] || 'linear-gradient(145deg, #e0e0e0 0%, #f5f5f5 100%)';
}

function getAccent(cluster: string): string {
  return CLUSTER_ACCENTS[cluster] || '#9e9e9e';
}

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
        metadata: { label: exp.label, scene: exp.scene, pairWith: exp.pairWith, dimension: exp.dimension },
      }))
    )
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideOut, setSlideOut] = useState(false);

  const currentPair = useMemo(
    () => pickNextPair(eloState, TOTAL_ROUNDS),
    [eloState]
  );

  const round = eloState.round;

  const handleSelect = useCallback((winner: EloItem, loser: EloItem) => {
    if (isAnimating) return;
    setSelectedId(winner.id);
    setIsAnimating(true);

    // Phase 1: highlight winner
    setTimeout(() => {
      setSlideOut(true);
    }, 350);

    // Phase 2: slide out and bring in new pair
    setTimeout(() => {
      const nextState = recordChoice(eloState, winner.id, loser.id, TOTAL_ROUNDS);
      setEloState(nextState);
      setCurrentPhaseProgress(Math.min((nextState.round) / TOTAL_ROUNDS, 1));

      if (nextState.round >= TOTAL_ROUNDS) {
        const signals = extractSignals(nextState);
        addSignals(signals);
        onComplete();
      } else {
        setSelectedId(null);
        setIsAnimating(false);
        setSlideOut(false);
      }
    }, 650);
  }, [eloState, isAnimating, addSignals, onComplete, setCurrentPhaseProgress]);

  if (!currentPair) {
    const signals = extractSignals(eloState);
    addSignals(signals);
    onComplete();
    return null;
  }

  const [itemA, itemB] = currentPair;

  // Phase-aware prompt text
  const promptText = round < 3
    ? 'Which sounds more like you?'
    : round < 7
      ? 'Which world would you choose?'
      : 'One last instinct —';

  // Dimension label from the current pair
  const dimensionLabel = (itemA.metadata?.dimension as string) || '';

  return (
    <div className="flex flex-col h-full">
      {/* Compact header — dimension label + prompt + progress inline */}
      <div className="flex-shrink-0 px-4 pt-1 pb-3 flex items-center gap-4">
        <div className="flex items-center gap-3 whitespace-nowrap">
          {dimensionLabel && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t-honey)] bg-[var(--t-honey)]/10 px-2 py-0.5 rounded-full">
              {dimensionLabel}
            </span>
          )}
          <h2 className="font-serif text-[18px] text-[var(--t-ink)] leading-tight">
            {promptText}
          </h2>
        </div>
        {/* Thin progress bar */}
        <div className="flex-1 flex gap-0.5 items-center">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[2px] rounded-full transition-all duration-500"
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
        <span className="font-mono text-[10px] text-[var(--t-ink)]/30 whitespace-nowrap">
          {round + 1}/{TOTAL_ROUNDS}
        </span>
      </div>

      {/* Two atmosphere cards — stacked on mobile, side-by-side on desktop */}
      <div
        className="flex-1 flex flex-col sm:flex-row gap-3 px-3 pb-3 min-h-0"
        style={{
          opacity: slideOut ? 0 : 1,
          transform: slideOut ? 'translateX(-30px)' : 'translateX(0)',
          transition: 'opacity 250ms ease, transform 250ms ease',
        }}
      >
        <AtmosphereCard
          item={itemA}
          isSelected={selectedId === itemA.id}
          isDeselected={selectedId === itemB.id}
          isAnimating={isAnimating}
          onSelect={() => handleSelect(itemA, itemB)}
        />
        <AtmosphereCard
          item={itemB}
          isSelected={selectedId === itemB.id}
          isDeselected={selectedId === itemA.id}
          isAnimating={isAnimating}
          onSelect={() => handleSelect(itemB, itemA)}
        />
      </div>
    </div>
  );
}

// ─── Atmosphere Card ───

interface AtmosphereCardProps {
  item: EloItem;
  isSelected: boolean;
  isDeselected: boolean;
  isAnimating: boolean;
  onSelect: () => void;
}

function AtmosphereCard({ item, isSelected, isDeselected, isAnimating, onSelect }: AtmosphereCardProps) {
  const label = item.metadata.label as string;
  const scene = item.metadata.scene as string | undefined;
  const category = item.category;
  const accent = getAccent(item.cluster);

  return (
    <button
      onClick={onSelect}
      disabled={isAnimating}
      className="relative flex-1 min-h-0 overflow-hidden cursor-pointer text-left"
      style={{
        borderRadius: 16,
        background: getGradient(item.cluster),
        transition: 'transform 350ms cubic-bezier(.4,0,.2,1), opacity 350ms ease, box-shadow 350ms ease',
        transform: isSelected
          ? 'scale(1.015)'
          : isDeselected
            ? 'scale(0.97)'
            : 'scale(1)',
        opacity: isDeselected ? 0.35 : 1,
        boxShadow: isSelected
          ? '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 2.5px var(--t-honey)'
          : '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Content — vertically centered */}
      <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8">
        {/* Category label */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span
            className="font-mono uppercase tracking-wider"
            style={{
              fontSize: 10,
              color: accent,
              letterSpacing: '0.08em',
            }}
          >
            {category}
          </span>
        </div>

        {/* Experience label — large editorial */}
        <h3
          className="font-serif leading-tight mb-3"
          style={{
            fontSize: 'clamp(20px, 3.5vw, 26px)',
            color: 'var(--t-ink)',
          }}
        >
          {label}
        </h3>

        {/* Scene description — atmospheric italic */}
        {scene && (
          <p
            className="font-serif italic leading-relaxed"
            style={{
              fontSize: 'clamp(13px, 2vw, 15px)',
              color: 'rgba(28,26,23,0.45)',
              maxWidth: 320,
            }}
          >
            {scene}
          </p>
        )}
      </div>

      {/* Decorative corner accent — subtle cluster wash */}
      <div
        className="absolute top-0 right-0 w-1/3 h-1/3 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${accent}15, transparent 70%)`,
        }}
      />

      {/* "Choose" indicator — top right */}
      <div
        className="absolute top-3 right-3 px-3 py-1.5 rounded-full pointer-events-none"
        style={{
          background: isSelected ? 'var(--t-honey)' : 'rgba(28,26,23,0.06)',
          transition: 'background 300ms ease, transform 300ms ease',
          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <span
          className="font-mono uppercase tracking-wider"
          style={{
            fontSize: 10,
            color: isSelected ? 'var(--t-ink)' : 'rgba(28,26,23,0.35)',
          }}
        >
          {isSelected ? 'Chosen' : 'Choose'}
        </span>
      </div>
    </button>
  );
}
