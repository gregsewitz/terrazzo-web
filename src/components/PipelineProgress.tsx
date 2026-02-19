'use client';

import { useState, useEffect } from 'react';
import { PIPELINE_STAGES } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface PipelineProgressProps {
  currentStage: string | null;
  stagesCompleted: string[];
  startedAt: string | null;
  /** Compact mode for inline use in PlaceDetailSheet */
  compact?: boolean;
}

export default function PipelineProgress({ currentStage, stagesCompleted, startedAt, compact }: PipelineProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const completedSet = new Set(stagesCompleted);

  if (compact) {
    const completedCount = stagesCompleted.length;
    const total = PIPELINE_STAGES.length;
    const currentLabel = PIPELINE_STAGES.find(s => s.key === currentStage)?.label;
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {PIPELINE_STAGES.map(stage => (
            <div
              key={stage.key}
              className="h-1 rounded-full"
              style={{
                width: 12,
                background: completedSet.has(stage.key)
                  ? 'var(--t-verde)'
                  : stage.key === currentStage
                    ? 'var(--t-honey)'
                    : 'var(--t-travertine)',
                ...(stage.key === currentStage ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
              }}
            />
          ))}
        </div>
        <span className="text-[9px]" style={{ color: INK['95'], fontFamily: FONT.mono }}>
          {completedCount}/{total}{currentLabel ? ` · ${currentLabel}` : ''}
          {elapsed > 0 ? ` · ${elapsed}s` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--t-linen)' }}>
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: '#8a6a2a', fontFamily: FONT.mono, letterSpacing: '1px' }}
        >
          Researching this place
        </div>
        {elapsed > 0 && (
          <span className="text-[9px]" style={{ color: INK['90'], fontFamily: FONT.mono }}>
            {elapsed}s
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PIPELINE_STAGES.map(stage => {
          const isCompleted = completedSet.has(stage.key);
          const isCurrent = stage.key === currentStage;
          return (
            <div
              key={stage.key}
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{
                background: isCompleted
                  ? 'rgba(42,122,86,0.08)'
                  : isCurrent
                    ? 'rgba(200,146,58,0.1)'
                    : INK['04'],
              }}
            >
              <div
                style={{
                  color: isCompleted ? 'var(--t-verde)' : isCurrent ? '#8a6a2a' : INK['90'],
                  ...(isCurrent ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                }}
              >
                <PerriandIcon
                  name={isCompleted ? 'check' : isCurrent ? 'lightning' : 'pin'}
                  size={10}
                />
              </div>
              <span
                className="text-[9px] font-medium"
                style={{
                  color: isCompleted ? 'var(--t-verde)' : isCurrent ? '#8a6a2a' : INK['90'],
                  fontFamily: FONT.mono,
                }}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
