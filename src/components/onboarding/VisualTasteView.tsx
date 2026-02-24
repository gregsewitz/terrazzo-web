'use client';

import { useState, useCallback, useMemo } from 'react';
import type { EloState, EloItem } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { DESIGNER_POOL } from '@/constants/onboarding';
import { initEloState, pickNextPair, recordChoice, extractSignals, extractTasteAxes } from '@/lib/elo';

const TOTAL_ROUNDS = 10;

/**
 * Cluster → placeholder gradient for mood board cells
 * Used as fallback when images haven't been added yet
 */
const CLUSTER_GRADIENTS: Record<string, string> = {
  expressive: 'linear-gradient(135deg, #c2185b 0%, #ff6f00 100%)',   // vibrant, energetic
  grand:      'linear-gradient(135deg, #5d4037 0%, #d4af37 100%)',   // dark to gold, institutional
  quiet:      'linear-gradient(135deg, #cfd8dc 0%, #fafafa 100%)',   // pale, spacious, calm
  soulful:    'linear-gradient(135deg, #8d6e63 0%, #efebe9 100%)',   // warm earth tones
};

function getGradient(cluster: string): string {
  return CLUSTER_GRADIENTS[cluster] || 'linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%)';
}

interface VisualTasteViewProps {
  onComplete: () => void;
}

export default function VisualTasteView({ onComplete }: VisualTasteViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [eloState, setEloState] = useState<EloState>(() =>
    initEloState(
      DESIGNER_POOL.map(d => ({
        id: d.id,
        cluster: d.cluster,
        signals: d.signals,
        category: 'Design',
        metadata: { name: d.name, hotel: d.hotel, vibe: d.vibe, imageUrls: d.imageUrls },
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
        // Extract ranked design signals
        const signals = extractSignals(nextState);
        addSignals(signals);

        // Also extract taste axes and store as a special signal
        const axes = extractTasteAxes(nextState, DESIGNER_POOL);
        addSignals([{
          tag: `TasteAxes:${JSON.stringify(axes)}`,
          cat: 'TasteAxes',
          confidence: 0.95,
        }]);

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
    const axes = extractTasteAxes(eloState, DESIGNER_POOL);
    addSignals([{
      tag: `TasteAxes:${JSON.stringify(axes)}`,
      cat: 'TasteAxes',
      confidence: 0.95,
    }]);
    onComplete();
    return null;
  }

  const [itemA, itemB] = currentPair;

  return (
    <div className="flex flex-col h-full px-5 py-6">
      {/* Progress bar — fills incrementally */}
      <div className="flex gap-1 mb-6">
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
      <div className="text-center mb-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-2">
          {round < 3
            ? 'Exploring'
            : round < 7
              ? 'Narrowing in'
              : 'Almost there'}
        </p>
        <h2 className="font-serif text-[26px] text-[var(--t-ink)] leading-tight">
          Which space pulls you in?
        </h2>
      </div>

      {/* Designer mood board cards — side by side */}
      <div className="flex-1 flex gap-3 items-stretch max-w-sm mx-auto w-full">
        <MoodBoardCard
          item={itemA}
          isSelected={selectedId === itemA.id}
          isDeselected={selectedId === itemB.id}
          isAnimating={isAnimating}
          onSelect={() => handleSelect(itemA, itemB)}
        />
        <MoodBoardCard
          item={itemB}
          isSelected={selectedId === itemB.id}
          isDeselected={selectedId === itemA.id}
          isAnimating={isAnimating}
          onSelect={() => handleSelect(itemB, itemA)}
        />
      </div>

      {/* Round counter */}
      <p className="text-center text-[12px] font-mono text-[var(--t-ink)]/30 mt-4">
        {round + 1} / {TOTAL_ROUNDS}
      </p>
    </div>
  );
}

// ─── Mood Board Card (2×2 image grid) ───

interface MoodBoardCardProps {
  item: EloItem;
  isSelected: boolean;
  isDeselected: boolean;
  isAnimating: boolean;
  onSelect: () => void;
}

/** Deterministic shuffle using a seed — stable for a given item+round pair */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff; // LCG PRNG
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function MoodBoardCard({ item, isSelected, isDeselected, isAnimating, onSelect }: MoodBoardCardProps) {
  const name = item.metadata.name as string;
  const hotel = item.metadata.hotel as string;
  const vibe = item.metadata.vibe as string;
  const allImageUrls = (item.metadata.imageUrls as string[]) || [];

  // Shuffle all available images deterministically per item, pick first 4
  const imageUrls = useMemo(() => {
    const seed = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + item.comparisons;
    return seededShuffle(allImageUrls, seed).slice(0, 4);
  }, [allImageUrls, item.id, item.comparisons]);

  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const handleImageError = (index: number) => {
    setFailedImages(prev => new Set(prev).add(index));
  };

  return (
    <button
      onClick={onSelect}
      disabled={isAnimating}
      className={`
        flex-1 rounded-2xl border-2 flex flex-col overflow-hidden
        transition-all duration-300
        ${isSelected
          ? 'border-[var(--t-ink)] scale-[1.02] shadow-lg'
          : isDeselected
            ? 'border-[var(--t-travertine)] opacity-40 scale-[0.97]'
            : 'border-[var(--t-travertine)] hover:border-[var(--t-honey)]'
        }
      `}
    >
      {/* 2×2 image grid */}
      <div className="w-full grid grid-cols-2 gap-px bg-[var(--t-travertine)]">
        {[0, 1, 2, 3].map((i) => {
          const url = imageUrls[i];
          const hasFailed = failedImages.has(i);
          const showImage = url && !hasFailed;

          return (
            <div
              key={i}
              className="aspect-square overflow-hidden relative"
              style={!showImage ? { background: getGradient(item.cluster) } : undefined}
            >
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(i)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span
                    className="text-[10px] font-mono uppercase opacity-30"
                    style={{ color: 'var(--t-ink)' }}
                  >
                    {i + 1}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info area */}
      <div className="px-3 py-3 text-left flex-shrink-0">
        <p className="font-mono text-[11px] text-[var(--t-ink)] font-medium leading-tight truncate">
          {name}
        </p>
        <p className="font-mono text-[10px] text-[var(--t-ink)]/40 leading-tight truncate mt-0.5">
          {hotel}
        </p>
        <p className="font-serif text-[12px] text-[var(--t-ink)]/60 italic leading-snug mt-1.5 line-clamp-2">
          {vibe}
        </p>
      </div>
    </button>
  );
}
