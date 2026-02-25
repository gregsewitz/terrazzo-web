'use client';

import React from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface ImportProcessingStepProps {
  progressPercent: number;
  progressLabel: string;
  discoveredNames: string[];
  onMinimize: () => void;
  isDesktop: boolean;
}

export const ImportProcessingStep = React.memo(function ImportProcessingStep({
  progressPercent,
  progressLabel,
  discoveredNames,
  onMinimize,
  isDesktop,
}: ImportProcessingStepProps) {
  return (
    <div className="flex flex-col items-center py-10">
      <div className="mb-4 ghost-shimmer flex justify-center">
        <PerriandIcon name="terrazzo" size={48} color="var(--t-honey)" />
      </div>
      <h3 className="text-xl italic mb-2" style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}>
        {progressPercent < 35 ? 'Reading your paste…' : progressPercent < 75 ? 'Looking up places…' : 'Almost there…'}
      </h3>

      {/* Live progress bar */}
      <div className="w-full max-w-[280px] mb-4">
        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--t-linen)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--t-honey), var(--t-verde))',
              transition: 'width 0.5s ease-out',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px]" style={{ color: INK['70'], fontFamily: FONT.sans }}>
            {progressLabel}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: '#8a6a2a', fontFamily: FONT.mono }}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Place names discovered so far */}
      {discoveredNames.length > 0 && (
        <div className="w-full max-w-[280px] mt-2 rounded-xl p-3" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
          <div
            className="text-[9px] uppercase font-bold tracking-wider mb-2"
            style={{ color: '#8a6a2a', fontFamily: FONT.mono, letterSpacing: '0.8px' }}
          >
            Places found
          </div>
          <div className="flex flex-wrap gap-1.5">
            {discoveredNames.map((name, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Minimize button */}
      <button
        onClick={onMinimize}
        className="mt-6 px-4 py-2 rounded-xl border-none cursor-pointer text-[11px] font-semibold"
        style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}
      >
        Continue in background
      </button>
    </div>
  );
});

ImportProcessingStep.displayName = 'ImportProcessingStep';
