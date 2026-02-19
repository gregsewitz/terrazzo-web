import { FONT, INK } from '@/constants/theme';
'use client';

interface ScoreArcProps {
  score: number; // 0–100
  size?: number;
  color?: string;
}

export default function ScoreArc({ score, size = 52, color = '#4a6741' }: ScoreArcProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

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
        {score}
      </span>
    </div>
  );
}
