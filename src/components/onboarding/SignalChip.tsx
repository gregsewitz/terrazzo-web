'use client';

import type { TasteSignal } from '@/types';
import { DOMAIN_COLORS, type TasteDomain } from '@/types';

interface SignalChipProps {
  signal: TasteSignal;
  animate?: boolean;
}

export default function SignalChip({ signal, animate = true }: SignalChipProps) {
  const color = DOMAIN_COLORS[signal.cat as TasteDomain] ?? 'var(--t-ink)';
  const isRejection = signal.cat === 'Rejection' || signal.tag.startsWith('Anti-');

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono
        tracking-wide border transition-all duration-500
        ${animate ? 'animate-[fadeInUp_0.4s_ease-out]' : ''}
      `}
      style={{
        borderColor: isRejection ? 'var(--t-signal-red)' : color,
        color: isRejection ? 'var(--t-signal-red)' : color,
        backgroundColor: isRejection
          ? 'rgba(214, 48, 32, 0.06)'
          : `${color}0F`,
      }}
    >
      {isRejection && <span className="text-[10px]">×</span>}
      {signal.tag}
      <span className="opacity-50 text-[9px]">
        {Math.round(signal.confidence * 100)}%
      </span>
    </span>
  );
}
