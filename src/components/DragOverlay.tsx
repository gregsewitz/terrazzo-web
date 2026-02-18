'use client';

import { useEffect, useState } from 'react';
import { ImportedPlace, GhostSourceType, SOURCE_STYLES } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';

const TYPE_ICONS: Record<string, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  bar: 'bar',
  cafe: 'cafe',
  museum: 'museum',
  activity: 'activity',
  neighborhood: 'location',
  shop: 'shop',
};

interface DragOverlayProps {
  item: ImportedPlace;
  x: number;
  y: number;
  isOverTarget: boolean;
}

export default function DragOverlay({ item, x, y, isOverTarget }: DragOverlayProps) {
  const sourceStyle = SOURCE_STYLES[item.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
  const typeIcon = TYPE_ICONS[item.type] || 'pin';

  // Entrance animation — mount with scale-up
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => { cancelAnimationFrame(t); setEntered(false); };
  }, []);

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: x - 130,
        top: y - 32,
        width: 260,
        opacity: entered ? 1 : 0,
        transform: isOverTarget
          ? 'scale(0.92)'
          : entered
            ? 'scale(1.04) rotate(-1deg)'
            : 'scale(0.7) rotate(0deg)',
        transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.12s ease-out',
      }}
    >
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl"
        style={{
          background: isOverTarget
            ? 'rgba(42,122,86,0.06)'
            : 'white',
          border: isOverTarget
            ? '2px solid var(--t-verde)'
            : '1.5px solid rgba(28,26,23,0.08)',
          boxShadow: isOverTarget
            ? '0 8px 32px rgba(42,122,86,0.18), 0 2px 8px rgba(42,122,86,0.08)'
            : '0 12px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Type icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: isOverTarget
              ? 'rgba(42,122,86,0.12)'
              : 'var(--t-linen)',
          }}
        >
          <PerriandIcon
            name={typeIcon}
            size={16}
            color={isOverTarget ? 'var(--t-verde)' : 'var(--t-ink)'}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[12px] font-semibold truncate"
            style={{ color: isOverTarget ? 'var(--t-verde)' : 'var(--t-ink)' }}
          >
            {item.name}
          </div>
          <div
            className="text-[10px] truncate flex items-center gap-1"
            style={{ color: 'rgba(28,26,23,0.5)' }}
          >
            <PerriandIcon name={sourceStyle.icon} size={10} color="rgba(28,26,23,0.4)" />
            {item.location}
          </div>
        </div>

        {/* Match score */}
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: isOverTarget ? 'rgba(42,122,86,0.15)' : 'rgba(42,122,86,0.08)',
            color: 'var(--t-verde)',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {item.matchScore}%
        </span>
      </div>

      {/* Drop hint arrow when over target */}
      {isOverTarget && (
        <div
          className="flex justify-center mt-1"
          style={{
            animation: 'dropBounce 0.6s ease-in-out infinite',
          }}
        >
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
            <path d="M2 2L8 8L14 2" stroke="var(--t-verde)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes dropBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
      `}</style>
    </div>
  );
}
