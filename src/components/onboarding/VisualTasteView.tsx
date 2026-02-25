'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { EloState, EloItem } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { DESIGNER_POOL } from '@/constants/onboarding';
import { initEloState, pickNextPair, recordChoice, extractSignals, extractTasteAxes } from '@/lib/elo';

const TOTAL_ROUNDS = 10;

/**
 * Cluster → placeholder gradient for splash cards
 */
const CLUSTER_GRADIENTS: Record<string, string> = {
  expressive: 'linear-gradient(135deg, #c2185b 0%, #ff6f00 100%)',
  grand:      'linear-gradient(135deg, #5d4037 0%, #d4af37 100%)',
  quiet:      'linear-gradient(135deg, #cfd8dc 0%, #fafafa 100%)',
  soulful:    'linear-gradient(135deg, #8d6e63 0%, #efebe9 100%)',
};

function getGradient(cluster: string): string {
  return CLUSTER_GRADIENTS[cluster] || 'linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%)';
}

/** Deterministic shuffle using a seed — stable for a given item+round pair */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  // Track transition direction for slide animation
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

    // Phase 1: highlight winner, fade loser
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
        setSlideOut(false);
      }
    }, 650);
  }, [eloState, isAnimating, addSignals, onComplete, setCurrentPhaseProgress]);

  if (!currentPair) {
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

  // Phase-aware prompt text
  const promptText = round < 3
    ? 'Which space draws you in?'
    : round < 7
      ? 'Which world would you step into?'
      : 'One last look — which one?';

  return (
    <div className="flex flex-col h-full">
      {/* Compact header — prompt + progress inline */}
      <div className="flex-shrink-0 px-4 pt-1 pb-2 flex items-center gap-4">
        <h2 className="font-serif text-[18px] text-[var(--t-ink)] leading-tight whitespace-nowrap">
          {promptText}
        </h2>
        {/* Thin progress bar — fills remaining space */}
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

      {/* Two-column editorial splash cards (stacked on narrow screens) */}
      <div
        className="flex-1 flex flex-col sm:flex-row gap-2.5 px-3 pb-3 min-h-0"
        style={{
          opacity: slideOut ? 0 : 1,
          transform: slideOut ? 'translateX(-30px)' : 'translateX(0)',
          transition: 'opacity 250ms ease, transform 250ms ease',
        }}
      >
        <SplashCard
          item={itemA}
          isSelected={selectedId === itemA.id}
          isDeselected={selectedId === itemB.id}
          isAnimating={isAnimating}
          onSelect={() => handleSelect(itemA, itemB)}
        />
        <SplashCard
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

// ─── Editorial Splash Card ───

interface SplashCardProps {
  item: EloItem;
  isSelected: boolean;
  isDeselected: boolean;
  isAnimating: boolean;
  onSelect: () => void;
}

function SplashCard({ item, isSelected, isDeselected, isAnimating, onSelect }: SplashCardProps) {
  const name = item.metadata.name as string;
  const hotel = item.metadata.hotel as string;
  const vibe = item.metadata.vibe as string;
  const allImageUrls = (item.metadata.imageUrls as string[]) || [];

  // Shuffle images deterministically per item+comparisons
  const imageUrls = useMemo(() => {
    const seed = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + item.comparisons;
    return seededShuffle(allImageUrls, seed);
  }, [allImageUrls, item.id, item.comparisons]);

  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether user swiped (to suppress click-to-select on swipe end)
  const didSwipeRef = useRef(false);
  const touchStartXRef = useRef(0);

  // Observe which slide is in view via IntersectionObserver
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 }
    );
    slideRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [imageUrls.length]);

  // Reset gallery position when item changes (new round)
  useEffect(() => {
    setActiveIndex(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [item.id, item.comparisons]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    didSwipeRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    if (dx > 10) didSwipeRef.current = true;
  };

  const handleClick = () => {
    // Only fire selection if user didn't swipe
    if (!didSwipeRef.current) onSelect();
  };

  return (
    <div
      className="relative flex-1 min-h-0 overflow-hidden cursor-pointer"
      style={{
        borderRadius: 16,
        transition: 'transform 350ms cubic-bezier(.4,0,.2,1), opacity 350ms ease, box-shadow 350ms ease',
        transform: isSelected
          ? 'scale(1.015)'
          : isDeselected
            ? 'scale(0.97)'
            : 'scale(1)',
        opacity: isDeselected ? 0.35 : 1,
        boxShadow: isSelected
          ? '0 8px 30px rgba(0,0,0,0.25), inset 0 0 0 2.5px var(--t-honey)'
          : '0 2px 12px rgba(0,0,0,0.08)',
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      role="button"
      tabIndex={0}
      aria-disabled={isAnimating}
    >
      {/* Horizontal snap-scroll gallery */}
      <div
        ref={scrollRef}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {imageUrls.map((url, i) => (
          <div
            key={i}
            ref={(el) => { slideRefs.current[i] = el; }}
            data-idx={i}
            className="flex-shrink-0 w-full h-full snap-center relative"
          >
            {!failedImages.has(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={`${hotel} ${i + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
                onError={() => setFailedImages(prev => new Set(prev).add(i))}
              />
            ) : (
              <div
                className="w-full h-full"
                style={{ background: getGradient(item.cluster) }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Dark gradient scrim — bottom half */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.03) 100%)',
        }}
      />

      {/* Selected gold ring overlay */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-[16px] pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 0 3px var(--t-honey)',
          }}
        />
      )}

      {/* Dot indicators — bottom center, above text */}
      {imageUrls.length > 1 && (
        <div className="absolute left-0 right-0 flex justify-center gap-1.5 pointer-events-none" style={{ bottom: 90 }}>
          {imageUrls.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIndex ? 16 : 5,
                height: 5,
                backgroundColor: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                borderRadius: i === activeIndex ? 3 : '50%',
              }}
            />
          ))}
        </div>
      )}

      {/* Text overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-8 flex flex-col items-start pointer-events-none">
        {/* Designer name — small mono label */}
        <p
          className="font-mono uppercase tracking-wider leading-none mb-1.5"
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.08em',
          }}
        >
          {name}
        </p>

        {/* Hotel name — large editorial serif */}
        <h3
          className="font-serif leading-tight mb-1"
          style={{
            fontSize: 22,
            color: '#fff',
            textShadow: '0 1px 8px rgba(0,0,0,0.3)',
          }}
        >
          {hotel}
        </h3>

        {/* Vibe tagline — italic */}
        <p
          className="font-serif italic leading-snug"
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {vibe}
        </p>
      </div>

      {/* "Choose" indicator — top right */}
      <div
        className="absolute top-3 right-3 px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none"
        style={{
          background: isSelected ? 'var(--t-honey)' : 'rgba(255,255,255,0.15)',
          transition: 'background 300ms ease, transform 300ms ease',
          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <span
          className="font-mono uppercase tracking-wider"
          style={{
            fontSize: 10,
            color: isSelected ? 'var(--t-ink)' : 'rgba(255,255,255,0.8)',
          }}
        >
          {isSelected ? 'Chosen' : 'Choose'}
        </span>
      </div>
    </div>
  );
}
