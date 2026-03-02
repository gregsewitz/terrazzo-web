'use client';

import { useState, useCallback, useMemo } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal } from '@/types';
import { T } from '@/types';

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

const CULTURAL_SWIPE_CARDS: SwipeCard[] = [
  {
    id: 1,
    prompt: 'When visiting a new city, you\u2019d rather...',
    optionA: { label: 'Take a cooking class with a local chef', description: 'Hands-on, immersive' },
    optionB: { label: 'Visit a world-class museum', description: 'Observer, curated' },
    aSignals: ['Cultural-participant', 'Hands-on-immersion', 'Cooking-class-seeker'],
    bSignals: ['Cultural-observer', 'Museum-goer', 'Curated-experience'],
    domain: 'CulturalEngagement',
  },
  {
    id: 2,
    prompt: 'Your ideal local experience...',
    optionA: { label: 'A guided walk through artisan workshops', description: 'Deep-dive craft' },
    optionB: { label: 'Wandering a local market on your own', description: 'Self-directed discovery' },
    aSignals: ['Artisan-workshop', 'Guided-cultural', 'Craft-immersion'],
    bSignals: ['Self-directed', 'Market-explorer', 'Discovery-by-wandering'],
    domain: 'CulturalEngagement',
  },
  {
    id: 3,
    prompt: 'Language barrier abroad...',
    optionA: { label: 'Love it \u2014 part of the adventure', description: 'Embraces unfamiliarity' },
    optionB: { label: 'Prefer English-friendly or a guide', description: 'Values communication' },
    aSignals: ['Language-barrier-embracer', 'Full-immersion', 'Adventure-seeker'],
    bSignals: ['English-preferred', 'Communication-priority', 'Guided-experience'],
    domain: 'CulturalEngagement',
  },
  {
    id: 4,
    prompt: 'When it comes to local art...',
    optionA: { label: 'Seek out emerging local artists', description: 'Discovery-driven' },
    optionB: { label: 'Appreciate what\u2019s in the hotel', description: 'Curated for you' },
    aSignals: ['Art-discovery', 'Gallery-seeker', 'Emerging-artist-supporter'],
    bSignals: ['Art-passive', 'Hotel-curated', 'Ambient-appreciation'],
    domain: 'CulturalEngagement',
  },
  {
    id: 5,
    prompt: 'Festival or event in town...',
    optionA: { label: 'Absolutely \u2014 plan around it', description: 'Cultural calendar aware' },
    optionB: { label: 'Nice if it happens, not a driver', description: 'Serendipity over planning' },
    aSignals: ['Festival-planner', 'Cultural-calendar-aware', 'Event-driven-travel'],
    bSignals: ['Serendipity-over-planning', 'Low-research', 'Go-with-flow'],
    domain: 'CulturalEngagement',
  },
];

interface SwipePhaseViewProps {
  onComplete: () => void;
  cards?: SwipeCard[];
}

export default function SwipePhaseView({ onComplete, cards = CULTURAL_SWIPE_CARDS }: SwipePhaseViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<Record<number, 'a' | 'b'>>({});
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);

  const currentCard = cards[currentIndex];
  const isComplete = currentIndex >= cards.length;

  const handleChoice = useCallback((choice: 'a' | 'b') => {
    if (animating || isComplete) return;

    const direction = choice === 'a' ? 'left' : 'right';
    setAnimating(direction);
    setChoices((prev) => ({ ...prev, [currentCard.id]: choice }));

    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setAnimating(null);
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
    }, 300);
  }, [animating, isComplete, currentCard, currentIndex, cards, choices, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  if (isComplete) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: T.ink }}>
        <p style={{ fontSize: 16, opacity: 0.7 }}>Captured your cultural pulse</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '24px 0' }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        {cards.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i < currentIndex ? T.honey : i === currentIndex ? T.ink : T.travertine,
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* Prompt */}
      <p style={{ fontSize: 17, fontWeight: 500, color: T.ink, textAlign: 'center', margin: 0, padding: '0 16px' }}>
        {currentCard.prompt}
      </p>

      {/* Cards */}
      <div style={{
        display: 'flex', gap: 16, width: '100%', maxWidth: 480,
        transform: animating === 'left' ? 'translateX(-120%)' : animating === 'right' ? 'translateX(120%)' : 'none',
        opacity: animating ? 0 : 1,
        transition: 'all 0.25s ease-out',
      }}>
        {/* Option A */}
        <button
          onClick={() => handleChoice('a')}
          style={{
            flex: 1, padding: 20, border: `1.5px solid ${T.travertine}`, borderRadius: 12,
            background: T.cream, cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.honey; e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.travertine; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: T.ink, marginBottom: 4 }}>
            {currentCard.optionA.label}
          </span>
          {currentCard.optionA.description && (
            <span style={{ fontSize: 12, color: T.ink, opacity: 0.5 }}>{currentCard.optionA.description}</span>
          )}
        </button>

        {/* Option B */}
        <button
          onClick={() => handleChoice('b')}
          style={{
            flex: 1, padding: 20, border: `1.5px solid ${T.travertine}`, borderRadius: 12,
            background: T.cream, cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.honey; e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.travertine; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: T.ink, marginBottom: 4 }}>
            {currentCard.optionB.label}
          </span>
          {currentCard.optionB.description && (
            <span style={{ fontSize: 12, color: T.ink, opacity: 0.5 }}>{currentCard.optionB.description}</span>
          )}
        </button>
      </div>
    </div>
  );
}
