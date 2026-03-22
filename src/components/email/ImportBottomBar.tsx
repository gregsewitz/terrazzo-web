'use client';

import React from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import type { ActiveTab } from '@/hooks/useEmailReservations';

// ─── Component ──────────────────────────────────────────────────────────────

interface ImportBottomBarProps {
  selectedCount: number;
  activeTab: ActiveTab;
  importing: boolean;
  onImport: () => void;
  onDismiss: () => void;
}

export const ImportBottomBar = React.memo(function ImportBottomBar({
  selectedCount,
  activeTab,
  importing,
  onImport,
  onDismiss,
}: ImportBottomBarProps) {
  const hasSelection = selectedCount > 0;
  const label = activeTab === 'upcoming'
    ? `Import ${selectedCount} place${selectedCount !== 1 ? 's' : ''}`
    : `Save ${selectedCount} to library`;

  return (
    <div
      className="sticky bottom-0 z-20 px-5 py-4"
      style={{
        background: 'linear-gradient(transparent, var(--t-cream) 20%)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }} className="flex flex-col gap-2">
        {/* Primary action */}
        <button
          onClick={onImport}
          disabled={!hasSelection || importing}
          className="w-full py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            background: hasSelection ? TEXT.primary : 'rgba(0,0,0,0.10)',
            color: hasSelection ? 'white' : TEXT.secondary,
            opacity: importing ? 0.7 : 1,
            fontFamily: FONT.sans,
          }}
        >
          {importing ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Importing…
            </>
          ) : (
            <>
              {label}
              <PerriandIcon name="terrazzo" size={16} color={hasSelection ? 'white' : TEXT.secondary} />
            </>
          )}
        </button>

        {/* Secondary dismiss */}
        {hasSelection && !importing && (
          <button
            onClick={onDismiss}
            className="w-full py-2 bg-transparent border-none cursor-pointer text-[11px] font-medium"
            style={{ color: TEXT.secondary }}
          >
            Dismiss {selectedCount} instead
          </button>
        )}

        {!hasSelection && (
          <p className="text-center text-[10px] mt-0.5" style={{ color: TEXT.secondary }}>
            Select places to import them to your library
          </p>
        )}
      </div>
    </div>
  );
});

ImportBottomBar.displayName = 'ImportBottomBar';
