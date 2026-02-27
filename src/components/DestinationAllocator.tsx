'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// ─── Color palette for destination blocks ───
const DEST_COLORS = [
  { bg: 'rgba(42,122,86,0.12)', border: 'rgba(42,122,86,0.4)', text: 'var(--t-verde)' },
  { bg: 'rgba(200,146,58,0.12)', border: 'rgba(200,146,58,0.4)', text: '#8a6a2a' },
  { bg: 'rgba(120,90,160,0.12)', border: 'rgba(120,90,160,0.4)', text: '#6b4f8a' },
  { bg: 'rgba(58,140,180,0.12)', border: 'rgba(58,140,180,0.4)', text: '#2a6a8a' },
  { bg: 'rgba(180,80,80,0.12)', border: 'rgba(180,80,80,0.4)', text: '#8a3a3a' },
];

interface DestinationAllocatorProps {
  destinations: string[];
  totalNights: number;
  allocation: Record<string, number>;
  onChange: (allocation: Record<string, number>) => void;
}

function DestinationAllocator({
  destinations,
  totalNights,
  allocation,
  onChange,
}: DestinationAllocatorProps) {
  const barRef = useRef<HTMLDivElement>(null);

  // Compute cumulative positions for dividers
  const cumulativeDays: number[] = [];
  let running = 0;
  for (const dest of destinations) {
    running += allocation[dest] || 1;
    cumulativeDays.push(running);
  }

  // ─── Drag divider logic ───
  const dragDivider = useRef<number | null>(null);

  const handleDividerDown = useCallback((e: React.PointerEvent, dividerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragDivider.current = dividerIndex;

    const bar = barRef.current;
    if (!bar) return;

    const onMove = (ev: PointerEvent) => {
      if (dragDivider.current === null) return;
      const barRect = bar.getBoundingClientRect();
      const x = ev.clientX - barRect.left;
      const pct = Math.max(0, Math.min(1, x / barRect.width));
      const rawDay = Math.round(pct * totalNights);

      // This divider sits between destination[idx] and destination[idx+1]
      const idx = dragDivider.current;
      const leftDest = destinations[idx];
      const rightDest = destinations[idx + 1];
      if (!leftDest || !rightDest) return;

      // Sum of days before leftDest
      let leftMin = 0;
      for (let i = 0; i < idx; i++) leftMin += allocation[destinations[i]] || 1;

      // The divider position determines how many days the left dest gets
      const leftDays = Math.max(1, rawDay - leftMin);
      // For right dest, just set what's implied by the divider position
      // Sum of days after rightDest
      let afterRight = 0;
      for (let i = idx + 2; i < destinations.length; i++) afterRight += allocation[destinations[i]] || 1;
      const rightDays = Math.max(1, totalNights - leftMin - leftDays - afterRight);

      const newAlloc = { ...allocation };
      newAlloc[leftDest] = leftDays;
      newAlloc[rightDest] = rightDays;
      onChange(newAlloc);
    };

    const onUp = () => {
      dragDivider.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [allocation, cumulativeDays, destinations, onChange, totalNights]);

  // ─── Button adjustments (no auto-redistribution) ───
  const adjustDays = (dest: string, delta: number) => {
    const current = allocation[dest] || 1;
    const newVal = current + delta;
    if (newVal < 1) return;

    const newAlloc = { ...allocation };
    newAlloc[dest] = newVal;
    onChange(newAlloc);
  };

  // Compute current total for validation display
  const currentTotal = destinations.reduce((sum, dest) => sum + (allocation[dest] || 1), 0);
  const isBalanced = currentTotal === totalNights;

  return (
    <div className="mb-8">
      <label
        className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-3"
        style={{ fontFamily: FONT.mono, color: INK['90'] }}
      >
        NIGHTS PER DESTINATION
      </label>

      <p className="text-[12px] mb-4 leading-relaxed" style={{ color: INK['60'], fontFamily: FONT.sans }}>
        Drag the dividers or use ± to adjust how many nights you spend in each place.
      </p>

      {/* Visual timeline bar */}
      <div
        ref={barRef}
        className="relative flex h-12 rounded-xl overflow-hidden mb-4"
        style={{ border: '1px solid var(--t-linen)' }}
      >
        {destinations.map((dest, i) => {
          const days = allocation[dest] || 1;
          const pct = (days / (currentTotal || 1)) * 100;
          const color = DEST_COLORS[i % DEST_COLORS.length];
          return (
            <div
              key={dest}
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                width: `${pct}%`,
                background: color.bg,
                borderRight: i < destinations.length - 1 ? 'none' : undefined,
                transition: dragDivider.current !== null ? 'none' : 'width 200ms ease',
              }}
            >
              <span
                className="text-[11px] font-semibold truncate px-2"
                style={{ color: color.text, fontFamily: FONT.sans }}
              >
                {dest}
              </span>
              <span
                className="absolute bottom-1 text-[9px] font-bold"
                style={{ color: color.text, fontFamily: FONT.mono, opacity: 0.7 }}
              >
                {days}n
              </span>

              {/* Divider handle — between this and next */}
              {i < destinations.length - 1 && (
                <div
                  className="absolute right-0 top-0 bottom-0 flex items-center justify-center cursor-col-resize z-10"
                  style={{ width: 16, transform: 'translateX(50%)' }}
                  onPointerDown={(e) => handleDividerDown(e, i)}
                >
                  <div
                    className="w-[3px] h-6 rounded-full"
                    style={{ background: INK['30'] }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-destination detail rows */}
      <div className="flex flex-col gap-2">
        {destinations.map((dest, i) => {
          const days = allocation[dest] || 1;
          const color = DEST_COLORS[i % DEST_COLORS.length];
          const isFirst = i === 0;
          const isLast = i === destinations.length - 1;

          return (
            <div
              key={dest}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: color.bg, border: `1px solid ${color.border}` }}
            >
              {/* Color dot + name */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: color.text }}
              />
              <div className="flex-1 min-w-0">
                <span
                  className="text-[13px] font-medium truncate block"
                  style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
                >
                  {dest}
                </span>
                {isFirst && (
                  <span className="text-[10px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>
                    Arrival
                  </span>
                )}
                {isLast && destinations.length > 1 && (
                  <span className="text-[10px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>
                    Departure
                  </span>
                )}
              </div>

              {/* Day count + stepper */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => adjustDays(dest, -1)}
                  disabled={days <= 1}
                  className="w-6 h-6 rounded-full flex items-center justify-center border-none cursor-pointer disabled:opacity-20"
                  style={{ background: 'white', color: 'var(--t-ink)' }}
                >
                  <span className="text-[13px] font-bold leading-none">−</span>
                </button>
                <span
                  className="text-[14px] font-bold w-8 text-center"
                  style={{ color: color.text, fontFamily: FONT.mono }}
                >
                  {days}
                </span>
                <button
                  onClick={() => adjustDays(dest, 1)}
                  className="w-6 h-6 rounded-full flex items-center justify-center border-none cursor-pointer disabled:opacity-20"
                  style={{ background: 'white', color: 'var(--t-ink)' }}
                >
                  <span className="text-[13px] font-bold leading-none">+</span>
                </button>
                <span className="text-[10px] ml-0.5" style={{ color: INK['50'], fontFamily: FONT.sans }}>
                  {days === 1 ? 'night' : 'nights'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div
        className="flex items-center justify-between mt-3 px-1"
      >
        <span className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
          Total
        </span>
        <span className="text-[12px] font-bold" style={{ color: isBalanced ? 'var(--t-ink)' : '#c04040', fontFamily: FONT.mono }}>
          {currentTotal} / {totalNights} nights
        </span>
      </div>
      {!isBalanced && (
        <div
          className="mt-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
          style={{ background: 'rgba(192,64,64,0.08)', color: '#8a3a3a', fontFamily: FONT.sans }}
        >
          {currentTotal < totalNights
            ? `${totalNights - currentTotal} night${totalNights - currentTotal !== 1 ? 's' : ''} still to assign`
            : `${currentTotal - totalNights} night${currentTotal - totalNights !== 1 ? 's' : ''} over — reduce to continue`}
        </div>
      )}
    </div>
  );
}

export default React.memo(DestinationAllocator);
