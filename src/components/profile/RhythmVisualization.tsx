'use client';

import { T } from '@/types';
import { FONT } from '@/constants/theme';

interface RhythmAxis {
  label: string;
  leftPole: string;
  rightPole: string;
  value: number; // 0–1
}

interface RhythmVisualizationProps {
  axes: RhythmAxis[];
  title?: string;
}

const DEFAULT_RHYTHM_AXES: RhythmAxis[] = [
  { label: 'Pace', leftPole: 'Slow', rightPole: 'Fast', value: 0.35 },
  { label: 'Morning', leftPole: 'Dawn', rightPole: 'Late', value: 0.25 },
  { label: 'Structure', leftPole: 'Planned', rightPole: 'Drift', value: 0.6 },
  { label: 'Downtime', leftPole: 'Every moment', rightPole: 'Built-in rest', value: 0.7 },
];

export default function RhythmVisualization({ axes = DEFAULT_RHYTHM_AXES, title }: RhythmVisualizationProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {title && (
        <p style={{
          fontSize: 12, fontWeight: 600, color: T.ink, opacity: 0.6,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: FONT.mono, margin: 0,
        }}>
          {title}
        </p>
      )}

      {axes.map((axis) => (
        <div key={axis.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Pole labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{
              fontSize: 11, color: T.ink,
              opacity: axis.value < 0.4 ? 0.9 : 0.4,
              fontWeight: axis.value < 0.4 ? 600 : 400,
              fontFamily: FONT.mono,
            }}>
              {axis.leftPole}
            </span>
            <span style={{
              fontSize: 10, color: T.ink, opacity: 0.35,
              fontFamily: FONT.mono, textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {axis.label}
            </span>
            <span style={{
              fontSize: 11, color: T.ink,
              opacity: axis.value > 0.6 ? 0.9 : 0.4,
              fontWeight: axis.value > 0.6 ? 600 : 400,
              fontFamily: FONT.mono,
            }}>
              {axis.rightPole}
            </span>
          </div>

          {/* Track with marker */}
          <div style={{
            position: 'relative',
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(to right, ${T.honey}30, ${T.pantonOrange}30)`,
          }}>
            {/* Center line */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: -1,
              width: 1,
              height: 8,
              background: T.ink,
              opacity: 0.1,
            }} />

            {/* Position marker */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${axis.value * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: lerpColor(T.honey, T.pantonOrange, axis.value),
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }} />

            {/* Filled portion from center to marker */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: axis.value < 0.5 ? `${axis.value * 100}%` : '50%',
              width: `${Math.abs(axis.value - 0.5) * 100}%`,
              height: '100%',
              borderRadius: 3,
              background: lerpColor(T.honey, T.pantonOrange, axis.value),
              opacity: 0.5,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

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
