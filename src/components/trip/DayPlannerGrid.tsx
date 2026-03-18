'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { SLOT_ICONS, SOURCE_STYLES, GhostSourceType, HotelInfo } from '@/types';
import type { TimeSlot, TransportEvent, TripDay } from '@/types';
import { generateDestColor } from '@/lib/destination-helpers';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import HotelInput from './HotelInput';
import DayContextMenu from './DayContextMenu';
import { TransportBanner, TransportInput, getTransportsAfterSlot, getTransportsBeforeSlots } from './TransportBanner';
import GridCell from '@/components/day-board/GridCell';
import SlotOverlay from '@/components/day-board/SlotOverlay';

import { FONT, INK, TEXT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { usePlaceDetail } from '@/context/PlaceDetailContext';
import { useTripCollaboration } from '@/context/TripCollaborationContext';
import { useTripDrag } from '@/context/TripDragContext';

// ─── Constants ───────────────────────────────────────────────
const SLOT_ORDER = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];
const SLOT_LABELS: Record<string, { label: string; time: string }> = {
  breakfast: { label: 'Breakfast', time: '8:00 AM' },
  morning:   { label: 'Morning',   time: '10:00 AM' },
  lunch:     { label: 'Lunch',     time: '12:30 PM' },
  afternoon: { label: 'Afternoon', time: '2:30 PM' },
  dinner:    { label: 'Dinner',    time: '7:00 PM' },
  evening:   { label: 'Evening',   time: '9:30 PM' },
};

const CARD_H = 72;
const CARD_SLOT_H = CARD_H + 6; // card + its bottom margin
const SLOT_ROW_H = (2 * CARD_SLOT_H) + 6 + 22; // ~184px — 2 card slots + top padding + "View all" bar
const TRANSPORT_ROW_H = 40;
const HEADER_H = 36;
const CONTEXT_BAR_H = 30;
const ROW_HEADER_W = 44;
const MIN_COL_W = 260;

// ─── Helpers ─────────────────────────────────────────────────

/** Determine which slot boundaries have transport events across any day in the trip */
function getTransportBoundaries(days: TripDay[]): Set<string> {
  const boundaries = new Set<string>();
  for (const day of days) {
    if (!day.transport?.length) continue;
    for (const t of day.transport) {
      const afterSlot = t.afterSlot || deriveAfterSlotSimple(t.departureTime);
      if (afterSlot) {
        boundaries.add(afterSlot);
      } else {
        boundaries.add('__before__'); // early departures
      }
    }
  }
  return boundaries;
}

