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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onRegisterSlotRef(dayNumber, slotId, el.getBoundingClientRect());
    report();
    // Re-register on resize & scroll (the parent board scrolls horizontally)
    window.addEventListener('resize', report);
    const scrollParent = el.closest('.overflow-x-auto') || el.closest('.overflow-y-auto');
    if (scrollParent) {
      scrollParent.addEventListener('scroll', report, { passive: true });
    }
    return () => {
      window.removeEventListener('resize', report);
      if (scrollParent) scrollParent.removeEventListener('scroll', report);
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
