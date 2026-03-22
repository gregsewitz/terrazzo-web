'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal, SustainabilitySignal } from '@/types';
import { T } from '@/types';
import { FONT, INK, COLOR } from '@/constants/theme';

// ─── Scale Options ───

interface ScaleOption {
  id: string;
  label: string;
  description: string;
  tasteSignals: { tag: string; confidence: number }[];
  sustainabilitySignals: SustainabilitySignal[];
  certaintyBoost: number;
}

const SCALE_OPTIONS: ScaleOption[] = [
  {
    id: 'not_at_all',
    label: 'Not a factor',
    description: "I pick the best place — period",
    tasteSignals: [],
    sustainabilitySignals: [],
    certaintyBoost: 15,
  },
  {
    id: 'slightly',
    label: 'Slightly',
    description: "I notice, but it doesn't drive my decisions",
    tasteSignals: [
      { tag: 'Sustainability-aware', confidence: 0.6 },
    ],
    sustainabilitySignals: [
      { tag: 'Sustainability-aware', confidence: 0.6, dimension: 'ENVIRONMENTAL' },
    ],
    certaintyBoost: 20,
  },
  {
    id: 'meaningfully',
    label: 'Meaningfully',
    description: 'It shapes where I stay and how I travel',
    tasteSignals: [
      { tag: 'Sustainability-conscious', confidence: 0.8 },
      { tag: 'Local-economy-supporter', confidence: 0.75 },
    ],
    sustainabilitySignals: [
      { tag: 'Sustainability-conscious', confidence: 0.8, dimension: 'ENVIRONMENTAL' },
      { tag: 'Local-economy-supporter', confidence: 0.75, dimension: 'ECONOMIC' },
    ],
    certaintyBoost: 25,
  },
  {
    id: 'priority',
    label: "It's a priority",
    description: "I'll sacrifice luxury for values alignment",
    tasteSignals: [
      { tag: 'Sustainability-leading', confidence: 0.95 },
      { tag: 'Eco-leading', confidence: 0.9 },
      { tag: 'Fair-wage-advocate', confidence: 0.85 },
    ],
    sustainabilitySignals: [
      { tag: 'Sustainability-leading', confidence: 0.95, dimension: 'ENVIRONMENTAL' },
      { tag: 'Eco-leading', confidence: 0.9, dimension: 'ENVIRONMENTAL' },
      { tag: 'Fair-wage-advocate', confidence: 0.85, dimension: 'SOCIAL' },
    ],
    certaintyBoost: 30,
  },
];

interface SustainabilityScaleViewProps {
  onComplete: () => void;
}

export default function SustainabilityScaleView({ onComplete }: SustainabilityScaleViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const addSustainabilitySignals = useOnboardingStore((s) => s.addSustainabilitySignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = useCallback((option: ScaleOption) => {
    if (submitted) return;
    setSelected(option.id);
    setSubmitted(true);

    // Emit taste signals
    if (option.tasteSignals.length > 0) {
      const signals: TasteSignal[] = option.tasteSignals.map((s) => ({
        tag: s.tag,
        cat: 'Sustainability',
        confidence: s.confidence,
      }));
      addSignals(signals);
    }

    // Emit sustainability-specific signals
    if (option.sustainabilitySignals.length > 0) {
      addSustainabilitySignals(option.sustainabilitySignals);
    }

    // Update certainties
    updateCertainties({ Sustainability: option.certaintyBoost });

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 500);
  }, [submitted, addSignals, addSustainabilitySignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 40px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Question */}
        <p style={{
          fontSize: 17,
          fontWeight: 400,
          color: COLOR.navy,
          margin: '0 0 24px',
          textAlign: 'center',
          fontFamily: FONT.serif,
          lineHeight: 1.5,
          letterSpacing: '0.01em',
        }}>
          How much do environmental and social values factor into your travel choices?
        </p>

        {/* Options */}
        {SCALE_OPTIONS.map((option, i) => {
          const isSelected = selected === option.id;
          const isOther = selected && !isSelected;

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              disabled={submitted}
              className="btn-hover"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '18px 22px',
                background: isSelected
                  ? 'rgba(0,42,85,0.05)'
                  : 'rgba(0,42,85,0.015)',
                borderRadius: 14,
                border: isSelected
                  ? `1.5px solid ${COLOR.navy}`
                  : '1px solid rgba(0,42,85,0.06)',
                cursor: submitted ? 'default' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isOther ? 0.35 : 1,
                transform: isSelected ? 'scale(1.01)' : 'none',
                textAlign: 'left',
                width: '100%',
                animation: `fadeInUp 0.4s ease ${i * 0.06}s both`,
              }}
            >
              <span style={{
                fontSize: 15,
                fontWeight: 600,
                color: COLOR.navy,
                fontFamily: FONT.sans,
                marginBottom: 3,
              }}>
                {option.label}
              </span>
              <span style={{
                fontSize: 13,
                color: COLOR.navy,
                fontFamily: FONT.sans,
                lineHeight: 1.4,
              }}>
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
