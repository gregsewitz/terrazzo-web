'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType, HotelInfo, TransportEvent } from '@/types';
import { generateDestColor } from '@/lib/destination-helpers';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import CollaboratorGhostCard from './CollaboratorGhostCard';
import SlotNoteBubble from './SlotNoteBubble';
import HotelInput from './HotelInput';
import DayContextMenu from './DayContextMenu';
import AddDestinationSearch from './AddDestinationSearch';
import { TransportBanner, TransportInput, getTransportsAfterSlot, getTransportsBeforeSlots } from './TransportBanner';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import type { Suggestion, Reaction, SlotNoteItem } from '@/stores/collaborationStore';

interface DayBoardViewProps {
  onTapDetail: (item: ImportedPlace) => void;
  suggestions?: Suggestion[];
  reactions?: Reaction[];
  slotNotes?: SlotNoteItem[];
  myRole?: 'owner' | 'suggester' | 'viewer' | null;
  onRespondSuggestion?: (suggestionId: string, status: 'accepted' | 'rejected') => void;
  onAddReaction?: (placeKey: string, reaction: 'love' | 'not_for_me') => void;
  onAddSlotNote?: (dayNumber: number, slotId: string, content: string) => void;
  onDropPlace?: (placeId: string, dayNumber: number, slotId: string) => void;
  onMovePlace?: (placeId: string, fromDay: number, fromSlot: string, toDay: number, toSlot: string) => void;
  onUnplace?: (placeId: string, dayNumber: number, slotId: string) => void;
  onDaySelect?: (dayNumber: number) => void;
  selectedDay?: number | null;
}

