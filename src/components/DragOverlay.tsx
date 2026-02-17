'use client';

import { ImportedPlace, GhostSourceType, SOURCE_STYLES } from '@/types';

interface DragOverlayProps {
  item: ImportedPlace;
  x: number;
  y: number;
  isOverTarget: boolean;
}

export default function DragOverlay({ item, x, y, isOverTarget }: DragOverlayProps) {
  const sourceStyle = SOURCE_STYLES[item.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: x - 120,
        top: y - 28,
        width: 240,
        transform: isOverTarget ? 'scale(0.95)' : 'scale(1.05) rotate(-1.5deg)',
        transition: 'transform 0.15s ease-out',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{
          background: isOverTarget ? 'rgba(42,122,86,0.12)' : 'white',
          border: isOverTarget ? '2px solid var(--t-verde)' : '1.5px solid var(--t-linen)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-[12px] font-semibold truncate"
            style={{ color: 'var(--t-ink)' }}
          >
            {item.name}
          </div>
          <div
            className="text-[10px] truncate"
            style={{ color: 'rgba(28,26,23,0.5)' }}
          >
            {sourceStyle.icon} {item.location}
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(42,122,86,0.08)',
            color: 'var(--t-verde)',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {item.matchScore}%
        </span>
      </div>
    </div>
  );
}