/** Simple afterSlot derivation (matches TransportBanner.tsx logic) */
function deriveAfterSlotSimple(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const t = timeStr.trim();
  // Parse hours from common formats
  let hours: number | null = null;
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) hours = parseInt(m24[1]);
  const m12 = t.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i);
  if (m12) {
    hours = parseInt(m12[1]);
    if (m12[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (m12[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  }
  if (hours === null) return undefined;
  if (hours < 8) return undefined;
  if (hours < 10) return 'breakfast';
  if (hours < 12) return 'morning';
  if (hours < 14) return 'lunch';
  if (hours < 19) return 'afternoon';
  if (hours < 21) return 'dinner';
  return 'evening';
}

// ═════════════════════════════════════════════════════════════
// DayPlannerGrid — Main Component
// ═════════════════════════════════════════════════════════════

function DayPlannerGrid() {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const setDayHotelInfo = useTripStore(s => s.setDayHotelInfo);
  const addTransport = useTripStore(s => s.addTransport);
  const removeTransport = useTripStore(s => s.removeTransport);
  const updateTransport = useTripStore(s => s.updateTransport);
  const deleteDay = useTripStore(s => s.deleteDay);
  const insertDay = useTripStore(s => s.insertDay);
  const duplicateDay = useTripStore(s => s.duplicateDay);
  const clearDay = useTripStore(s => s.clearDay);
  const setDayDestination = useTripStore(s => s.setDayDestination);

  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);

  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  // UI state
  const [editingHotelDay, setEditingHotelDay] = useState<number | null>(null);
  const [addingTransportDay, setAddingTransportDay] = useState<number | null>(null);
  const [editingTransportId, setEditingTransportId] = useState<string | null>(null);
  const [deleteDayConfirm, setDeleteDayConfirm] = useState<number | null>(null);
  const [menuDayNumber, setMenuDayNumber] = useState<number | null>(null);
  const dayMenuRef = useRef<HTMLDivElement>(null);

  // Overlay state
  const [overlayState, setOverlayState] = useState<{
    dayNumber: number;
    slotId: string;
    anchorRect: DOMRect;
  } | null>(null);

  // Close day context menu on click outside
  useEffect(() => {
    if (menuDayNumber === null) return;
    const handler = (e: MouseEvent) => {
      if (dayMenuRef.current && !dayMenuRef.current.contains(e.target as Node)) {
        setMenuDayNumber(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuDayNumber]);

  const handleHotelSave = useCallback((dayNumber: number, hotelInfo: HotelInfo | null) => {
    setEditingHotelDay(null);
    setDayHotelInfo(dayNumber, hotelInfo);
  }, [setDayHotelInfo]);

  const handleOpenOverlay = useCallback((dayNumber: number, slotId: string, rect: DOMRect) => {
    setOverlayState({ dayNumber, slotId, anchorRect: rect });
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setOverlayState(null);
  }, []);

  // Unique destinations for picker
  const uniqueDestinations = useMemo(() => {
    if (!trip) return [];
    const seen = new Set<string>();
    return trip.days
      .map(d => d.destination || '')
      .filter(d => d && !seen.has(d) && seen.add(d));
  }, [trip]);

  if (!trip) return null;

  // Compute transport row boundaries across all days
  const transportBoundaries = getTransportBoundaries(trip.days);

  // Build the row sequence: slot rows interleaved with transport rows
  const rows: Array<{ type: 'slot' | 'transport'; slotId?: string; afterSlot?: string; height: number }> = [];

  // Early departures transport row
  if (transportBoundaries.has('__before__')) {
    rows.push({ type: 'transport', afterSlot: '__before__', height: TRANSPORT_ROW_H });
  }

  for (const slotId of SLOT_ORDER) {
    rows.push({ type: 'slot', slotId, height: SLOT_ROW_H });
    // Transport row after this slot (if any day has transport here)
    if (transportBoundaries.has(slotId)) {
      rows.push({ type: 'transport', afterSlot: slotId, height: TRANSPORT_ROW_H });
    }
  }

  // Compute column width
  const dayCount = trip.days.length;
  const colWidth = Math.max(MIN_COL_W, 280); // Will be constrained by CSS

  const isFlexible = trip.flexibleDates === true;

  return (
    <div
      ref={containerRef}
      className="flex h-full overflow-auto"
      style={{ scrollbarWidth: 'thin', background: 'white' }}
    >
      <style>{`
        .day-grid-col:hover .day-col-menu-btn { opacity: 0.5 !important; }
        .day-col-menu-btn:hover { opacity: 0.9 !important; }
      `}</style>

      {/* ── ROW HEADER COLUMN (FROZEN) ── */}
      <div
        className="flex-shrink-0 sticky left-0 z-20"
        style={{
          width: ROW_HEADER_W,
          background: 'white',
          borderRight: '2px solid var(--t-linen)',
        }}
      >
        {/* Header spacer (matches day title + context bar) */}
        <div style={{ height: HEADER_H + CONTEXT_BAR_H, borderBottom: '1px solid var(--t-linen)' }} />

        {/* Row labels */}
        {rows.map((row, i) => {
          if (row.type === 'transport') {
            return (
              <div
                key={`rh-transport-${row.afterSlot}`}
                className="flex items-center justify-center"
                style={{
                  height: row.height,
                  borderBottom: '1px solid var(--t-linen)',
                  background: 'rgba(0,0,0,0.015)',
                }}
              >
                <PerriandIcon name="transport" size={11} color={INK['30']} />
              </div>
            );
          }
          const slotId = row.slotId!;
          const slotInfo = SLOT_LABELS[slotId];
          const icon = SLOT_ICONS[slotId] || 'pin';
          return (
            <div
              key={`rh-${slotId}`}
              className="flex items-center justify-center"
              style={{
                height: row.height,
                borderBottom: '1px solid var(--t-linen)',
                position: 'relative',
              }}
            >
              {/* Vertical label — rotated 180° so it reads bottom-to-top */}
              <div
                className="flex items-center gap-1.5"
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: TEXT.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}>
                  {slotInfo.label}
                </span>
                <span style={{
                  fontFamily: FONT.mono,
                  fontSize: 9,
                  fontWeight: 500,
                  color: TEXT.tertiary,
                }}>
                  {slotInfo.time}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DAY COLUMNS ── */}
      {trip.days.map((day) => {
        const destColor = generateDestColor(day.destination || '');
        const shortDay = isFlexible ? '' : (day.dayOfWeek?.slice(0, 3) || '');
        const dateNum = isFlexible ? day.dayNumber : (day.date?.replace(/\D/g, ' ').trim().split(' ').pop() || day.dayNumber);
        const dayIdx = trip.days.indexOf(day);
        const prevDay = dayIdx > 0 ? trip.days[dayIdx - 1] : null;
        const shortMonth = isFlexible ? '' : (day.date?.match(/^([A-Za-z]+)/)?.[1] || '');
        const prevMonth = prevDay?.date?.match(/^([A-Za-z]+)/)?.[1] || '';
        const showMonth = !isFlexible && (!prevDay || shortMonth !== prevMonth);

        return (
          <div
            key={day.dayNumber}
            className="flex-shrink-0 day-grid-col"
            style={{
              width: colWidth,
              background: currentDay === day.dayNumber ? '#fbf8f7' : 'white',
              transition: 'background 150ms ease',
              position: 'relative',
            }}
          >
            {/* ── Day context menu ── */}
            <div
              ref={menuDayNumber === day.dayNumber ? dayMenuRef : undefined}
              style={{ position: 'absolute', top: 2, right: 2, zIndex: menuDayNumber === day.dayNumber ? 50 : 10 }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDayNumber(prev => prev === day.dayNumber ? null : day.dayNumber);
                }}
                className="flex items-center justify-center cursor-pointer day-col-menu-btn"
                style={{
                  width: 26,
                  height: 22,
                  background: menuDayNumber === day.dayNumber ? 'white' : 'rgba(255,255,255,0.85)',
                  border: '1px solid var(--t-linen)',
                  borderRadius: 6,
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  fontWeight: 700,
                  color: TEXT.primary,
                  lineHeight: 1,
                  padding: 0,
                  letterSpacing: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  opacity: 0,
                }}
                title="Day options"
                aria-label="Day options"
              >
                ⋯
              </button>
              {menuDayNumber === day.dayNumber && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4 }}>
                  <DayContextMenu
                    dayNumber={day.dayNumber}
                    dayCount={trip.days.length}
                    onAddBefore={() => insertDay('before', day.dayNumber)}
                    onAddAfter={() => insertDay('after', day.dayNumber)}
                    onDuplicate={() => duplicateDay(day.dayNumber)}
                    onClear={() => clearDay(day.dayNumber)}
                    onDelete={() => { setMenuDayNumber(null); setDeleteDayConfirm(day.dayNumber); }}
                    onClose={() => setMenuDayNumber(null)}
                    currentDestination={day.destination}
                    uniqueDestinations={uniqueDestinations}
                    getDestColor={generateDestColor}
                    onChangeDestination={(dest) => setDayDestination(day.dayNumber, dest)}
                  />
                </div>
              )}
            </div>

            {/* ── Column header: day title ── */}
            <div
              className="px-2.5 flex items-center justify-between cursor-pointer gap-2"
              onClick={() => setCurrentDay(day.dayNumber)}
              style={{
                height: HEADER_H,
                background: destColor.bg,
                borderBottom: currentDay === day.dayNumber
                  ? `2px solid var(--t-dark-teal)`
                  : `2px solid ${destColor.accent}30`,
                borderRight: '1px solid var(--t-linen)',
                transition: 'border-color 150ms ease',
              }}
            >
              <div className="flex items-baseline gap-1.5 min-w-0">
                {showMonth && (
                  <span style={{
                    fontFamily: FONT.mono,
                    fontSize: 8,
                    fontWeight: 600,
                    color: destColor.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    opacity: 0.6,
                    flexShrink: 0,
                  }}>
                    {shortMonth}
                  </span>
                )}
                <span style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 700, color: destColor.text, flexShrink: 0 }}>
                  {isFlexible ? `Day ${dateNum}` : `${shortDay} ${dateNum}`}
                </span>
                <span style={{
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  fontWeight: 500,
                  color: destColor.accent,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {day.destination || 'TBD'}
                </span>
              </div>
            </div>

            {/* ── Column header: context bar (hotel, transport, directions) ── */}
            <div
              className="flex items-center justify-between px-2.5"
              style={{
                height: CONTEXT_BAR_H,
                background: destColor.bg,
                borderBottom: `1px solid ${destColor.accent}18`,
                borderRight: '1px solid var(--t-linen)',
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {editingHotelDay === day.dayNumber ? (
                  <div style={{ maxWidth: 200, minWidth: 160 }} onClick={(e) => e.stopPropagation()}>
                    <HotelInput
                      value={day.hotelInfo}
                      legacyValue={day.hotel}
                      onSave={(h) => handleHotelSave(day.dayNumber, h)}
                      onCancel={() => setEditingHotelDay(null)}
                      accentColor={destColor.accent}
                      textColor={destColor.text}
                      destination={day.destination}
                    />
                  </div>
                ) : (day.hotelInfo || day.hotel) ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingHotelDay(day.dayNumber); }}
                    className="flex items-center gap-1 min-w-0"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden' }}
                  >
                    <span className="flex items-center gap-1" style={{
                      fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, color: destColor.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      <PerriandIcon name="hotel" size={10} color={destColor.text} />
                      {day.hotelInfo?.name || day.hotel}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingHotelDay(day.dayNumber); }}
                    className="flex items-center gap-1"
                    style={{
                      fontFamily: FONT.sans, fontSize: 10, fontWeight: 500,
                      color: `${destColor.accent}cc`, whiteSpace: 'nowrap',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <PerriandIcon name="hotel" size={10} color={`${destColor.accent}cc`} />
                    + Hotel
                  </button>
                )}

                {!editingHotelDay && <span style={{ color: INK['15'], fontSize: 9 }}>·</span>}

                {addingTransportDay !== day.dayNumber && !editingHotelDay && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingTransportDay(day.dayNumber); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      fontFamily: FONT.sans, fontSize: 9, fontWeight: 600,
                      color: destColor.text, whiteSpace: 'nowrap',
                      background: `${destColor.accent}18`, border: 'none', cursor: 'pointer',
                    }}
                  >
                    <PerriandIcon name="transport" size={10} color={destColor.accent} />
                    + Transport
                  </button>
                )}
              </div>

              {/* Directions button */}
              {(() => {
                const placedItems = day.slots.flatMap(s => s.places);
                if (placedItems.length < 2) return null;
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const waypoints = placedItems.map(p => {
                        const g = p.google as Record<string, unknown> & { lat?: number; lng?: number } | undefined;
                        if (g?.lat && g?.lng) return `${g.lat},${g.lng}`;
                        return encodeURIComponent(`${p.name} ${p.location}`);
                      });
                      window.open(`https://www.google.com/maps/dir/${waypoints.join('/')}`, '_blank');
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: `${destColor.accent}12`, color: destColor.accent,
                      border: 'none', cursor: 'pointer',
                      fontFamily: FONT.sans, fontSize: 9, fontWeight: 600,
                    }}
                  >
                    <PerriandIcon name="discover" size={10} color={destColor.accent} />
                    Directions
                  </button>
                );
              })()}
            </div>

            {/* Transport input form (below context bar) */}
            {addingTransportDay === day.dayNumber && (
              <div className="px-2 py-1.5" style={{ background: destColor.bg, borderBottom: '1px solid var(--t-linen)' }} onClick={e => e.stopPropagation()}>
                <TransportInput
                  onSave={(t) => {
                    addTransport(day.dayNumber, t);
                    setAddingTransportDay(null);
                  }}
                  onCancel={() => setAddingTransportDay(null)}
                  fromDefault={day.destination}
                  compact
                />
              </div>
            )}

            {/* ── Grid rows ── */}
            {rows.map((row) => {
              if (row.type === 'transport') {
                // Transport row — show banners for this day at this boundary
                const isEarlyDeparture = row.afterSlot === '__before__';
                const dayTransports = isEarlyDeparture
                  ? getTransportsBeforeSlots(day.transport)
                  : getTransportsAfterSlot(day.transport, row.afterSlot!);

                return (
                  <div
                    key={`t-${day.dayNumber}-${row.afterSlot}`}
                    style={{
                      height: row.height,
                      borderBottom: '1px solid var(--t-linen)',
                      borderRight: '1px solid var(--t-linen)',
                      background: 'rgba(0,0,0,0.015)',
                      overflow: 'hidden',
                    }}
                  >
                    {dayTransports.map(t => (
                      editingTransportId === t.id ? (
                        <div key={t.id} className="px-2 py-0.5" onClick={e => e.stopPropagation()}>
                          <TransportInput
                            initial={t}
                            onSave={(updates) => { updateTransport(day.dayNumber, t.id, updates); setEditingTransportId(null); }}
                            onCancel={() => setEditingTransportId(null)}
                            fromDefault={day.destination}
                            compact
                          />
                        </div>
                      ) : (
                        <TransportBanner
                          key={t.id}
                          transport={t}
                          onEdit={() => setEditingTransportId(t.id)}
                          onRemove={() => removeTransport(day.dayNumber, t.id)}
                          compact
                        />
                      )
                    ))}
                  </div>
                );
              }

              // Slot row — render GridCell
              const slotId = row.slotId!;
              const slot = day.slots.find(s => s.id === slotId);
              if (!slot) return <div key={`s-${day.dayNumber}-${slotId}`} style={{ height: row.height }} />;

              return (
                <GridCell
                  key={`s-${day.dayNumber}-${slotId}`}
                  dayNumber={day.dayNumber}
                  slot={slot}
                  rowHeight={row.height}
                  colWidth={colWidth}
                  isDesktop={isDesktop}
                  onOpenOverlay={handleOpenOverlay}
                />
              );
            })}
          </div>
        );
      })}

      {/* ── Slot overlay ── */}
      {overlayState && (() => {
        const day = trip.days.find(d => d.dayNumber === overlayState.dayNumber);
        const slot = day?.slots.find(s => s.id === overlayState.slotId);
        if (!day || !slot) return null;
        return (
          <SlotOverlay
            dayNumber={overlayState.dayNumber}
            slot={slot}
            anchorRect={overlayState.anchorRect}
            colWidth={colWidth}
            onClose={handleCloseOverlay}
          />
        );
      })()}

      {/* ── Delete day confirmation dialog ── */}
      {deleteDayConfirm !== null && (() => {
        const dayToRemove = trip.days.find(d => d.dayNumber === deleteDayConfirm);
        if (!dayToRemove) return null;
        const placedCount = dayToRemove.slots.flatMap(s => s.places).length;
        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDeleteDayConfirm(null)}
          >
            <div
              className="rounded-2xl p-6 mx-6"
              style={{ background: 'white', maxWidth: 340, width: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: FONT.serif, fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: TEXT.primary }}>
                Remove {dayToRemove.dayOfWeek ? `${dayToRemove.dayOfWeek}` : `Day ${deleteDayConfirm}`}?
              </h3>
              <p style={{ fontFamily: FONT.sans, fontSize: 13, color: TEXT.primary, margin: '0 0 20px', lineHeight: 1.5 }}>
                {dayToRemove.destination && <>{dayToRemove.destination} · </>}
                {placedCount > 0
                  ? 'Placed items will return to your unsorted pool.'
                  : 'This day has no placed items.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteDayConfirm(null)}
                  className="flex-1 py-2.5 rounded-lg cursor-pointer"
                  style={{
                    fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
                    background: INK['04'], color: TEXT.primary, border: 'none',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const dn = deleteDayConfirm;
                    setDeleteDayConfirm(null);
                    deleteDay(dn);
                  }}
                  className="flex-1 py-2.5 rounded-lg cursor-pointer"
                  style={{
                    fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
                    background: '#c0392b', color: 'white', border: 'none',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default React.memo(DayPlannerGrid);
