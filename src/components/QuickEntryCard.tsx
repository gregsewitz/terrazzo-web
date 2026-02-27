'use client';

import { memo, useState, useCallback } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { QuickEntry, QUICK_ENTRY_CATEGORY_ICONS } from '@/types';
import { QUICK_ENTRY_CATEGORY_ICONS as CATEGORY_ICONS } from '@/types';
import { formatTime12h } from './PlaceTimeEditor';

// ─── Component ──────────────────────────────────────────────────────────

interface QuickEntryCardProps {
  entry: QuickEntry;
  onRemove: () => void;
  onConfirm?: () => void;   // Promote tentative → confirmed
  onTap?: () => void;        // Tap to edit or expand
}

function QuickEntryCard({ entry, onRemove, onConfirm, onTap }: QuickEntryCardProps) {
  const isTentative = entry.status === 'tentative';
  const iconName = CATEGORY_ICONS[entry.category] || 'pin';

  // Category accent colors — subtle, muted
  const categoryColors: Record<string, string> = {
    activity: '#2a7a56',    // verde
    transport: '#5a7a9a',   // steel blue
    dining: '#c8923a',      // honey
    logistics: '#6b8b9a',   // ghost
    other: '#6b8b9a',
  };
  const accentColor = categoryColors[entry.category] || categoryColors.other;

  return (
    <div
      className="mb-1.5 rounded-lg overflow-hidden select-none group/qe"
      onClick={() => {
        if (onTap) onTap();
      }}
      style={{
        background: isTentative ? 'var(--t-cream)' : 'white',
        border: isTentative
          ? '1.5px dashed rgba(28,26,23,0.18)'
          : `1px solid ${accentColor}22`,
        opacity: isTentative ? 0.85 : 1,
        cursor: 'pointer',
        transition: 'opacity 0.15s, border-color 0.15s',
      }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Category accent bar */}
        <div
          className="flex-shrink-0 rounded-full"
          style={{
            width: isTentative ? 2 : 2,
            height: 26,
            background: accentColor,
            opacity: isTentative ? 0.35 : 0.55,
          }}
        />

        {/* Icon */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 22,
            height: 22,
            background: `${accentColor}10`,
          }}
        >
          <PerriandIcon name={iconName} size={12} color={accentColor} accent={accentColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[12px] font-medium truncate"
              style={{
                color: isTentative ? INK['80'] : 'var(--t-ink)',
                fontFamily: FONT.sans,
                fontStyle: isTentative ? 'italic' : 'normal',
              }}
            >
              {entry.label}
            </span>
            {isTentative && (
              <span
                className="text-[8px] font-semibold px-1 py-px rounded flex-shrink-0"
                style={{
                  background: INK['08'],
                  color: INK['70'],
                  letterSpacing: 0.3,
                }}
              >
                MAYBE
              </span>
            )}
          </div>

          {/* Time line — matches PlaceTimeEditor format */}
          {entry.specificTime && (
            <span
              className="inline-flex items-center gap-1 mt-px"
              style={{
                fontSize: 10,
                fontFamily: FONT.sans,
                color: INK['70'],
                fontStyle: 'italic',
              }}
            >
              <svg width={9} height={9} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="6.5" stroke={INK['50']} strokeWidth="1.5" />
                <path d="M8 4.5V8L10.5 9.5" stroke={INK['50']} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {entry.specificTimeLabel ? `${entry.specificTimeLabel} at ` : ''}{formatTime12h(entry.specificTime)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Tentative → confirm on tap (always visible on mobile, hover on desktop) */}
          {isTentative && onConfirm && (
            <button
              onClick={(e) => { e.stopPropagation(); onConfirm(); }}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-opacity sm:opacity-0 sm:group-hover/qe:opacity-100"
              style={{
                background: 'rgba(42,122,86,0.08)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Confirm entry"
              title="Confirm this entry"
            >
              <PerriandIcon name="check" size={10} color="var(--t-verde)" />
            </button>
          )}

          {/* Remove button — 24px touch target on mobile */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-6 h-6 sm:w-5 sm:h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: INK['05'],
              border: 'none',
              cursor: 'pointer',
              // On mobile always visible, on desktop show on hover
              opacity: 1,
            }}
            aria-label="Remove entry"
          >
            <PerriandIcon name="close" size={8} color={INK['70']} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(QuickEntryCard);
