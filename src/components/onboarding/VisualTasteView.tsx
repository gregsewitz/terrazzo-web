'use client';

import { useState, useCallback } from 'react';
import type { TasteSignal } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { IMAGE_PAIRS } from '@/constants/onboarding';

interface VisualTasteViewProps {
  onComplete: () => void;
}

export default function VisualTasteView({ onComplete }: VisualTasteViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSide, setSelectedSide] = useState<'a' | 'b' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const addSignals = useOnboardingStore((s) => s.addSignals);

  const pairs = IMAGE_PAIRS;
  const currentPair = pairs[currentIndex];
  const isLast = currentIndex === pairs.length - 1;

  const handleSelect = useCallback((side: 'a' | 'b') => {
    if (isAnimating) return;
    setSelectedSide(side);
    setIsAnimating(true);

    const signalTags = side === 'a' ? currentPair.aSignals : currentPair.bSignals;
    const signals: TasteSignal[] = signalTags.map((tag) => ({
      tag,
      cat: 'Design',
      confidence: 0.75,
    }));
    addSignals(signals);

    setTimeout(() => {
      if (isLast) {
        onComplete();
      } else {
        setCurrentIndex((i) => i + 1);
        setSelectedSide(null);
        setIsAnimating(false);
      }
    }, 400);
  }, [currentIndex, currentPair, isLast, isAnimating, addSignals, onComplete]);

  return (
    <div className="flex flex-col h-full px-5 py-6">
      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {pairs.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= currentIndex ? 'var(--t-ink)' : 'var(--t-travertine)',
            }}
          />
        ))}
      </div>

      {/* Prompt */}
      <h2 className="font-serif text-[26px] text-[var(--t-ink)] text-center mb-6 leading-tight">
        {currentPair.prompt}
      </h2>

      {/* Visual cards — side by side */}
      <div className="flex-1 flex gap-3 items-stretch max-w-sm mx-auto w-full">
        {/* Option A */}
        <button
          onClick={() => handleSelect('a')}
          disabled={isAnimating}
          className={`
            flex-1 rounded-2xl border-2 flex flex-col items-center justify-center
            transition-all duration-300 p-4
            ${selectedSide === 'a'
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)]/5 scale-[1.02]'
              : selectedSide === 'b'
                ? 'border-[var(--t-travertine)] opacity-40 scale-[0.97]'
                : 'border-[var(--t-travertine)] hover:border-[var(--t-honey)]'
            }
          `}
        >
          {/* Placeholder for image — using abstract design */}
          <div
            className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center"
            style={{ backgroundColor: 'var(--t-travertine)' }}
          >
            <span className="text-[var(--t-ink)]/20 text-3xl font-serif">A</span>
          </div>
          <span className="text-[14px] font-medium text-[var(--t-ink)] text-center">
            {currentPair.a.label}
          </span>
        </button>

        {/* Option B */}
        <button
          onClick={() => handleSelect('b')}
          disabled={isAnimating}
          className={`
            flex-1 rounded-2xl border-2 flex flex-col items-center justify-center
            transition-all duration-300 p-4
            ${selectedSide === 'b'
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)]/5 scale-[1.02]'
              : selectedSide === 'a'
                ? 'border-[var(--t-travertine)] opacity-40 scale-[0.97]'
                : 'border-[var(--t-travertine)] hover:border-[var(--t-honey)]'
            }
          `}
        >
          <div
            className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center"
            style={{ backgroundColor: 'var(--t-linen)' }}
          >
            <span className="text-[var(--t-ink)]/20 text-3xl font-serif">B</span>
          </div>
          <span className="text-[14px] font-medium text-[var(--t-ink)] text-center">
            {currentPair.b.label}
          </span>
        </button>
      </div>

      {/* Counter */}
      <p className="text-center text-[12px] font-mono text-[var(--t-ink)]/30 mt-4">
        {currentIndex + 1} / {pairs.length}
      </p>
    </div>
  );
}
