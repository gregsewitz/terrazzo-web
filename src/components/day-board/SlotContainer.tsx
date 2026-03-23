'use client';

import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Wrapper that registers its bounding rect with the parent for hit-testing.
 */
function SlotContainer({
  dayNumber, slotId, children, onRegisterSlotRef, isDropActive, minHeight, style,
}: {
  dayNumber: number;
  slotId: string;
  children: React.ReactNode;
  onRegisterSlotRef: (dayNumber: number, slotId: string, rect: DOMRect | null) => void;
  isDropActive: boolean;
  minHeight: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Register slot element for live hit-testing during drag.
  // Pass the element ref so hit-test can call getBoundingClientRect() live
  // instead of relying on cached rects that go stale after scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    (onRegisterSlotRef as (d: number, s: string, r: DOMRect | null, el?: HTMLElement | null) => void)(
      dayNumber, slotId, el.getBoundingClientRect(), el
    );
    const report = () => onRegisterSlotRef(dayNumber, slotId, el.getBoundingClientRect());
    window.addEventListener('resize', report);
    return () => {
      window.removeEventListener('resize', report);
      onRegisterSlotRef(dayNumber, slotId, null);
    };
  }, [dayNumber, slotId, onRegisterSlotRef]);

  return (
    <div
      ref={ref}
      className="flex flex-col"
      style={{
        borderBottom: '1px solid var(--t-linen)',
        background: isDropActive ? 'rgba(58,128,136,0.06)' : undefined,
        borderLeft: isDropActive ? '3px solid var(--t-dark-teal)' : '3px solid transparent',
        transition: 'all 150ms ease',
        minHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default SlotContainer;
