'use client';

import { FONT, INK } from '@/constants/theme';

interface ScoreArcProps {
  score: number; // 0–100
  size?: number;
  color?: string;
}

export default function ScoreArc({ score, size = 52, color = '#4a6741' }: ScoreArcProps) {
  // Normalize: accept both 0–1 decimals and 0–100 integers
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (pct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={INK['08']}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold"
        style={{ color, fontFamily: FONT.mono }}
      >
        {pct}
      </span>
    </div>
  );
}
