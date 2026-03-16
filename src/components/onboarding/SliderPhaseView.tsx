'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal } from '@/types';
import { T } from '@/types';
import { FONT, INK, TEXT, COLOR } from '@/constants/theme';

// ─── Slider Definitions ───

interface SliderDef {
  id: string;
  leftLabel: string;
  rightLabel: string;
  leftSignals: string[];
  rightSignals: string[];
  domain: string;
}

interface SliderPhaseViewProps {
  onComplete: () => void;
  sliders: SliderDef[];
}

export default function SliderPhaseView({ onComplete, sliders }: SliderPhaseViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(sliders.map((s) => [s.id, 0.5]))
  );
  const [submitted, setSubmitted] = useState(false);

  const handleChange = useCallback((sliderId: string, value: number) => {
    setValues((prev) => ({ ...prev, [sliderId]: value }));
    const newValues = { ...values, [sliderId]: value };
    const movedCount = Object.values(newValues).filter((v) => Math.abs(v - 0.5) > 0.05).length;
    setCurrentPhaseProgress(movedCount / sliders.length);
  }, [values, sliders.length, setCurrentPhaseProgress]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);

    const extractedSignals: TasteSignal[] = [];
    const certaintyUpdates: Record<string, number> = {};

    for (const slider of sliders) {
      const val = values[slider.id];
      const intensity = Math.abs(val - 0.5) * 2;

      if (intensity < 0.1) continue;

      const signals = val < 0.5 ? slider.leftSignals : slider.rightSignals;
      const confidence = 0.5 + intensity * 0.4;

      for (const tag of signals) {
        extractedSignals.push({
          tag,
          cat: slider.domain,
          confidence: Math.round(confidence * 100) / 100,
        });
      }

      const currentCertainty = certaintyUpdates[slider.domain] || 0;
      certaintyUpdates[slider.domain] = currentCertainty + intensity * 15;
    }

    if (extractedSignals.length > 0) {
      addSignals(extractedSignals);
    }
    if (Object.keys(certaintyUpdates).length > 0) {
      updateCertainties(certaintyUpdates);
    }

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 400);
  }, [submitted, sliders, values, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

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
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Instruction */}
        <p style={{
          color: COLOR.navy,
          fontSize: 14,
          margin: '0 0 20px',
          textAlign: 'center',
          fontFamily: FONT.sans,
          letterSpacing: '0.01em',
        }}>
          Drag each slider toward whichever feels more like you
        </p>

        {/* Sliders */}
        {sliders.map((slider, i) => {
          const val = values[slider.id];
          const leftActive = val < 0.45;
          const rightActive = val > 0.55;

          return (
            <div
              key={slider.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '20px 24px',
                background: 'rgba(0,42,85,0.02)',
                borderRadius: 14,
                border: '1px solid rgba(0,42,85,0.05)',
                animation: `fadeInUp 0.4s ease ${i * 0.08}s both`,
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 16,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: leftActive ? 600 : 400,
                  color: leftActive ? COLOR.navy : TEXT.secondary,
                  fontFamily: FONT.sans,
                  transition: 'all 0.2s ease',
                  flex: '0 1 auto',
                  minWidth: 0,
                }}>
                  {slider.leftLabel}
                </span>
                <span style={{
                  fontSize: 13,
                  fontWeight: rightActive ? 600 : 400,
                  color: rightActive ? COLOR.navy : TEXT.secondary,
                  fontFamily: FONT.sans,
                  transition: 'all 0.2s ease',
                  textAlign: 'right',
                  flex: '0 1 auto',
                  minWidth: 0,
                }}>
                  {slider.rightLabel}
                </span>
              </div>
              <input
                type="range"
                className="terrazzo-slider"
                min={0}
                max={1}
                step={0.01}
                value={val}
                onChange={(e) => handleChange(slider.id, parseFloat(e.target.value))}
                disabled={submitted}
              />
            </div>
          );
        })}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitted}
          className="btn-hover"
          style={{
            marginTop: 24,
            padding: '15px 40px',
            background: submitted ? COLOR.peach : COLOR.navy,
            color: submitted ? TEXT.secondary : COLOR.cream,
            border: 'none',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: submitted ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            opacity: submitted ? 0.6 : 1,
            alignSelf: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {submitted ? 'Noted ✓' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
