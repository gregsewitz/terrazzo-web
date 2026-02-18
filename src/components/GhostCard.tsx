'use client';

import { ImportedPlace, SOURCE_STYLES, GhostSourceType } from '@/types';

interface GhostCardProps {
  item: ImportedPlace;
  variant?: 'slot' | 'pool'; // 'slot' = full-width in day planner, 'pool' = small card in tray
  onConfirm: () => void;
  onDismiss: () => void;
  onTapDetail: () => void;
}

export default function GhostCard({
  item,
  variant = 'pool',
  onConfirm,
  onDismiss,
  onTapDetail,
}: GhostCardProps) {
  const sourceType = item.ghostSource || 'manual';
  const sourceStyle = SOURCE_STYLES[sourceType as GhostSourceType];

  // Get source-specific note text
  const getSourceNote = (): string | undefined => {
    switch (sourceType) {
      case 'friend':
        return item.friendAttribution?.note;
      case 'terrazzo':
        return item.terrazzoReasoning?.rationale;
      case 'maps':
        return item.savedDate;
      default:
        return undefined;
    }
  };

  // Get source label
  const getSourceLabel = (): string => {
    switch (sourceType) {
      case 'friend':
        return `${item.friendAttribution?.name || 'Friend'} recommends`;
      case 'terrazzo':
        return 'Terrazzo suggestion';
      case 'maps':
        return 'Google Maps';
      case 'email':
        return 'via Email';
      case 'article':
        return item.source?.name || 'Article';
      default:
        return sourceStyle.label;
    }
  };

  const note = getSourceNote();

  // === SLOT VARIANT — compact two-line card ===
  if (variant === 'slot') {
    return (
      <div
        className="relative cursor-pointer transition-all ghost-shimmer rounded-lg flex items-center gap-2"
        style={{
          background: 'var(--t-cream)',
          border: `1.5px dashed ${sourceStyle.color}`,
          padding: '8px 10px',
        }}
        onClick={onTapDetail}
      >
        {/* Left: source icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: sourceStyle.bg, color: sourceStyle.color }}
        >
          {sourceStyle.icon}
        </div>

        {/* Middle: name + source/note on two lines */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[12px] font-medium truncate"
              style={{ color: 'var(--t-ink)' }}
            >
              {item.name}
            </span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: sourceStyle.bg, color: sourceStyle.color }}
            >
              {getSourceLabel()}
            </span>
          </div>
          {note && (
            <div
              className="text-[10px] italic truncate mt-0.5"
              style={{ color: 'rgba(28,26,23,0.9)' }}
            >
              {sourceType === 'friend' ? `"${note}"` : note}
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
            style={{
              background: 'var(--t-verde)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            ✓ Add
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all"
            style={{
              background: 'rgba(28,26,23,0.06)',
              color: 'rgba(28,26,23,0.85)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // === POOL VARIANT — small card for horizontal scroll in PoolTray ===
  return (
    <div
      className="relative group cursor-pointer transition-all active:scale-[0.98] ghost-shimmer"
      style={{
        background: 'white',
        border: `1.5px dashed ${sourceStyle.color}`,
        borderRadius: 12,
        padding: '12px',
        minWidth: 180,
        maxWidth: 220,
        flexShrink: 0,
      }}
      onClick={onTapDetail}
    >
      {/* Source icon badge - top right */}
      <div
        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-sm"
        style={{
          background: sourceStyle.bg,
          color: sourceStyle.color,
        }}
      >
        {sourceStyle.icon}
      </div>

      {/* Place name */}
      <div
        className="font-semibold text-sm leading-tight pr-8 mb-0.5"
        style={{
          color: 'var(--t-ink)',
          fontFamily: "'DM Serif Display', serif",
        }}
      >
        {item.name}
      </div>

      {/* Source attribution */}
      <div className="mt-1.5">
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{
            background: sourceStyle.bg,
            color: sourceStyle.color,
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {sourceStyle.icon} {getSourceLabel()}
        </div>
        {note && (
          <div
            className="text-[10px] ml-0.5 italic mt-1"
            style={{ color: 'rgba(28,26,23,0.9)' }}
          >
            {sourceType === 'friend' ? `"${note}"` : note}
          </div>
        )}
      </div>

      {/* Action buttons - appear on hover */}
      <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          className="flex-1 px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all hover:scale-105"
          style={{
            background: 'var(--t-verde)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ✓
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="flex-1 px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all hover:scale-105"
          style={{
            background: 'var(--t-travertine)',
            color: 'var(--t-ink)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