function DayBoardView({
  onTapDetail,
  suggestions,
  reactions,
  slotNotes,
  myRole,
  onRespondSuggestion,
  onAddReaction,
  onAddSlotNote,
  onDropPlace,
  onMovePlace,
  onUnplace,
  onDaySelect,
  selectedDay,
}: DayBoardViewProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
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
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const isDesktop = useIsDesktop();
  const [dropTarget, setDropTarget] = useState<string | null>(null); // "dayNum-slotId"
  const [editingHotelDay, setEditingHotelDay] = useState<number | null>(null);
  const [addingTransportDay, setAddingTransportDay] = useState<number | null>(null);
  const [editingTransportId, setEditingTransportId] = useState<string | null>(null);
  const [draggingDay, setDraggingDay] = useState<number | null>(null);
  const [dayDropTarget, setDayDropTarget] = useState<number | null>(null);
  const [destPickerDay, setDestPickerDay] = useState<number | null>(null);
  const [destPickerAddMode, setDestPickerAddMode] = useState(false);
  const [deleteDayConfirm, setDeleteDayConfirm] = useState<number | null>(null);
  const [menuDayNumber, setMenuDayNumber] = useState<number | null>(null);
  const destPickerRef = useRef<HTMLDivElement>(null);
  const dayMenuRef = useRef<HTMLDivElement>(null);

  // Close destination picker on click outside
  useEffect(() => {
    if (destPickerDay === null) return;
    const handler = (e: MouseEvent) => {
      if (destPickerRef.current && !destPickerRef.current.contains(e.target as Node)) {
        setDestPickerDay(null);
        setDestPickerAddMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [destPickerDay]);

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
  // Fixed card height shared by placed cards, ghost cards, and empty placeholders
  const CARD_H = isDesktop ? 50 : 42;
  // MIN_SLOT_H = slot label + card + margin so all slots align
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
            onDragOver={(e) => {
              // Accept day drops
              if (e.dataTransfer.types.includes('text/day-number')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dayDropTarget !== day.dayNumber) setDayDropTarget(day.dayNumber);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dayDropTarget === day.dayNumber) setDayDropTarget(null);
              }
            }}
            onDrop={(e) => {
              const fromDay = e.dataTransfer.getData('text/day-number');
              if (fromDay) {
                e.preventDefault();
                e.stopPropagation();
                reorderDays(Number(fromDay), day.dayNumber);
                setDayDropTarget(null);
                setDraggingDay(null);
              }
            }}
            style={{
              width: COL_WIDTH,
              position: 'relative',
              borderRight: '1px solid var(--t-linen)',
              background: dayDropTarget === day.dayNumber && draggingDay !== day.dayNumber
                ? 'rgba(42,122,86,0.06)'
                : selectedDay === day.dayNumber ? 'rgba(42,122,86,0.02)' : 'white',
              opacity: draggingDay === day.dayNumber ? 0.4 : 1,
              transition: 'background 150ms ease, opacity 150ms ease',
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
                className="day-col-menu-btn flex items-center justify-center cursor-pointer"
                style={{
                  width: 22,
                  height: 18,
                  background: `${destColor.accent}12`,
                  border: 'none',
                  borderRadius: 5,
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  fontWeight: 700,
                  color: destColor.accent,
                  opacity: menuDayNumber === day.dayNumber ? 0.9 : 0,
                  transition: 'opacity 150ms',
                  lineHeight: 1,
                  padding: 0,
                  letterSpacing: 1,
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
                  />
                </div>
              )}
            </div>
            {/* Day column header — draggable for reordering, click selects day */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/day-number', String(day.dayNumber));
                e.dataTransfer.effectAllowed = 'move';
                setDraggingDay(day.dayNumber);
              }}
              onDragEnd={() => { setDraggingDay(null); setDayDropTarget(null); }}
              className="px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
              onClick={() => onDaySelect?.(day.dayNumber)}
              style={{
                paddingTop: isDesktop ? 10 : 8,
                paddingBottom: isDesktop ? 10 : 8,
                background: destColor.bg,
                borderBottom: dayDropTarget === day.dayNumber && draggingDay !== day.dayNumber
                  ? `2px solid var(--t-verde)`
                  : selectedDay === day.dayNumber
                    ? `2px solid var(--t-verde)`
                    : `2px solid ${destColor.accent}30`,
                transition: 'border-color 150ms ease',
              }}
            >
              <div className="flex items-start gap-1.5">
                {/* Drag grip */}
                <div className="flex flex-col gap-px mt-1.5" style={{ opacity: 0.3 }}>
                  {[0, 1, 2].map(r => (
                    <div key={r} className="flex gap-px">
                      <div style={{ width: 2, height: 2, borderRadius: '50%', background: destColor.text }} />
                      <div style={{ width: 2, height: 2, borderRadius: '50%', background: destColor.text }} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    fontWeight: 600,
                    color: destColor.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    lineHeight: 1,
                    marginBottom: 2,
                    opacity: 0.7,
                    visibility: showMonth ? 'visible' : 'hidden',
                  }}>
                    {isFlexible ? '\u00A0' : (shortMonth || '\u00A0')}
                  </div>
                  <div style={{ fontFamily: FONT.sans, fontSize: DAY_TITLE_SIZE, fontWeight: 700, color: destColor.text }}>
                    {isFlexible ? `Day ${dateNum}` : `${shortDay} ${dateNum}`}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDestPickerDay(prev => prev === day.dayNumber ? null : day.dayNumber);
                        setDestPickerAddMode(false);
                      }}
                      style={{
                        fontFamily: FONT.sans,
                        fontSize: DAY_DEST_SIZE,
                        fontWeight: 500,
                        color: destColor.accent,
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        borderBottom: `1px dashed ${destColor.accent}60`,
                        padding: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {day.destination || 'TBD'}
                    </button>

                    {/* Destination picker popover */}
                    {destPickerDay === day.dayNumber && (
                      <div
                        ref={destPickerRef}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
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
                              const isCurrent = dest === day.destination;
                              const destC = getDestColor(dest);
                              return (
                                <button
                                  key={dest}
                                  onClick={() => {
                                    if (!isCurrent) setDayDestination(day.dayNumber, dest);
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
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {editingHotelDay === day.dayNumber ? (
                  <div style={{ maxWidth: 180, minWidth: 160 }} onClick={(e) => e.stopPropagation()}>
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
                    className="flex flex-col items-end gap-0 cursor-pointer"
                    style={{ maxWidth: 140, background: 'none', border: 'none', padding: 0 }}
                  >
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: `${destColor.accent}12` }}
                    >
                      <PerriandIcon name="hotel" size={10} color={destColor.accent} />
                      <span
                        className="truncate"
                        style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 10 : 9, color: destColor.text, fontWeight: 500 }}
                      >
                        {day.hotelInfo?.name || day.hotel}
                      </span>
                    </div>
                    {day.hotelInfo?.address && (
                      <span
                        className="truncate px-2"
                        style={{ fontFamily: FONT.sans, fontSize: 9, color: INK['55'], maxWidth: 140 }}
                      >
                        {day.hotelInfo.address}
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingHotelDay(day.dayNumber); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full cursor-pointer nav-hover"
                    style={{
                      background: 'none',
                      border: `1px dashed ${destColor.accent}40`,
                      fontFamily: FONT.sans,
                      fontSize: 9,
                      color: destColor.accent,
                      opacity: 0.7,
                    }}
                  >
                    <PerriandIcon name="hotel" size={10} color={destColor.accent} />
                    Add hotel
                  </button>
                )}
                {/* + Transport pill in header */}
                {addingTransportDay !== day.dayNumber && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingTransportDay(day.dayNumber); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer nav-hover"
                    style={{
                      background: `${destColor.accent}15`,
                      border: 'none',
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 600,
                      color: destColor.text,
                    }}
                  >
                    <PerriandIcon name="transport" size={11} color={destColor.accent} />
                    + Transportation
                  </button>
                )}
              </div>
            </div>

            {/* Transport input form (new transport) — expands below header */}
            {addingTransportDay === day.dayNumber && (
              <div className="px-2 py-1.5" style={{ background: `${destColor.bg}`, borderBottom: '1px solid var(--t-linen)' }} onClick={e => e.stopPropagation()}>
                <TransportInput
                  onSave={(t) => { addTransport(day.dayNumber, t); setAddingTransportDay(null); }}
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
                const slotNoteItems = slotNotes?.filter(n => n.dayNumber === day.dayNumber && n.slotId === slot.id) || [];

                const slotDropKey = `${day.dayNumber}-${slot.id}`;
                const isDropActive = dropTarget === slotDropKey;

                return (
                  <div
                    key={slot.id}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(slotDropKey); }}
                    onDragLeave={() => { if (dropTarget === slotDropKey) setDropTarget(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropTarget(null);
                      const placeId = e.dataTransfer.getData('text/place-id');
                      const fromDay = e.dataTransfer.getData('text/from-day');
                      const fromSlot = e.dataTransfer.getData('text/from-slot');
                      if (placeId && fromDay && fromSlot) {
                        onMovePlace?.(placeId, Number(fromDay), fromSlot, day.dayNumber, slot.id);
                      } else if (placeId) {
                        onDropPlace?.(placeId, day.dayNumber, slot.id);
                      }
                    }}
                    className="flex flex-col"
                    style={{
                      borderBottom: '1px solid var(--t-linen)',
                      background: isDropActive ? 'rgba(42,122,86,0.06)' : undefined,
                      borderLeft: isDropActive ? '3px solid var(--t-verde)' : '3px solid transparent',
                      transition: 'all 150ms ease',
                      minHeight: MIN_SLOT_H,
                    }}
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
                      {slot.time && (
                        <span style={{ fontFamily: FONT.mono, fontSize: SLOT_LABEL_SIZE, color: INK['50'] }}>
                          {slot.time}
                        </span>
                      )}
                    </div>

                    {/* Placed items — two-row compact cards */}
                    {slot.places.map(p => {
                      const srcStyle = SOURCE_STYLES[(p.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
                      // Best context line: friend note > whatToOrder > tips > AI rationale > tasteNote
                      const context = p.friendAttribution?.note
                        ? `"${p.friendAttribution.note}" — ${p.friendAttribution.name || 'Friend'}`
                        : p.whatToOrder?.[0]
                          ? `Order: ${p.whatToOrder[0]}`
                          : p.tips?.[0] || p.terrazzoReasoning?.rationale || p.tasteNote || '';
                      const placeKey = `${day.dayNumber}-${slot.id}-${p.name}`;
                      const placeReactions = reactions?.filter(r => r.placeKey === placeKey) || [];
                      const loves = placeReactions.filter(r => r.reaction === 'love').length;
                      const nopes = placeReactions.filter(r => r.reaction === 'not_for_me').length;

                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/place-id', p.id);
                            e.dataTransfer.setData('text/from-day', String(day.dayNumber));
                            e.dataTransfer.setData('text/from-slot', slot.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => onTapDetail(p)}
                          className={`group/card mx-${CARD_PX} mb-1.5 rounded cursor-grab card-hover relative`}
                          style={{
                            height: CARD_H,
                            background: 'rgba(42,122,86,0.03)',
                            border: '1px solid rgba(42,122,86,0.1)',
                            padding: isDesktop ? '6px 10px' : '4px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {/* × unplace — hover */}
                          {onUnplace && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onUnplace(p.id, day.dayNumber, slot.id); }}
                              className="absolute opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center nav-hover"
                              style={{ top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', zIndex: 2 }}
                              title="Remove from slot"
                            >
                              <PerriandIcon name="close" size={9} color={INK['50']} />
                            </button>
                          )}
                          {/* Row 1: name + type + match% */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold truncate flex-1" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans, fontSize: isDesktop ? 12 : 11, lineHeight: 1.2 }}>
                              {p.name}
                            </span>
                            <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: INK['60'], textTransform: 'uppercase' }}>
                              {p.type}
                            </span>
                            {p.matchScore >= 70 && (
                              <span className="flex-shrink-0 px-1 rounded" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, fontWeight: 700, background: 'rgba(42,122,86,0.1)', color: 'var(--t-verde)' }}>
                                {p.matchScore}%
                              </span>
                            )}
                          </div>
                          {/* Row 2: context + reactions + source badge */}
                          <div className="flex items-center gap-1.5 min-w-0" style={{ marginTop: 2 }}>
                            <span className="truncate flex-1" style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 10 : 9, color: INK['60'], fontStyle: context ? 'italic' : 'normal' }}>
                              {context || p.type}
                            </span>
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
                        </div>
                      );
                    })}

                    {/* Ghost items — same two-row height, dashed border */}
                    {hasGhosts && !hasPlaces && slot.ghostItems!.map(ghost => {
                      const gSrc = SOURCE_STYLES[(ghost.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
                      const gNote = ghost.friendAttribution?.note
                        ? `"${ghost.friendAttribution.note}"`
                        : ghost.terrazzoReasoning?.rationale || ghost.savedDate || '';

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

                    {/* Slot notes */}
                    {((slotNoteItems.length > 0) || (myRole === 'suggester' || myRole === 'owner')) && (
                      <div className={`px-${CARD_PX} pb-1.5`}>
                        <SlotNoteBubble
                          notes={slotNoteItems}
                          canAdd={myRole === 'suggester' || myRole === 'owner'}
                          onAddNote={onAddSlotNote ? (content: string) => onAddSlotNote(day.dayNumber, slot.id, content) : undefined}
                        />
                      </div>
                    )}

                    {/* Empty slot — same height as card rows */}
                    {!hasPlaces && !hasGhosts && slotSuggestions.length === 0 && (
                      <div
                        className={`mx-${CARD_PX} mb-1.5 rounded flex items-center justify-center`}
                        style={{
                          height: CARD_H,
                          border: isDropActive ? '2px dashed var(--t-verde)' : '1px dashed var(--t-linen)',
                          background: isDropActive ? 'rgba(42,122,86,0.06)' : INK['02'],
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 11 : 10, color: INK['45'] }}>
                          + add
                        </span>
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
