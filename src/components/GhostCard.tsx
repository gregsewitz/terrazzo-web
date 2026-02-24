'use client';

import { ImportedPlace, SOURCE_STYLES, GhostSourceType } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';

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
  const isDesktop = useIsDesktop();
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

  // === SLOT VARIANT — compact card layout ===
  if (variant === 'slot') {
    return (
      <div
        className="relative cursor-pointer transition-all ghost-shimmer rounded-lg"
        style={{
          background: 'var(--t-cream)',
          border: `1.5px dashed ${sourceStyle.color}`,
          padding: isDesktop ? '8px 10px' : '8px 10px',
        }}
        onClick={onTapDetail}
      >
        {/* Top row: icon + name + action buttons inline */}
        <div className="flex items-center gap-2">
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{ width: 28, height: 28, background: sourceStyle.bg }}
          >
            <PerriandIcon name={sourceStyle.icon} size={14} color={sourceStyle.color} />
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="font-medium block truncate"
              style={{ color: 'var(--t-ink)', fontSize: isDesktop ? 12 : 11 }}
            >
              {item.name}
            </span>
            <span
              className="block truncate"
              style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['60'], marginTop: 1 }}
            >
              {item.type}{item.location ? ` · ${item.location.split(',')[0]}` : ''}
            </span>
          </div>
          {/* Action buttons — inline right */}
          <div className="flex gap-1 flex-shrink-0 items-center">
            <button
              onClick={(e) => { e.stopPropagation(); onConfirm(); }}
              className="px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-0.5 btn-hover"
              style={{
                background: 'var(--t-verde)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10,
              }}
            >
              <PerriandIcon name="check" size={10} color="white" /> Add
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all nav-hover"
              style={{
                background: INK['06'],
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <PerriandIcon name="close" size={10} color={INK['85']} />
            </button>
          </div>
        </div>

        {/* Source badge + note */}
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"
            style={{ background: sourceStyle.bg, color: sourceStyle.color, fontSize: 9 }}
          >
            <PerriandIcon name={sourceStyle.icon} size={9} color={sourceStyle.color} />
            {getSourceLabel()}
          </span>
          {note && (
            <span
              className="italic truncate"
              style={{ color: INK['60'], fontSize: 10 }}
            >
              {sourceType === 'friend' ? `"${note}"` : note}
            </span>
          )}
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
        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
        style={{
          background: sourceStyle.bg,
        }}
      >
        <PerriandIcon name={sourceStyle.icon} size={14} color={sourceStyle.color} />
      </div>

      {/* Place name */}
      <div
        className="font-semibold text-sm leading-tight pr-8 mb-0.5"
        style={{
          color: 'var(--t-ink)',
          fontFamily: FONT.serif,
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
            fontFamily: FONT.mono,
          }}
        >
          <PerriandIcon name={sourceStyle.icon} size={12} color={sourceStyle.color} />
          {getSourceLabel()}
        </div>
        {note && (
          <div
            className="text-[10px] ml-0.5 italic mt-1"
            style={{ color: INK['90'] }}
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
            fontFamily: FONT.sans,
          }}
        >
          <PerriandIcon name="check" size={12} color="white" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="flex-1 px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all hover:scale-105"
          style={{
            background: 'var(--t-travertine)',
            color: 'var(--t-ink)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT.sans,
          }}
        >
          <PerriandIcon name="close" size={12} color="var(--t-ink)" />
        </button>
      </div>
    </div>
  );
}
