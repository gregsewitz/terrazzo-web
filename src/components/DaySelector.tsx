'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { Trip } from '@/types';
import { FONT, INK } from '@/constants/theme';

export interface DaySelectorProps {
  trip: Trip;
  currentDay: number;
  setCurrentDay: (day: number) => void;
  getDestColor: (dest: string) => { accent: string; bg: string; text: string };
  /** Called when user taps the "..." menu button */
  onOpenDayMenu?: () => void;
  /** Called when user long-presses on a day chip */
  onDayLongPress?: (dayNumber: number) => void;
}

const DaySelector = memo(({
  trip,
  currentDay,
  setCurrentDay,
  getDestColor,
  onOpenDayMenu,
  onDayLongPress,
}: DaySelectorProps) => {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];
  const isFlexible = trip.flexibleDates === true;
  const dayDestColor = getDestColor(day?.destination || '');

  // Long-press handlers for day chips
  const handleTouchStart = useCallback((dayNumber: number) => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      try { navigator.vibrate?.(10); } catch { /* ignore */ }
      onDayLongPress?.(dayNumber);
    }, 500);
  }, [onDayLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Scroll active chip into view when expanded
  useEffect(() => {
    if (expanded && scrollRef.current) {
      const activeChip = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeChip) {
        const container = scrollRef.current;
        const chipLeft = activeChip.offsetLeft;
        const chipWidth = activeChip.offsetWidth;
        const containerWidth = container.offsetWidth;
        container.scrollTo({
          left: chipLeft - containerWidth / 2 + chipWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [expanded, currentDay]);

  // Format the current day label for the header
  const dayLabel = isFlexible
    ? `Day ${day?.dayNumber || 1}`
    : `${day?.dayOfWeek || 'Day'}, ${day?.date || ''}`;

  return (
    <div
      style={{
        background: 'white',
        borderTop: '1px solid var(--t-linen)',
      }}
    >
      {/* ─── Tappable Day Header ─── */}
      <div
        className="w-full flex items-center px-4"
        style={{ height: 44 }}
      >
        {/* Left side — tappable to expand/collapse day picker */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            height: '100%',
          }}
        >
          <span
            style={{
              fontFamily: FONT.serif,
              fontSize: 16,
              fontWeight: 400,
              color: 'var(--t-ink)',
              letterSpacing: -0.2,
              flexShrink: 0,
            }}
          >
            Day {currentDay}
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: INK['50'],
              flexShrink: 0,
            }}
          >
            · {dayLabel}
          </span>
          {day?.destination && (
            <span
              className="px-1.5 py-px rounded-full text-[10px] font-medium truncate"
              style={{
                background: dayDestColor.bg,
                color: dayDestColor.accent,
                fontFamily: FONT.sans,
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {day.destination}
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={INK['40']}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Right side — day utility menu button */}
        {onOpenDayMenu && (
          <button
            onClick={onOpenDayMenu}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: INK['04'],
              border: 'none',
              cursor: 'pointer',
              marginLeft: 8,
            }}
            aria-label="Day options"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={INK['50']}>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Collapsible Day Chips Tray ─── */}
      <div
        style={{
          maxHeight: expanded ? 100 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
          borderTop: expanded ? '1px solid var(--t-linen)' : '0px solid transparent',
        }}
      >
        <div
          ref={scrollRef}
          className="flex gap-2 px-4 py-2.5"
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {trip.days.map((d) => {
            const isActive = d.dayNumber === currentDay;
            const chipDestColor = getDestColor(d.destination || '');
            const shortDay = isFlexible ? '' : (d.dayOfWeek?.slice(0, 3) || '');
            const dateNum = isFlexible
              ? d.dayNumber
              : (d.date?.replace(/\D/g, ' ').trim().split(' ').pop() || d.dayNumber);

            return (
              <button
                key={d.dayNumber}
                data-active={isActive}
                onClick={() => {
                  if (!longPressFired.current) {
                    setCurrentDay(d.dayNumber);
                    setExpanded(false);
                  }
                }}
                onTouchStart={() => handleTouchStart(d.dayNumber)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onContextMenu={(e) => { e.preventDefault(); onDayLongPress?.(d.dayNumber); }}
                className="flex flex-col items-center flex-shrink-0 rounded-xl cursor-pointer"
                style={{
                  padding: '8px 14px',
                  minWidth: 64,
                  background: isActive ? chipDestColor.bg : INK['04'],
                  border: isActive
                    ? `1.5px solid ${chipDestColor.accent}`
                    : '1.5px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? chipDestColor.accent : INK['85'],
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isFlexible ? `Day ${dateNum}` : `${shortDay} ${dateNum}`}
                </span>
                {d.destination && (
                  <span
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 9,
                      fontWeight: 500,
                      color: isActive ? chipDestColor.accent : INK['50'],
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.destination}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hide scrollbar */}
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
});

DaySelector.displayName = 'DaySelector';

export default DaySelector;
