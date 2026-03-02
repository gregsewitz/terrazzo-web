'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal } from '@/types';
import { T } from '@/types';

// ─── Slider Definitions ───

interface SliderDef {
  id: string;
  leftLabel: string;
  rightLabel: string;
  leftSignals: string[];
  rightSignals: string[];
  domain: string;
}

const RHYTHM_SLIDERS: SliderDef[] = [
  {
    id: 'pace',
    leftLabel: 'Slow & deliberate',
    rightLabel: 'Fast & spontaneous',
    leftSignals: ['Slow-luxury', 'Deliberate-pace', 'Structured-itinerary'],
    rightSignals: ['Dynamic-city', 'Adventure-paced', 'Drift-friendly'],
    domain: 'Rhythm',
  },
  {
    id: 'morning',
    leftLabel: 'Dawn riser',
    rightLabel: 'Late starter',
    leftSignals: ['Dawn-friendly', 'Morning-ritual-sacred', 'Early-market-seeker'],
    rightSignals: ['Late-riser-compatible', 'Night-owl', 'Evening-energy-peak'],
    domain: 'Rhythm',
  },
  {
    id: 'structure',
    leftLabel: 'Planned itinerary',
    rightLabel: 'Go with the flow',
    leftSignals: ['Structured-itinerary', 'Advance-booking', 'Research-driven'],
    rightSignals: ['Drift-friendly', 'Spontaneity-seeker', 'Discovery-by-wandering'],
    domain: 'Rhythm',
  },
  {
    id: 'downtime',
    leftLabel: 'Every moment counts',
    rightLabel: 'Built-in downtime',
    leftSignals: ['Maximizer', 'Activity-dense', 'FOMO-driven'],
    rightSignals: ['Downtime-essential', 'Pool-day-welcomed', 'Reading-time-protected'],
    domain: 'Rhythm',
  },
];

interface SliderPhaseViewProps {
  onComplete: () => void;
  sliders?: SliderDef[];
}

export default function SliderPhaseView({ onComplete, sliders = RHYTHM_SLIDERS }: SliderPhaseViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(sliders.map((s) => [s.id, 0.5]))
  );
  const [submitted, setSubmitted] = useState(false);

  const handleChange = useCallback((sliderId: string, value: number) => {
    setValues((prev) => ({ ...prev, [sliderId]: value }));
    // Update progress based on how many sliders have been moved from center
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
      const intensity = Math.abs(val - 0.5) * 2; // 0-1 how far from center

      if (intensity < 0.1) continue; // Too close to center — no strong signal

      const signals = val < 0.5 ? slider.leftSignals : slider.rightSignals;
      const confidence = 0.5 + intensity * 0.4; // 0.5–0.9

      for (const tag of signals) {
        extractedSignals.push({
          tag,
          cat: slider.domain,
          confidence: Math.round(confidence * 100) / 100,
        });
      }

      // Boost certainty for this domain
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '24px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <p style={{ color: T.ink, opacity: 0.6, fontSize: 14, margin: 0 }}>
          Drag each slider toward whichever feels more like you
        </p>
      </div>

      {sliders.map((slider) => (
        <div key={slider.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink }}>
            <span style={{ opacity: values[slider.id] < 0.45 ? 1 : 0.5, fontWeight: values[slider.id] < 0.45 ? 600 : 400 }}>
              {slider.leftLabel}
            </span>
            <span style={{ opacity: values[slider.id] > 0.55 ? 1 : 0.5, fontWeight: values[slider.id] > 0.55 ? 600 : 400 }}>
              {slider.rightLabel}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={values[slider.id]}
            onChange={(e) => handleChange(slider.id, parseFloat(e.target.value))}
            disabled={submitted}
            style={{
              width: '100%',
              accentColor: T.honey,
              height: 6,
              cursor: submitted ? 'default' : 'pointer',
            }}
          />
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={submitted}
        style={{
          marginTop: 16,
          padding: '14px 32px',
          background: submitted ? T.travertine : T.ink,
          color: submitted ? T.ink : T.cream,
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 500,
          cursor: submitted ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: submitted ? 0.6 : 1,
          alignSelf: 'center',
        }}
      >
        {submitted ? 'Noted' : 'Continue'}
      </button>
    </div>
  );
}
