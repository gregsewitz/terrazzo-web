'use client';

import React from 'react';
import { FONT, COLOR } from '@/constants/theme';

/**
 * Small pill badge shown in the corner of a grid cell when ghost suggestions
 * are hidden behind the "View all" overflow. Clicking opens the slot overlay.
 */
function GhostBadge({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-pointer"
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 5,
        background: 'var(--t-cream)',
        border: `1px dashed ${COLOR.coral}80`,
        fontFamily: FONT.mono,
        fontSize: 8,
        fontWeight: 600,
        color: `var(--t-coral, ${COLOR.coral})`,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
      aria-label={`${count} suggestion${count > 1 ? 's' : ''}`}
    >
      {count} suggestion{count > 1 ? 's' : ''}
    </button>
  );
}

export default React.memo(GhostBadge);
