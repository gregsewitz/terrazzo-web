'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType, HotelInfo, TransportEvent } from '@/types';
import { generateDestColor } from '@/lib/destination-helpers';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import CollaboratorGhostCard from './CollaboratorGhostCard';
import HotelInput from './HotelInput';
import DayContextMenu from './DayContextMenu';
import { TransportBanner, TransportInput, getTransportsAfterSlot, getTransportsBeforeSlots } from './TransportBanner';
import { useDragGesture } from '@/hooks/useDragGesture';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import PlaceTimeEditor from './PlaceTimeEditor';
import QuickEntryCard from './QuickEntryCard';
import QuickEntryInput from './QuickEntryInput';
import type { QuickEntry } from '@/types';
import type { Suggestion, Reaction } from '@/stores/collaborationStore';

interface DayBoardViewProps {
  onTapDetail: (item: ImportedPlace) => void;
  suggestions?: Suggestion[];
  reactions?: Reaction[];
  myRole?: 'owner' | 'suggester' | 'viewer' | null;
  onRespondSuggestion?: (suggestionId: string, status: 'accepted' | 'rejected') => void;
  onAddReaction?: (placeKey: string, reaction: 'love' | 'not_for_me') => void;
  /** Pointer-based: register each slot's bounding rect for hit-testing */
  onRegisterSlotRef: (dayNumber: number, slotId: string, rect: DOMRect | null) => void;
  /** Pointer-based: drag a placed card out of a slot */
  onDragStartFromSlot: (item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => void;
  /** Which slot the drag pointer is currently over (from parent hit-testing) */
  dropTarget: { dayNumber: number; slotId: string } | null;
  /** ID of item currently being dragged (to dim it) */
  dragItemId: string | null;
}

/**
 * Inner component for a single placed card — uses useDragGesture for pointer-based drag.
 */
function PlacedCard({
  place, dayNumber, slotId, isDesktop, onTapDetail, onDragStartFromSlot, dragItemId,
  reactions, CARD_H, CARD_PX,
}: {
  place: ImportedPlace;
  dayNumber: number;
  slotId: string;
  isDesktop: boolean;
  onTapDetail: (item: ImportedPlace) => void;
  onDragStartFromSlot: (item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => void;
  dragItemId: string | null;
  reactions?: Reaction[];
  CARD_H: number;
  CARD_PX: number;
}) {
  const unplaceFromSlot = useTripStore(s => s.unplaceFromSlot);
  const setPlaceTime = useTripStore(s => s.setPlaceTime);
  const handleDragActivate = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    onDragStartFromSlot(item, dayNumber, slotId, e);
  }, [onDragStartFromSlot, dayNumber, slotId]);

  const { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, holdingId } = useDragGesture({
    onDragActivate: handleDragActivate,
    onTap: onTapDetail,
    layout: 'vertical',
    isDragging: !!dragItemId,
  });

