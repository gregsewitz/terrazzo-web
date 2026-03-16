'use client';

import { useState, useCallback, useRef } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal, SustainabilitySignal } from '@/types';
import { T } from '@/types';
import { FONT, INK, TEXT, COLOR } from '@/constants/theme';

// ─── Spectrum Definitions ───

interface SpectrumDef {
  id: string;
  prompt: string;
  leftLabel: string;
  rightLabel: string;
  leftColor: string;
  rightColor: string;
  leftSignals: string[];
  rightSignals: string[];
  sustainabilityDimension: 'ENVIRONMENTAL' | 'SOCIAL' | 'CULTURAL' | 'ECONOMIC';
}

const SUSTAINABILITY_SPECTRUMS: SpectrumDef[] = [
  {
    id: 'eco-priority',
    prompt: 'How much does environmental impact shape where you stay?',
    leftLabel: 'Not a factor',
    rightLabel: "It\u2019s a dealbreaker",
    leftColor: COLOR.peach,
    rightColor: '#4a7a4a',
    leftSignals: ['Eco-indifferent', 'Convenience-first'],
    rightSignals: ['Eco-leading', 'Carbon-conscious', 'Green-certification-seeker'],
    sustainabilityDimension: 'ENVIRONMENTAL',
  },
  {
    id: 'local-economy',
    prompt: 'Supporting local businesses and artisans when you travel\u2026',
    leftLabel: 'Nice but not essential',
    rightLabel: 'I actively seek it out',
    leftColor: COLOR.peach,
    rightColor: '#413800',
    leftSignals: ['Local-economy-passive', 'Brand-agnostic'],
    rightSignals: ['Local-economy-supporter', 'Artisan-seeker', 'Community-investment'],
    sustainabilityDimension: 'ECONOMIC',
  },
  {
    id: 'cultural-respect',
    prompt: 'How important is cultural sensitivity in your travel choices?',
    leftLabel: 'I go with the flow',
    rightLabel: 'I research deeply',
    leftColor: COLOR.peach,
    rightColor: '#4a6b8b',
    leftSignals: ['Cultural-casual', 'Spontaneous-visitor'],
    rightSignals: ['Cultural-researcher', 'Respectful-traveler', 'Heritage-preservationist'],
    sustainabilityDimension: 'CULTURAL',
  },
  {
    id: 'social-impact',
    prompt: 'Staff welfare and community impact of where you stay\u2026',
    leftLabel: 'Rarely consider it',
    rightLabel: 'Always on my mind',
    leftColor: COLOR.peach,
    rightColor: '#6b4a8b',
    leftSignals: ['Social-passive', 'Price-driven'],
    rightSignals: ['Social-conscious', 'Fair-wage-advocate', 'Community-benefit-seeker'],
    sustainabilityDimension: 'SOCIAL',
  },
];

interface SpectrumPhaseViewProps {
  onComplete: () => void;
  spectrums?: SpectrumDef[];
}

