'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';

// ─── Swipe Card Definitions ───

export interface SwipeCard {
  id: number;
  prompt: string;
  optionA: { label: string; description?: string };
  optionB: { label: string; description?: string };
  aSignals: string[];
  bSignals: string[];
  domain: string;
}

interface SwipePhaseViewProps {
  onComplete: () => void;
  cards: SwipeCard[];
}

export default function SwipePhaseView({ onComplete, cards }: SwipePhaseViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<Record<number, 'a' | 'b'>>({});
  const [animating, setAnimating] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<'a' | 'b' | null>(null);

  const currentCard = cards[currentIndex];
  const isComplete = currentIndex >= cards.length;

  const handleChoice = useCallback((choice: 'a' | 'b') => {
    if (animating || isComplete) return;

    setSelectedChoice(choice);
    setAnimating(true);
    setChoices((prev) => ({ ...prev, [currentCard.id]: choice }));

    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setAnimating(false);
      setSelectedChoice(null);
      setCurrentPhaseProgress(nextIndex / cards.length);

      // If this was the last card, extract signals
      if (nextIndex >= cards.length) {
        const allSignals: TasteSignal[] = [];
        const certaintyUpdates: Record<string, number> = {};

        for (const card of cards) {
          const c = choices[card.id] ?? (card.id === currentCard.id ? choice : undefined);
          if (!c) continue;

          const signals = c === 'a' ? card.aSignals : card.bSignals;
          for (const tag of signals) {
            allSignals.push({ tag, cat: card.domain, confidence: 0.8 });
          }

          const current = certaintyUpdates[card.domain] || 0;
          certaintyUpdates[card.domain] = current + 12;
        }

        if (allSignals.length > 0) addSignals(allSignals);
        if (Object.keys(certaintyUpdates).length > 0) updateCertainties(certaintyUpdates);

        setTimeout(onComplete, 600);
      }
    }, 450);
  }, [animating, isComplete, currentCard, currentIndex, cards, choices, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  if (isComplete) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 48,
        color: T.ink,
        animation: 'fadeInUp 0.4s ease both',
      }}>
        <p style={{ fontSize: 16, fontFamily: FONT.serif, color: INK['60'] }}>
          Captured your cultural pulse
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 20px 40px',
      flex: 1,
      overflow: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {cards.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i < currentIndex ? T.honey : i === currentIndex ? T.ink : INK['12'],
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>

        {/* Prompt */}
        <p
          key={currentCard.id}
          className="swipe-card-enter"
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: T.ink,
            textAlign: 'center',
            margin: 0,
            padding: '0 8px',
            fontFamily: FONT.serif,
            lineHeight: 1.4,
          }}
        >
          {currentCard.prompt}
        </p>

        {/* Cards */}
        <div
          key={`cards-${currentCard.id}`}
          className="swipe-card-enter"
          style={{
            display: 'flex',
            gap: 14,
            width: '100%',
            opacity: animating ? 0 : 1,
            transform: animating ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Option A */}
          <button
            onClick={() => handleChoice('a')}
            className="card-hover"
            style={{
              flex: 1,
              padding: '28px 16px',
              border: `1.5px solid ${selectedChoice === 'a' ? T.honey : INK['10']}`,
              borderRadius: 16,
              background: selectedChoice === 'a' ? 'rgba(200,146,58,0.06)' : T.cream,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              minHeight: 100,
              justifyContent: 'center',
            }}
          >
            <span style={{
              display: 'block',
              fontSize: 15,
              fontWeight: 500,
              color: T.ink,
              fontFamily: FONT.sans,
              lineHeight: 1.35,
            }}>
              {currentCard.optionA.label}
            </span>
            {currentCard.optionA.description && (
              <span style={{
                fontSize: 12,
                color: T.ink,
                fontFamily: FONT.sans,
                letterSpacing: '0.02em',
              }}>
                {currentCard.optionA.description}
              </span>
            )}
          </button>

          {/* Option B */}
          <button
            onClick={() => handleChoice('b')}
            className="card-hover"
            style={{
              flex: 1,
              padding: '28px 16px',
              border: `1.5px solid ${selectedChoice === 'b' ? T.honey : INK['10']}`,
              borderRadius: 16,
              background: selectedChoice === 'b' ? 'rgba(200,146,58,0.06)' : T.cream,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              minHeight: 100,
              justifyContent: 'center',
            }}
          >
            <span style={{
              display: 'block',
              fontSize: 15,
              fontWeight: 500,
              color: T.ink,
              fontFamily: FONT.sans,
              lineHeight: 1.35,
            }}>
              {currentCard.optionB.label}
            </span>
            {currentCard.optionB.description && (
              <span style={{
                fontSize: 12,
                color: T.ink,
                fontFamily: FONT.sans,
                letterSpacing: '0.02em',
              }}>
                {currentCard.optionB.description}
              </span>
            )}
          </button>
        </div>

        {/* Card counter */}
        <p style={{
          fontSize: 11,
          color: T.ink,
          fontFamily: FONT.mono,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          {currentIndex + 1} of {cards.length}
        </p>
      </div>
    </div>
  );
}
