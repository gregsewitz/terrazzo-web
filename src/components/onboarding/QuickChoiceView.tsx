'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal, QuickChoiceOption } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';

interface QuickChoiceViewProps {
  onComplete: () => void;
  options: QuickChoiceOption[];
  /** Max number of selections allowed (defaults to 3) */
  maxSelections?: number;
}

/**
 * QuickChoiceView — user picks 2-3 options from a curated set.
 * Multi-select chips: tap to select, tap again to deselect.
 * Signal emission: selected items emit at confidence 0.88-0.92.
 * Order doesn't matter here (unlike ForceRank).
 */
export default function QuickChoiceView({ onComplete, options, maxSelections = 3 }: QuickChoiceViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const MIN_SELECTIONS = 2;

  const handleTap = useCallback((optionId: string) => {
    if (submitted) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else if (next.size < maxSelections) {
        next.add(optionId);
      }
      setCurrentPhaseProgress(next.size / MIN_SELECTIONS);
      return next;
    });
  }, [submitted, maxSelections, setCurrentPhaseProgress]);

  const handleSubmit = useCallback(() => {
    if (submitted || selected.size < MIN_SELECTIONS) return;
    setSubmitted(true);

    const signals: TasteSignal[] = [];
    const certaintyUpdates: Record<string, number> = {};

    // Selected options get strong signals
    for (const optId of selected) {
      const opt = options.find((o) => o.id === optId);
      if (!opt) continue;
      const conf = selected.size <= 2 ? 0.92 : 0.88; // slightly higher if fewer selected
      for (const tag of opt.signals) {
        signals.push({ tag, cat: opt.domain, confidence: conf });
      }
      certaintyUpdates[opt.domain] = (certaintyUpdates[opt.domain] || 0) + 10;
    }

    if (signals.length > 0) addSignals(signals);
    if (Object.keys(certaintyUpdates).length > 0) updateCertainties(certaintyUpdates);

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 500);
  }, [submitted, selected, options, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px 40px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Instruction */}
        <p style={{
          color: INK['50'],
          fontSize: 14,
          margin: '0 0 20px',
          textAlign: 'center',
          fontFamily: FONT.sans,
          letterSpacing: '0.01em',
        }}>
          Pick {MIN_SELECTIONS}-{maxSelections} that resonate most
        </p>

        {/* Options grid — 2 columns on wider screens, 1 on narrow */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}>
          {options.map((opt, i) => {
            const isSelected = selected.has(opt.id);
            const isFull = selected.size >= maxSelections;

            return (
              <button
                key={opt.id}
                onClick={() => handleTap(opt.id)}
                disabled={submitted}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '14px 16px',
                  background: isSelected
                    ? 'rgba(200, 146, 58, 0.10)'
                    : 'rgba(28, 26, 23, 0.02)',
                  borderRadius: 14,
                  border: isSelected
                    ? '1.5px solid rgba(200, 146, 58, 0.3)'
                    : '1px solid rgba(28, 26, 23, 0.06)',
                  cursor: submitted ? 'default' : (isFull && !isSelected) ? 'default' : 'pointer',
                  opacity: submitted ? 0.6 : (isFull && !isSelected) ? 0.35 : 1,
                  transition: 'all 0.25s ease',
                  animation: `fadeInUp 0.35s ease ${i * 0.05}s both`,
                  textAlign: 'left',
                  width: '100%',
                  position: 'relative',
                }}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 12,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: T.honey,
                  }} />
                )}

                <p style={{
                  fontSize: 15,
                  fontFamily: FONT.serif,
                  color: T.ink,
                  margin: 0,
                  lineHeight: 1.3,
                  paddingRight: 16,
                }}>
                  {opt.label}
                </p>
                {opt.description && (
                  <p style={{
                    fontSize: 12,
                    color: INK['40'],
                    fontFamily: FONT.sans,
                    margin: 0,
                    lineHeight: 1.35,
                  }}>
                    {opt.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitted || selected.size < MIN_SELECTIONS}
          className="btn-hover"
          style={{
            marginTop: 24,
            padding: '15px 40px',
            background: (submitted || selected.size < MIN_SELECTIONS) ? T.travertine : T.ink,
            color: (submitted || selected.size < MIN_SELECTIONS) ? INK['50'] : T.cream,
            border: 'none',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: (submitted || selected.size < MIN_SELECTIONS) ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            opacity: selected.size < MIN_SELECTIONS ? 0.4 : submitted ? 0.6 : 1,
            alignSelf: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {submitted ? 'Noted' : selected.size < MIN_SELECTIONS ? `Pick ${MIN_SELECTIONS - selected.size} more` : 'Continue'}
        </button>
      </div>
    </div>
  );
}
