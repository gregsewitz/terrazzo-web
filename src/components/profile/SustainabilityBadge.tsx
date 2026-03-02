'use client';

import { T } from '@/types';
import type { SustainabilitySensitivity } from '@/types';
import { FONT } from '@/constants/theme';

interface SustainabilityBadgeProps {
  sensitivity: SustainabilitySensitivity;
  score?: number; // 0–100 overall sustainability alignment
  compact?: boolean;
}

const SENSITIVITY_CONFIG: Record<SustainabilitySensitivity, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}> = {
  LEADING: {
    label: 'Leading',
    color: '#2d6a2d',
    bgColor: '#e8f5e8',
    icon: '◆',
    description: 'Sustainability shapes every choice',
  },
  CONSCIOUS: {
    label: 'Conscious',
    color: '#4a7a4a',
    bgColor: '#f0f7f0',
    icon: '◇',
    description: 'Actively considers impact',
  },
  PASSIVE: {
    label: 'Passive',
    color: '#8b8b6b',
    bgColor: '#f5f5ef',
    icon: '○',
    description: 'Open when convenient',
  },
  INDIFFERENT: {
    label: 'Neutral',
    color: '#999',
    bgColor: '#f5f5f5',
    icon: '·',
    description: 'Not a travel factor',
  },
};

export default function SustainabilityBadge({ sensitivity, score, compact = false }: SustainabilityBadgeProps) {
  const config = SENSITIVITY_CONFIG[sensitivity];

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          background: config.bgColor,
          color: config.color,
          fontSize: 11,
          fontWeight: 500,
          fontFamily: FONT.mono,
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ fontSize: 8 }}>{config.icon}</span>
        {config.label}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 10,
        background: config.bgColor,
        border: `1px solid ${config.color}22`,
      }}
    >
      {/* Mini gauge */}
      {score !== undefined && (
        <svg width={36} height={36} viewBox="0 0 36 36">
          <circle cx={18} cy={18} r={15} fill="none" stroke={`${config.color}20`} strokeWidth={2.5} />
          <circle
            cx={18} cy={18} r={15}
            fill="none"
            stroke={config.color}
            strokeWidth={2.5}
            strokeDasharray={`${(score / 100) * 94.2} ${94.2 - (score / 100) * 94.2}`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
          <text
            x={18} y={18}
            textAnchor="middle"
            dominantBaseline="central"
            fill={config.color}
            fontSize={10}
            fontWeight={700}
            fontFamily={FONT.mono}
          >
            {Math.round(score)}
          </text>
        </svg>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: config.color }}>{config.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: config.color }}>
            {config.label}
          </span>
        </div>
        <span style={{ fontSize: 11, color: T.ink, opacity: 0.55 }}>
          {config.description}
        </span>
      </div>
    </div>
  );
}