export default function SpectrumPhaseView({ onComplete, spectrums = SUSTAINABILITY_SPECTRUMS }: SpectrumPhaseViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const addSustainabilitySignals = useOnboardingStore((s) => s.addSustainabilitySignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(spectrums.map((s) => [s.id, 0.5]))
  );
  const [submitted, setSubmitted] = useState(false);
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handlePointerDown = useCallback((spectrumId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (submitted) return;
    const track = trackRefs.current[spectrumId];
    if (!track) return;

    const updateValue = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const raw = (clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, raw));
      setValues((prev) => {
        const next = { ...prev, [spectrumId]: clamped };
        const movedCount = Object.values(next).filter((v) => Math.abs(v - 0.5) > 0.05).length;
        setCurrentPhaseProgress(movedCount / spectrums.length);
        return next;
      });
    };

    updateValue(e.clientX);
    track.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => updateValue(ev.clientX);
    const onUp = () => {
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onUp);
    };

    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
  }, [submitted, spectrums.length, setCurrentPhaseProgress]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);

    const tasteSignals: TasteSignal[] = [];
    const sustainSignals: SustainabilitySignal[] = [];

    for (const spectrum of spectrums) {
      const val = values[spectrum.id];
      const intensity = Math.abs(val - 0.5) * 2;

      if (intensity < 0.1) continue;

      const signals = val < 0.5 ? spectrum.leftSignals : spectrum.rightSignals;
      const confidence = 0.5 + intensity * 0.4;

      for (const tag of signals) {
        tasteSignals.push({ tag, cat: 'Sustainability', confidence: Math.round(confidence * 100) / 100 });
        sustainSignals.push({
          tag,
          confidence: Math.round(confidence * 100) / 100,
          dimension: spectrum.sustainabilityDimension,
        });
      }
    }

    if (tasteSignals.length > 0) addSignals(tasteSignals);
    if (sustainSignals.length > 0) addSustainabilitySignals(sustainSignals);

    const avgIntensity = spectrums.reduce((sum, s) => sum + Math.abs(values[s.id] - 0.5) * 2, 0) / spectrums.length;
    const certaintyBoost = avgIntensity * 20;
    if (certaintyBoost > 2) {
      updateCertainties({ Sustainability: certaintyBoost });
    }

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 400);
  }, [submitted, spectrums, values, addSignals, addSustainabilitySignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

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
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Instruction */}
        <p style={{
          color: COLOR.navy,
          fontSize: 14,
          margin: '0 0 16px',
          textAlign: 'center',
          fontFamily: FONT.sans,
          letterSpacing: '0.01em',
        }}>
          Drag along each spectrum — there are no wrong answers
        </p>

        {/* Spectrums */}
        {spectrums.map((spectrum, i) => {
          const val = values[spectrum.id];
          const gradientColor = lerpColor(spectrum.leftColor, spectrum.rightColor, val);
          const leftActive = val < 0.45;
          const rightActive = val > 0.55;

          return (
            <div
              key={spectrum.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '20px 24px',
                background: 'rgba(0,42,85,0.02)',
                borderRadius: 14,
                border: '1px solid rgba(0,42,85,0.05)',
                animation: `fadeInUp 0.4s ease ${i * 0.08}s both`,
              }}
            >
              <p style={{
                fontSize: 14,
                fontWeight: 500,
                color: COLOR.navy,
                margin: 0,
                textAlign: 'center',
                fontFamily: FONT.sans,
                lineHeight: 1.4,
              }}>
                {spectrum.prompt}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: leftActive ? 600 : 400,
                  color: leftActive ? COLOR.navy : TEXT.secondary,
                  fontFamily: FONT.sans,
                  transition: 'all 0.2s ease',
                  flex: '0 1 auto',
                  minWidth: 0,
                }}>
                  {spectrum.leftLabel}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: rightActive ? 600 : 400,
                  color: rightActive ? COLOR.navy : TEXT.secondary,
                  fontFamily: FONT.sans,
                  transition: 'all 0.2s ease',
                  textAlign: 'right',
                  flex: '0 1 auto',
                  minWidth: 0,
                }}>
                  {spectrum.rightLabel}
                </span>
              </div>

              {/* Gradient track */}
              <div
                ref={(el) => { trackRefs.current[spectrum.id] = el; }}
                onPointerDown={(e) => handlePointerDown(spectrum.id, e)}
                style={{
                  position: 'relative',
                  height: 28,
                  borderRadius: 14,
                  background: `linear-gradient(to right, ${spectrum.leftColor}, ${spectrum.rightColor})`,
                  cursor: submitted ? 'default' : 'pointer',
                  touchAction: 'none',
                  opacity: submitted ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                {/* Thumb */}
                <div
                  className="spectrum-thumb-enter"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${val * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: gradientColor,
                    border: `2.5px solid ${COLOR.cream}`,
                    boxShadow: '0 1px 6px rgba(0,0,0,0.18)',
                    pointerEvents: 'none',
                    transition: submitted ? 'none' : 'box-shadow 0.15s ease',
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitted}
          className="btn-hover"
          style={{
            marginTop: 20,
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
          {submitted ? 'Noted \u2713' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

// ─── Utility: linear color interpolation ───

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const lerp = (s: number, e: number) => Math.round(s + (e - s) * t);
  return `rgb(${lerp(r1, r2)}, ${lerp(g1, g2)}, ${lerp(b1, b2)})`;
}
