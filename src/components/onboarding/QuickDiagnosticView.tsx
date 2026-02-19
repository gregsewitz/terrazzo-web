'use client';

import { useState, useCallback } from 'react';
import type { DiagnosticQuestion, TasteSignal } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { DIAGNOSTIC_QUESTIONS } from '@/constants/onboarding';

interface QuickDiagnosticViewProps {
  onComplete: () => void;
}

export default function QuickDiagnosticView({ onComplete }: QuickDiagnosticViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSide, setSelectedSide] = useState<'a' | 'b' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const addSignals = useOnboardingStore((s) => s.addSignals);

  const questions = DIAGNOSTIC_QUESTIONS;
  const currentQ = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = useCallback((side: 'a' | 'b') => {
    if (isAnimating) return;
    setSelectedSide(side);
    setIsAnimating(true);

    // Extract signals from selection
    const signalTags = side === 'a' ? currentQ.aSignals : currentQ.bSignals;
    const signals: TasteSignal[] = signalTags.map((tag) => ({
      tag,
      cat: inferCategory(tag),
      confidence: 0.8,
    }));
    addSignals(signals);

    // Advance after brief animation
    setTimeout(() => {
      if (isLast) {
        onComplete();
      } else {
        setCurrentIndex((i) => i + 1);
        setSelectedSide(null);
        setIsAnimating(false);
      }
    }, 400);
  }, [currentIndex, currentQ, isLast, isAnimating, addSignals, onComplete]);

  return (
    <div className="flex flex-col h-full px-5 py-6">
      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {questions.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= currentIndex ? 'var(--t-ink)' : 'var(--t-travertine)',
            }}
          />
        ))}
      </div>

      {/* Question */}
      <div className="text-center mb-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-2">
          Don&apos;t overthink it
        </p>
        <h2 className="font-serif text-[28px] text-[var(--t-ink)] leading-tight">
          {currentQ.q}
        </h2>
      </div>

      {/* Cards */}
      <div className="flex-1 flex flex-col gap-3 justify-center max-w-sm mx-auto w-full">
        <button
          onClick={() => handleSelect('a')}
          disabled={isAnimating}
          className={`
            relative py-6 px-5 rounded-2xl border-2 text-center transition-all duration-300
            ${selectedSide === 'a'
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-[var(--t-cream)] scale-[1.02]'
              : selectedSide === 'b'
                ? 'border-[var(--t-travertine)] text-[var(--t-ink)]/30 scale-[0.98]'
                : 'border-[var(--t-travertine)] text-[var(--t-ink)] hover:border-[var(--t-honey)]'
            }
          `}
        >
          <span className="text-[17px] font-medium">{currentQ.a}</span>
        </button>

        <div className="flex items-center gap-3 px-8">
          <div className="flex-1 h-px bg-[var(--t-travertine)]" />
          <span className="text-[11px] font-mono text-[var(--t-ink)]/30 uppercase">or</span>
          <div className="flex-1 h-px bg-[var(--t-travertine)]" />
        </div>

        <button
          onClick={() => handleSelect('b')}
          disabled={isAnimating}
          className={`
            relative py-6 px-5 rounded-2xl border-2 text-center transition-all duration-300
            ${selectedSide === 'b'
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-[var(--t-cream)] scale-[1.02]'
              : selectedSide === 'a'
                ? 'border-[var(--t-travertine)] text-[var(--t-ink)]/30 scale-[0.98]'
                : 'border-[var(--t-travertine)] text-[var(--t-ink)] hover:border-[var(--t-honey)]'
            }
          `}
        >
          <span className="text-[17px] font-medium">{currentQ.b}</span>
        </button>
      </div>

      {/* Counter */}
      <p className="text-center text-[12px] font-mono text-[var(--t-ink)]/30 mt-4">
        {currentIndex + 1} / {questions.length}
      </p>
    </div>
  );
}

// Simple heuristic to infer category from signal tag
function inferCategory(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.includes('room') || lower.includes('cocoon') || lower.includes('service') || lower.includes('lobby') || lower.includes('efficiency') || lower.includes('arrival')) return 'Service';
  if (lower.includes('café') || lower.includes('cafe') || lower.includes('chef') || lower.includes('dining') || lower.includes('fine-dining')) return 'Food';
  if (lower.includes('design') || lower.includes('museum') || lower.includes('curated') || lower.includes('minimal') || lower.includes('lived-in') || lower.includes('home')) return 'Design';
  if (lower.includes('walk') || lower.includes('urban') || lower.includes('remote') || lower.includes('isolated') || lower.includes('neighborhood') || lower.includes('local')) return 'Location';
  if (lower.includes('pool') || lower.includes('natural') || lower.includes('social')) return 'Wellness';
  if (lower.includes('plan') || lower.includes('spontaneous') || lower.includes('scheduled') || lower.includes('hidden') || lower.includes('anti-obvious')) return 'Character';
  return 'Character';
}