  const srcStyle = SOURCE_STYLES[(place.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
  const context = place.friendAttribution?.note
    ? `"${place.friendAttribution.note}" — ${place.friendAttribution.name || 'Friend'}`
    : place.whatToOrder?.[0]
      ? `Order: ${place.whatToOrder[0]}`
      : place.tips?.[0] || place.terrazzoReasoning?.rationale || place.tasteNote || '';
  const placeKey = `${dayNumber}-${slotId}-${place.name}`;
  const placeReactions = reactions?.filter(r => r.placeKey === placeKey) || [];
  const loves = placeReactions.filter(r => r.reaction === 'love').length;
  const nopes = placeReactions.filter(r => r.reaction === 'not_for_me').length;
  const isBeingDragged = dragItemId === place.id;
  const isHolding = holdingId === place.id;

  return (
    <div
      onPointerDown={(e) => handlePointerDown(place, e)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`group/card mx-${CARD_PX} mb-1.5 rounded card-hover relative`}
      style={{
        minHeight: CARD_H,
        background: isHolding ? 'rgba(42,122,86,0.08)' : 'rgba(42,122,86,0.03)',
        border: isHolding ? '1.5px solid rgba(42,122,86,0.3)' : '1px solid rgba(42,122,86,0.1)',
        padding: isDesktop ? '6px 10px' : '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: isBeingDragged ? 0.3 : 1,
        transform: isHolding ? 'scale(1.02)' : 'none',
        transition: 'opacity 150ms, transform 100ms, background 100ms, border 100ms',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Row 1: name + type + match% */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-semibold truncate flex-1" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans, fontSize: isDesktop ? 12 : 11, lineHeight: 1.2 }}>
          {place.name}
        </span>
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: INK['60'], textTransform: 'uppercase' }}>
          {place.type}
        </span>
        {place.matchScore >= 70 && (
          <span className="flex-shrink-0 px-1 rounded" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, fontWeight: 700, background: 'rgba(42,122,86,0.1)', color: 'var(--t-verde)' }}>
            {place.matchScore}%
          </span>
        )}
        {/* Remove button — returns place to pick pool */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            unplaceFromSlot(dayNumber, slotId, place.id);
          }}
          className="flex-shrink-0 w-5 h-5 rounded-full items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
          style={{
            background: INK['08'],
            border: 'none',
            cursor: 'pointer',
            display: isDesktop ? 'flex' : 'flex',
          }}
          aria-label="Remove place"
        >
          <PerriandIcon name="close" size={8} color={INK['55']} />
        </button>
      </div>
      {/* Row 2: time editor (shared format with mobile) */}
      <div style={{ marginTop: 2 }}>
        <PlaceTimeEditor
          specificTime={place.specificTime}
          specificTimeLabel={place.specificTimeLabel}
          placeType={place.type}
          slotId={slotId}
          onSave={(time, label) => setPlaceTime(dayNumber, slotId, place.id, time, label)}
          compact
        />
      </div>
      {/* Row 3: context + reactions + source badge */}
      {(context || loves > 0 || nopes > 0) && (
        <div className="flex items-center gap-1.5 min-w-0" style={{ marginTop: 1 }}>
          {context && (
            <span className="truncate flex-1" style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 10 : 9, color: INK['60'], fontStyle: 'italic' }}>
              {context}
            </span>
          )}
          {loves > 0 && (
            <span className="flex-shrink-0 flex items-center gap-0.5" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: '#c93c3c' }}>
              ♥ {loves}
            </span>
          )}
          {nopes > 0 && (
            <span className="flex-shrink-0 flex items-center gap-0.5" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: INK['55'] }}>
              ✗ {nopes}
            </span>
          )}
          <span className="flex-shrink-0 px-1.5 py-px rounded font-bold" style={{ background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono, fontSize: isDesktop ? 8 : 7 }}>
            {srcStyle.label}
          </span>
        </div>
      )}
    </div>
  );
}

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
        background: isDropActive ? 'rgba(42,122,86,0.06)' : undefined,
        borderLeft: isDropActive ? '3px solid var(--t-verde)' : '3px solid transparent',
        transition: 'all 150ms ease',
        minHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function DayBoardView({
  onTapDetail,
  suggestions,
  reactions,
  myRole,
  onRespondSuggestion,
  onAddReaction,
  onRegisterSlotRef,
  onDragStartFromSlot,
  dropTarget,
  dragItemId,
}: DayBoardViewProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const setDayHotelInfo = useTripStore(s => s.setDayHotelInfo);
  const setMultipleDaysHotelInfo = useTripStore(s => s.setMultipleDaysHotelInfo);
  const addTransport = useTripStore(s => s.addTransport);
  const removeTransport = useTripStore(s => s.removeTransport);
  const updateTransport = useTripStore(s => s.updateTransport);
  const reorderDays = useTripStore(s => s.reorderDays);
  const deleteDay = useTripStore(s => s.deleteDay);
  const insertDay = useTripStore(s => s.insertDay);
  const duplicateDay = useTripStore(s => s.duplicateDay);
  const clearDay = useTripStore(s => s.clearDay);
  const setDayDestination = useTripStore(s => s.setDayDestination);
  const unplaceFromSlot = useTripStore(s => s.unplaceFromSlot);
  const addQuickEntry = useTripStore(s => s.addQuickEntry);
  const removeQuickEntry = useTripStore(s => s.removeQuickEntry);
  const confirmQuickEntry = useTripStore(s => s.confirmQuickEntry);
  const updateQuickEntry = useTripStore(s => s.updateQuickEntry);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const isDesktop = useIsDesktop();
  // Track which slot currently has the quick entry input open — "dayNumber-slotId"
  const [activeQuickInput, setActiveQuickInput] = useState<string | null>(null);
  // Track which quick entry is being edited — "dayNumber-slotId-entryId"
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);
  const [editingHotelDay, setEditingHotelDay] = useState<number | null>(null);
  const [addingTransportDay, setAddingTransportDay] = useState<number | null>(null);
  const [editingTransportId, setEditingTransportId] = useState<string | null>(null);
  // Track last-added transport to scroll it into view
  const [lastAddedTransportId, setLastAddedTransportId] = useState<string | null>(null);
  const [deleteDayConfirm, setDeleteDayConfirm] = useState<number | null>(null);
  const [menuDayNumber, setMenuDayNumber] = useState<number | null>(null);
  const dayMenuRef = useRef<HTMLDivElement>(null);

  // Scroll the newly added transport into view
  useEffect(() => {
    if (!lastAddedTransportId) return;
    // lastAddedTransportId holds the afterSlot id — find the transport banner by data attribute
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-transport-slot="${lastAddedTransportId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Brief highlight flash
        (el as HTMLElement).style.transition = 'background 300ms ease';
        (el as HTMLElement).style.background = 'rgba(42,122,86,0.12)';
        setTimeout(() => { (el as HTMLElement).style.background = ''; }, 1500);
      }
    });
  }, [lastAddedTransportId]);

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

  if (!trip) return null;

  // Unique destinations for picker (preserve order of first appearance)
  const uniqueDestinations = useMemo(() => {
    const seen = new Set<string>();
    return trip.days
      .map(d => d.destination || '')
      .filter(d => d && !seen.has(d) && seen.add(d));
  }, [trip.days]);

  const getDestColor = useCallback((dest: string) => {
    return DEST_COLORS[dest] || generateDestColor(dest);
  }, []);

  // Desktop sizing
  const COL_WIDTH = isDesktop ? 280 : 240;
  const SLOT_LABEL_H = isDesktop ? 32 : 26;
  const SLOT_LABEL_SIZE = isDesktop ? 10 : 9;
  const SLOT_ICON_SIZE = isDesktop ? 14 : 12;
  const DAY_TITLE_SIZE = isDesktop ? 14 : 13;
  const DAY_DEST_SIZE = isDesktop ? 11 : 10;
  const CARD_PX = isDesktop ? 3 : 2;
  const CARD_H = isDesktop ? 50 : 42;
  const MIN_SLOT_H = SLOT_LABEL_H + CARD_H + 6;

  return (
    <div
      className="flex gap-0 overflow-x-auto"
      style={{
        scrollbarWidth: 'thin',
        minHeight: 0,
        height: '100%',
      }}
    >
      <style>{`.day-col:hover .day-col-menu-btn { opacity: 0.5 !important; } .day-col-menu-btn:hover { opacity: 0.9 !important; }`}</style>
      {trip.days.map(day => {
        if (day.transport?.length) console.log('[DayBoard] Day', day.dayNumber, 'has', day.transport.length, 'transports:', day.transport.map(t => `${t.id} ${t.mode} afterSlot=${t.afterSlot}`));
        const destColor = DEST_COLORS[day.destination || ''] || generateDestColor(day.destination || '');
        const isFlexible = trip.flexibleDates === true;
        const shortDay = isFlexible ? '' : (day.dayOfWeek?.slice(0, 3) || '');
        const dateNum = isFlexible ? day.dayNumber : (day.date?.replace(/\D/g, ' ').trim().split(' ').pop() || day.dayNumber);
        const shortMonth = isFlexible ? '' : (day.date?.match(/^([A-Za-z]+)/)?.[1] || '');
        const dayIdx = trip.days.indexOf(day);
        const prevDay = dayIdx > 0 ? trip.days[dayIdx - 1] : null;
        const prevMonth = prevDay?.date?.match(/^([A-Za-z]+)/)?.[1] || '';
        const showMonth = !isFlexible && (!prevDay || shortMonth !== prevMonth);

        return (
          <div
            key={day.dayNumber}
            className="flex flex-col flex-shrink-0 day-col"
            style={{
              width: COL_WIDTH,
              position: 'relative',
              borderRight: '1px solid var(--t-linen)',
              background: currentDay === day.dayNumber ? 'rgba(42,122,86,0.02)' : 'white',
              transition: 'background 150ms ease',
            }}
          >
            {/* Day context menu — ⋯ button, top-right corner, visible on column hover */}
            <div
              ref={menuDayNumber === day.dayNumber ? dayMenuRef : undefined}
              style={{ position: 'absolute', top: 2, right: 2, zIndex: menuDayNumber === day.dayNumber ? 50 : 10 }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDayNumber(prev => prev === day.dayNumber ? null : day.dayNumber);
                }}
                className="flex items-center justify-center cursor-pointer"
                style={{
                  width: 26,
                  height: 22,
                  background: menuDayNumber === day.dayNumber ? 'white' : 'rgba(255,255,255,0.85)',
                  border: '1px solid var(--t-linen)',
                  borderRadius: 6,
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  fontWeight: 700,
                  color: INK['70'],
                  lineHeight: 1,
                  padding: 0,
                  letterSpacing: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
                title="Day options"
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
                    getDestColor={getDestColor}
                    onChangeDestination={(dest) => setDayDestination(day.dayNumber, dest)}
                  />
                </div>
              )}
            </div>
            {/* Day column header — compact single row */}
            <div
              className="px-2.5 flex items-center justify-between cursor-pointer gap-2"
              onClick={() => setCurrentDay(day.dayNumber)}
              style={{
                paddingTop: 6,
                paddingBottom: 6,
                background: destColor.bg,
                borderBottom: currentDay === day.dayNumber
                  ? `2px solid var(--t-verde)`
                  : `2px solid ${destColor.accent}30`,
                transition: 'border-color 150ms ease',
              }}
            >
              <div className="flex items-baseline gap-1.5 min-w-0">
                {showMonth && !isFlexible && (
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
                <span style={{ fontFamily: FONT.sans, fontSize: DAY_TITLE_SIZE, fontWeight: 700, color: destColor.text, flexShrink: 0 }}>
                  {isFlexible ? `Day ${dateNum}` : `${shortDay} ${dateNum}`}
                </span>
                <span style={{
                  fontFamily: FONT.sans,
                  fontSize: DAY_DEST_SIZE,
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

            {/* Context bar — hotel, transport, directions (like mobile) */}
            <div
              className="flex items-center justify-between px-2.5 py-1"
              style={{
                background: destColor.bg,
                borderBottom: `1px solid ${destColor.accent}18`,
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
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <span className="flex items-center gap-1" style={{
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 600,
                      color: destColor.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
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
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 500,
                      color: `${destColor.accent}cc`,
                      whiteSpace: 'nowrap',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <PerriandIcon name="hotel" size={10} color={`${destColor.accent}cc`} />
                    + Hotel
                  </button>
                )}

                {!editingHotelDay && (
                  <span style={{ color: INK['15'], fontSize: 9 }}>·</span>
                )}

                {/* + Transport button */}
                {addingTransportDay !== day.dayNumber && !editingHotelDay && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingTransportDay(day.dayNumber); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 9,
                      fontWeight: 600,
                      color: destColor.text,
                      whiteSpace: 'nowrap',
                      background: `${destColor.accent}18`,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <PerriandIcon name="transport" size={10} color={destColor.accent} />
                    + Transport
                  </button>
                )}
              </div>

              {/* Directions button (only when 2+ placed items) */}
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
                      background: `${destColor.accent}12`,
                      color: destColor.accent,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    <PerriandIcon name="discover" size={10} color={destColor.accent} />
                    Directions
                  </button>
                );
              })()}
            </div>

            {/* Transport input form (new transport) — expands below context bar */}
            {addingTransportDay === day.dayNumber && (
              <div className="px-2 py-1.5" style={{ background: `${destColor.bg}`, borderBottom: '1px solid var(--t-linen)' }} onClick={e => e.stopPropagation()}>
                <TransportInput
                  onSave={(t) => {
                    addTransport(day.dayNumber, t);
                    setAddingTransportDay(null);
                    // Track the afterSlot so we can scroll it into view
                    if (t.afterSlot) {
                      setLastAddedTransportId(t.afterSlot);
                      // Clear after a short delay
                      setTimeout(() => setLastAddedTransportId(null), 2000);
                    }
                  }}
                  onCancel={() => setAddingTransportDay(null)}
                  fromDefault={day.destination}
                  compact
                />
              </div>
            )}

            {/* Early departures — transports before the first slot */}
            {getTransportsBeforeSlots(day.transport).map(t => (
              editingTransportId === t.id ? (
                <div key={t.id} className="px-2 py-1" onClick={e => e.stopPropagation()}>
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

            {/* Scrollable slot list with inter-slot transport banners */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {day.slots.map(slot => {
                const icon = SLOT_ICONS[slot.id] || 'pin';
                const hasPlaces = slot.places.length > 0;
                const hasGhosts = slot.ghostItems && slot.ghostItems.length > 0;
                const slotSuggestions = suggestions?.filter(
                  s => s.targetDay === day.dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
                ) || [];
                // Notes module removed — collaboration mode not yet implemented

                const isDropActive = dropTarget?.dayNumber === day.dayNumber && dropTarget?.slotId === slot.id;

                return (
                  <SlotContainer
                    key={slot.id}
                    dayNumber={day.dayNumber}
                    slotId={slot.id}
                    onRegisterSlotRef={onRegisterSlotRef}
                    isDropActive={isDropActive}
                    minHeight={MIN_SLOT_H}
                  >
                    {/* Slot label */}
                    <div
                      className="flex items-center gap-1.5"
                      style={{ height: SLOT_LABEL_H, paddingLeft: isDesktop ? 12 : 10, paddingRight: isDesktop ? 12 : 10 }}
                    >
                      <PerriandIcon name={icon as any} size={SLOT_ICON_SIZE} color={INK['60']} />
                      <span style={{
                        fontFamily: FONT.mono,
                        fontSize: SLOT_LABEL_SIZE,
                        color: INK['50'],
                        textTransform: 'uppercase',
                        letterSpacing: 0.8,
                        fontWeight: isDesktop ? 600 : 400,
                      }}>
                        {slot.label}
                      </span>
                      {/* time removed from slot headers */}
                    </div>

                    {/* Placed items — pointer-based drag cards */}
                    {slot.places.map(p => (
                      <PlacedCard
                        key={p.id}
                        place={p}
                        dayNumber={day.dayNumber}
                        slotId={slot.id}
                        isDesktop={isDesktop}
                        onTapDetail={onTapDetail}
                        onDragStartFromSlot={onDragStartFromSlot}
                        dragItemId={dragItemId}
                        reactions={reactions}
                        CARD_H={CARD_H}
                        CARD_PX={CARD_PX}
                      />
                    ))}

                    {/* Ghost items — same two-row height, dashed border */}
                    {hasGhosts && !hasPlaces && slot.ghostItems!.map(ghost => {
                      const gSrc = SOURCE_STYLES[(ghost.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
                      const gNote = ghost.friendAttribution?.note
                        ? `"${ghost.friendAttribution.note}"`
                        : ghost.terrazzoReasoning?.rationale || ghost.savedAt || '';

                      return (
                        <div
                          key={ghost.id}
                          onClick={() => onTapDetail(ghost)}
                          className={`mx-${CARD_PX} mb-1.5 rounded cursor-pointer ghost-shimmer relative`}
                          style={{
                            height: CARD_H,
                            background: 'var(--t-cream)',
                            border: `1.5px dashed ${gSrc.color}`,
                            padding: isDesktop ? '6px 10px' : '4px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Row 1: name + type + Add / × */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold truncate flex-1" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans, fontSize: isDesktop ? 12 : 11, lineHeight: 1.2 }}>
                              {ghost.name}
                            </span>
                            <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: INK['60'], textTransform: 'uppercase' }}>
                              {ghost.type}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); confirmGhost(day.dayNumber, slot.id, ghost.id); }}
                              className="flex-shrink-0 px-1.5 py-px rounded font-semibold btn-hover"
                              style={{ background: 'var(--t-verde)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: FONT.sans, fontSize: isDesktop ? 10 : 9 }}
                            >
                              Add
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissGhost(day.dayNumber, slot.id, ghost.id); }}
                              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center nav-hover"
                              style={{ background: INK['08'], border: 'none', cursor: 'pointer' }}
                            >
                              <PerriandIcon name="close" size={9} color={INK['70']} />
                            </button>
                          </div>
                          {/* Row 2: source label + note */}
                          <div className="flex items-center gap-1.5 min-w-0" style={{ marginTop: 2 }}>
                            <span className="flex-shrink-0 px-1.5 py-px rounded-full flex items-center gap-0.5 font-semibold" style={{ background: gSrc.bg, color: gSrc.color, fontSize: isDesktop ? 8 : 7 }}>
                              <PerriandIcon name={gSrc.icon} size={8} color={gSrc.color} />
                              {gSrc.label}
                            </span>
                            {gNote && (
                              <span className="truncate italic" style={{ color: INK['60'], fontSize: isDesktop ? 10 : 9 }}>
                                {gNote}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Quick entries */}
                    {slot.quickEntries && slot.quickEntries.length > 0 && (
                      <div className={`px-${CARD_PX} pb-0.5`}>
                        {slot.quickEntries.map(qe => {
                          const entryKey = `${day.dayNumber}-${slot.id}-${qe.id}`;
                          return editingEntryKey === entryKey ? (
                            <QuickEntryInput
                              key={qe.id}
                              slotLabel={slot.label}
                              initialValue={qe.text}
                              onSubmit={(updated) => {
                                updateQuickEntry(day.dayNumber, slot.id, qe.id, {
                                  ...updated,
                                  id: qe.id,
                                  createdAt: qe.createdAt,
                                });
                                setEditingEntryKey(null);
                              }}
                              onCancel={() => setEditingEntryKey(null)}
                            />
                          ) : (
                            <QuickEntryCard
                              key={qe.id}
                              entry={qe}
                              onRemove={() => removeQuickEntry(day.dayNumber, slot.id, qe.id)}
                              onConfirm={qe.status === 'tentative' ? () => confirmQuickEntry(day.dayNumber, slot.id, qe.id) : undefined}
                              onTap={() => setEditingEntryKey(entryKey)}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Collaborator suggestions */}
                    {slotSuggestions.length > 0 && (
                      <div className={`px-${CARD_PX} pb-1 flex flex-col gap-1`}>
                        {slotSuggestions.map(sg => (
                          <CollaboratorGhostCard
                            key={sg.id}
                            suggestion={sg}
                            isOwner={myRole === 'owner'}
                            onAccept={() => onRespondSuggestion?.(sg.id, 'accepted')}
                            onReject={() => onRespondSuggestion?.(sg.id, 'rejected')}
                          />
                        ))}
                      </div>
                    )}

                    {/* Empty slot placeholder — only when truly empty and no quick input */}
                    {!hasPlaces && !hasGhosts && !(slot.quickEntries?.length) && slotSuggestions.length === 0 && activeQuickInput !== `${day.dayNumber}-${slot.id}` && (
                      <div
                        onClick={() => setActiveQuickInput(`${day.dayNumber}-${slot.id}`)}
                        className={`mx-${CARD_PX} mb-1.5 rounded flex items-center justify-center cursor-pointer`}
                        style={{
                          height: CARD_H,
                          border: isDropActive ? '2px dashed var(--t-verde)' : '1px dashed var(--t-linen)',
                          background: isDropActive ? 'rgba(42,122,86,0.06)' : INK['02'],
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 11 : 10, color: INK['70'] }}>
                          + add entry
                        </span>
                      </div>
                    )}

                    {/* Inline quick entry input (desktop) */}
                    {activeQuickInput === `${day.dayNumber}-${slot.id}` && (
                      <div className={`px-${CARD_PX} mb-1.5`}>
                        <QuickEntryInput
                          slotLabel={slot.label}
                          onSubmit={(entry) => {
                            addQuickEntry(day.dayNumber, slot.id, entry);
                            setActiveQuickInput(null);
                          }}
                          onCancel={() => setActiveQuickInput(prev => prev === `${day.dayNumber}-${slot.id}` ? null : prev)}
                        />
                      </div>
                    )}

                    {/* Add entry / browse places buttons — always visible when content exists and input isn't active */}
                    {(hasPlaces || hasGhosts || (slot.quickEntries?.length ?? 0) > 0) && activeQuickInput !== `${day.dayNumber}-${slot.id}` && (
                      <div className={`px-${CARD_PX} pb-1.5 flex items-center gap-1.5`}>
                        <button
                          onClick={() => setActiveQuickInput(`${day.dayNumber}-${slot.id}`)}
                          className="text-[9px] cursor-pointer rounded flex items-center gap-0.5"
                          style={{
                            color: INK['80'],
                            fontFamily: FONT.sans,
                            fontWeight: 500,
                            background: INK['04'],
                            border: `1px solid ${INK['10']}`,
                            padding: '3px 6px',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            el.style.background = 'rgba(42,122,86,0.06)';
                            el.style.borderColor = 'rgba(42,122,86,0.2)';
                            el.style.color = 'var(--t-verde)';
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget;
                            el.style.background = INK['04'];
                            el.style.borderColor = INK['10'];
                            el.style.color = INK['80'];
                          }}
                        >
                          <span style={{ fontSize: 11, lineHeight: 1 }}>+</span> add entry
                        </button>
                      </div>
                    )}

                    {/* Transport banners positioned after this slot based on departure time */}
                    {getTransportsAfterSlot(day.transport, slot.id).map(t => (
                      editingTransportId === t.id ? (
                        <div key={t.id} className="px-2 py-1" onClick={e => e.stopPropagation()}>
                          <TransportInput
                            initial={t}
                            onSave={(updates) => { updateTransport(day.dayNumber, t.id, updates); setEditingTransportId(null); }}
                            onCancel={() => setEditingTransportId(null)}
                            fromDefault={day.destination}
                            compact
                          />
                        </div>
                      ) : (
                        <div key={t.id} data-transport-slot={slot.id}>
                          <TransportBanner
                            transport={t}
                            onEdit={() => setEditingTransportId(t.id)}
                            onRemove={() => removeTransport(day.dayNumber, t.id)}
                            compact
                          />
                        </div>
                      )
                    ))}
                  </SlotContainer>
                );
              })}
            </div>

          </div>
        );
      })}
      {/* Delete day confirmation dialog */}
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
              <h3 style={{ fontFamily: FONT.serif, fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: 'var(--t-ink)' }}>
                Remove {dayToRemove.dayOfWeek ? `${dayToRemove.dayOfWeek}` : `Day ${deleteDayConfirm}`}?
              </h3>
              <p style={{ fontFamily: FONT.sans, fontSize: 13, color: INK['70'], margin: '0 0 20px', lineHeight: 1.5 }}>
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
                    background: INK['04'], color: 'var(--t-ink)',
                    border: 'none',
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
                    background: '#c0392b', color: 'white',
                    border: 'none',
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

export default React.memo(DayBoardView);
