'use client';

import { ImportedPlace, SOURCE_STYLES, GhostSourceType } from '@/types';

interface GhostCardProps {
  item: ImportedPlace;
  onConfirm: () => void;
  onDismiss: () => void;
  onTapDetail: () => void;
}

export default function GhostCard({
  item,
  onConfirm,
  onDismiss,
  onTapDetail,
}: GhostCardProps) {
  const sourceType = item.ghostSource || 'manual';
  const sourceStyle = SOURCE_STYLES[sourceType as GhostSourceType];

  // Render source attribution line based on source type
  const renderSourceAttribution = () => {
    switch (sourceType) {
      case 'friend':
        return (
          <div className="mt-1.5 space-y-1">
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: sourceStyle.bg,
                color: sourceStyle.color,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {sourceStyle.icon} {item.friendAttribution?.name || 'Friend'}
            </div>
            {item.friendAttribution?.note && (
              <div
                className="text-[10px] ml-0.5 italic"
                style={{ color: 'rgba(28,26,23,0.6)' }}
              >
                "{item.friendAttribution.note}"
              </div>
            )}
          </div>
        );

      case 'ai':
        return (
          <div className="mt-1.5 space-y-1">
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: sourceStyle.bg,
                color: sourceStyle.color,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {sourceStyle.icon} AI suggestion
            </div>
            {item.aiReasoning?.rationale && (
              <div
                className="text-[10px] ml-0.5 italic"
                style={{ color: 'rgba(28,26,23,0.6)' }}
              >
                "{item.aiReasoning.rationale}"
              </div>
            )}
          </div>
        );

      case 'maps':
        return (
          <div className="mt-1.5 space-y-1">
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: sourceStyle.bg,
                color: sourceStyle.color,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {sourceStyle.icon} Google Maps
            </div>
            {item.savedDate && (
              <div
                className="text-[10px] ml-0.5 italic"
                style={{ color: 'rgba(28,26,23,0.6)' }}
              >
                Saved {item.savedDate}
              </div>
            )}
          </div>
        );

      case 'email':
        return (
          <div className="mt-1.5">
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: sourceStyle.bg,
                color: sourceStyle.color,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {sourceStyle.icon} via Gmail
            </div>
          </div>
        );

      case 'article':
        return (
          <div className="mt-1.5">
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: sourceStyle.bg,
                color: sourceStyle.color,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {sourceStyle.icon} {item.source?.name || 'Article'}
            </div>
          </div>
        );

      default:
        return (
          <div className="mt-1.5">
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{
                background: sourceStyle.bg,
                color: sourceStyle.color,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {sourceStyle.icon} {sourceStyle.label}
            </div>
          </div>
        );
    }
  };

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
      {renderSourceAttribution()}

      {/* Action buttons - appear inline below */}
      <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Confirm button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className="flex-1 px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all hover:scale-105"
          style={{
            background: 'var(--t-verde)',
            color: 'white',
            fontFamily: "'DM Sans', sans-serif",
          }}
          title="Confirm this suggestion"
        >
          ✓
        </button>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="flex-1 px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all hover:scale-105"
          style={{
            background: 'var(--t-travertine)',
            color: 'var(--t-ink)',
            fontFamily: "'DM Sans', sans-serif",
          }}
          title="Dismiss this suggestion"
        >
          ✕
        </button>
      </div>

    </div>
  );
}
