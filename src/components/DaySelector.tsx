'use client';

import { useRef, useEffect, useState, memo } from 'react';
import { Trip, DEST_COLORS } from '@/types';
import AddDestinationSearch from './AddDestinationSearch';
import { FONT, INK } from '@/constants/theme';
import { generateDestColor } from '@/lib/destination-helpers';

export interface DaySelectorProps {
  trip: Trip;
  currentDay: number;
  setCurrentDay: (day: number) => void;
  reorderDays: (from: number, to: number) => void;
  setDayDestination: (day: number, dest: string) => void;
  getDestColor: (dest: string) => { accent: string; bg: string; text: string };
  uniqueDestinations: string[];
}

const DaySelector = memo(({
  trip,
  currentDay,
  setCurrentDay,
  reorderDays,
  setDayDestination,
  getDestColor,
  uniqueDestinations,
}: DaySelectorProps) => {
  const [destPickerDay, setDestPickerDay] = useState<number | 'add-new' | null>(null);
  const [destPickerAddMode, setDestPickerAddMode] = useState(false);
  const destPickerRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Close destination picker on click outside
  useEffect(() => {
    if (destPickerDay === null) return;
    const handler = (e: MouseEvent) => {
      if (
        destPickerRef.current && !destPickerRef.current.contains(e.target as Node) &&
        (!addBtnRef.current || !addBtnRef.current.contains(e.target as Node))
      ) {
        setDestPickerDay(null);
        setDestPickerAddMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [destPickerDay]);

  return (
    <div
      className="flex"
      style={{
        background: 'white',
        borderTop: '1px solid var(--t-linen)',
      }}
    >
      {trip.days.map((d) => {
        const isDayActive = d.dayNumber === currentDay;
        const dayDestColor = getDestColor(d.destination || '');
        const isFlexible = trip.flexibleDates === true;
        const shortDay = isFlexible ? '' : (d.dayOfWeek?.slice(0, 3) || '');
        const dateNum = isFlexible ? d.dayNumber : (d.date?.replace(/\D/g, ' ').trim().split(' ').pop() || d.dayNumber);
        // Extract month abbreviation from date string like "Jun 15"
        const shortMonth = isFlexible ? '' : (d.date?.match(/^([A-Za-z]+)/)?.[1] || '');
        // Show month label on first day, and whenever month changes from previous day
        const prevDay = trip.days[trip.days.indexOf(d) - 1];
        const prevMonth = prevDay?.date?.match(/^([A-Za-z]+)/)?.[1] || '';
        const showMonth = !isFlexible && (!prevDay || shortMonth !== prevMonth);

        return (
          <div
            key={d.dayNumber}
            role="tab"
            tabIndex={0}
            aria-selected={isDayActive}
            onClick={() => setCurrentDay(d.dayNumber)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentDay(d.dayNumber); } }}
            className="flex-1 flex flex-col items-center py-1.5 px-1 cursor-pointer transition-all"
            style={{
              border: 'none',
              borderBottom: isDayActive ? `2px solid ${dayDestColor.accent}` : '2px solid transparent',
              background: isDayActive ? `${dayDestColor.accent}08` : 'transparent',
              position: 'relative',
            }}
          >
            <span style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              fontWeight: 600,
              color: isDayActive ? dayDestColor.accent : INK['60'],
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              lineHeight: 1,
              marginBottom: 1,
              visibility: showMonth ? 'visible' : 'hidden',
            }}>
              {isFlexible ? '\u00A0' : (shortMonth || '\u00A0')}
            </span>
            <span style={{
              fontFamily: FONT.sans,
              fontSize: isFlexible ? 11 : 12,
              fontWeight: 600,
              color: isDayActive ? 'var(--t-ink)' : INK['85'],
              lineHeight: 1.2,
            }}>
              {isFlexible ? `Day ${dateNum}` : `${shortDay} ${dateNum}`}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentDay(d.dayNumber);
                setDestPickerDay(prev => prev === d.dayNumber ? null : d.dayNumber);
              }}
              style={{
                fontFamily: FONT.sans,
                fontSize: 9,
                fontWeight: 500,
                color: isDayActive ? dayDestColor.accent : INK['80'],
                cursor: 'pointer',
                position: 'relative',
                background: 'none',
                border: 'none',
                borderBottom: `1px dashed ${isDayActive ? dayDestColor.accent + '60' : INK['30']}`,
                padding: 0,
              }}
            >
              {d.destination || 'TBD'}
            </button>

            {/* Reorder arrows — visible on active day */}
            {isDayActive && trip.days.length > 1 && (
              <div className="flex gap-0.5 mt-0.5">
                {d.dayNumber > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); reorderDays(d.dayNumber, d.dayNumber - 1); }}
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 16, height: 14, background: `${dayDestColor.accent}15`,
                      cursor: 'pointer', padding: 0, border: 'none'
                    }}
                    aria-label="Move day earlier"
                  >
                    <span style={{ fontSize: 8, color: dayDestColor.accent, lineHeight: 1 }}>◀</span>
                  </button>
                )}
                {d.dayNumber < trip.days.length && (
                  <button
                    onClick={(e) => { e.stopPropagation(); reorderDays(d.dayNumber, d.dayNumber + 1); }}
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 16, height: 14, background: `${dayDestColor.accent}15`,
                      cursor: 'pointer', padding: 0, border: 'none'
                    }}
                    aria-label="Move day later"
                  >
                    <span style={{ fontSize: 8, color: dayDestColor.accent, lineHeight: 1 }}>▶</span>
                  </button>
                )}
              </div>
            )}

            {/* Destination picker popover */}
            {destPickerDay === d.dayNumber && (
              <div
                ref={destPickerRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 4,
                  background: 'white',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: '1px solid var(--t-linen)',
                  padding: destPickerAddMode ? 0 : 8,
                  zIndex: 50,
                  minWidth: destPickerAddMode ? 240 : 160,
                }}
              >
                {destPickerAddMode ? (
                  <AddDestinationSearch
                    onAdded={() => {
                      setDestPickerDay(null);
                      setDestPickerAddMode(false);
                    }}
                    onCancel={() => {
                      setDestPickerAddMode(false);
                    }}
                  />
                ) : (
                  <>
                    {uniqueDestinations.map(dest => {
                      const isCurrent = dest === d.destination;
                      const destC = getDestColor(dest);
                      return (
                        <button
                          key={dest}
                          onClick={() => {
                            if (!isCurrent) setDayDestination(d.dayNumber, dest);
                            setDestPickerDay(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: isCurrent ? destC.bg : 'transparent',
                            fontFamily: FONT.sans,
                            fontSize: 13,
                            color: 'var(--t-ink)',
                            cursor: isCurrent ? 'default' : 'pointer',
                            fontWeight: isCurrent ? 600 : 400,
                            opacity: isCurrent ? 0.6 : 1,
                          }}
                        >
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: destC.accent, flexShrink: 0,
                          }} />
                          {dest}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setDestPickerAddMode(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 10px',
                        marginTop: 2,
                        borderRadius: 8,
                        border: 'none',
                        borderTop: '1px solid var(--t-linen)',
                        background: 'transparent',
                        fontFamily: FONT.sans,
                        fontSize: 12,
                        color: INK['50'],
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                      Add destination
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* "+" button to add a new destination */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={addBtnRef}
          onClick={() => {
            if (destPickerDay === 'add-new') {
              setDestPickerDay(null);
              setDestPickerAddMode(false);
            } else {
              setDestPickerDay('add-new');
              setDestPickerAddMode(false);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid transparent',
            cursor: 'pointer',
            color: INK['55'],
            fontSize: 18,
            padding: 0,
          }}
          title="Add destination"
        >
          +
        </button>
        {destPickerDay === 'add-new' && (
          <div
            ref={destPickerRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid var(--t-linen)',
              zIndex: 50,
              minWidth: 240,
            }}
          >
            <AddDestinationSearch
              onAdded={() => {
                setDestPickerDay(null);
                setDestPickerAddMode(false);
              }}
              onCancel={() => {
                setDestPickerDay(null);
                setDestPickerAddMode(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

DaySelector.displayName = 'DaySelector';

export default DaySelector;
