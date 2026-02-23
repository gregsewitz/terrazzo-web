'use client';

import { useMemo, useCallback, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import GhostCard from './GhostCard';
import CollaboratorGhostCard from './CollaboratorGhostCard';
import ReactionPills from './ReactionPills';
import SlotNoteBubble from './SlotNoteBubble';
import { TransportBanner, getTransportsAfterSlot, getTransportsBeforeSlots } from './TransportBanner';
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

export default function DayBoardView({
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
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const isDesktop = useIsDesktop();
  const [dropTarget, setDropTarget] = useState<string | null>(null); // "dayNum-slotId"

  if (!trip) return null;

  // Desktop sizing
  const COL_WIDTH = isDesktop ? 280 : 240;
  const SLOT_LABEL_H = isDesktop ? 32 : 26;
  const EMPTY_SLOT_H = isDesktop ? 40 : 32;
  const PLACE_NAME_SIZE = isDesktop ? 13 : 11;
  const SUBTITLE_SIZE = isDesktop ? 10 : 9;
  const SLOT_LABEL_SIZE = isDesktop ? 10 : 9;
  const SLOT_ICON_SIZE = isDesktop ? 14 : 12;
  const SOURCE_BADGE_SIZE = isDesktop ? 8 : 7;
  const DAY_TITLE_SIZE = isDesktop ? 14 : 13;
  const DAY_DEST_SIZE = isDesktop ? 11 : 10;
  const CARD_PX = isDesktop ? 3 : 2;
  const CARD_PY = isDesktop ? 2.5 : 1.5;

  return (
    <div
      className="flex gap-0 overflow-x-auto"
      style={{
        scrollbarWidth: 'thin',
        minHeight: 0,
        height: '100%',
      }}
    >
      {trip.days.map(day => {
        const destColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
        const shortDay = day.dayOfWeek?.slice(0, 3) || '';
        const dateNum = day.date?.replace(/\D/g, ' ').trim().split(' ').pop() || day.dayNumber;
        // Extract month abbreviation from date string like "Jun 15"
        const shortMonth = day.date?.match(/^([A-Za-z]+)/)?.[1] || '';
        const dayIdx = trip.days.indexOf(day);
        const prevDay = dayIdx > 0 ? trip.days[dayIdx - 1] : null;
        const prevMonth = prevDay?.date?.match(/^([A-Za-z]+)/)?.[1] || '';
        const showMonth = !prevDay || shortMonth !== prevMonth;

        return (
          <div
            key={day.dayNumber}
            className="flex flex-col flex-shrink-0"
            style={{
              width: COL_WIDTH,
              borderRight: '1px solid var(--t-linen)',
              background: selectedDay === day.dayNumber ? 'rgba(42,122,86,0.02)' : 'white',
              transition: 'background 150ms ease',
            }}
          >
            {/* Day column header — click selects day in picks rail */}
            <div
              className="px-3 flex items-center justify-between cursor-pointer"
              onClick={() => onDaySelect?.(day.dayNumber)}
              style={{
                paddingTop: isDesktop ? 10 : 8,
                paddingBottom: isDesktop ? 10 : 8,
                background: destColor.bg,
                borderBottom: selectedDay === day.dayNumber
                  ? `2px solid var(--t-verde)`
                  : `2px solid ${destColor.accent}30`,
                transition: 'border-color 150ms ease',
              }}
            >
              <div>
                {showMonth && (
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
                  }}>
                    {shortMonth}
                  </div>
                )}
                <div style={{ fontFamily: FONT.sans, fontSize: DAY_TITLE_SIZE, fontWeight: 700, color: destColor.text }}>
                  {shortDay} {dateNum}
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: DAY_DEST_SIZE, fontWeight: 500, color: destColor.accent }}>
                  {day.destination || 'TBD'}
                </div>
              </div>
              {(day.hotelInfo || day.hotel) && (
                <div
                  className="flex flex-col items-end gap-0"
                  style={{ maxWidth: 140 }}
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
                      style={{ fontFamily: FONT.sans, fontSize: 8, color: INK['40'], maxWidth: 140 }}
                    >
                      {day.hotelInfo.address}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Early departures — transports before the first slot */}
            {getTransportsBeforeSlots(day.transport).length > 0 && (
              <div className="flex-shrink-0">
                {getTransportsBeforeSlots(day.transport).map(t => (
                  <TransportBanner key={t.id} transport={t} compact />
                ))}
              </div>
            )}

            {/* Scrollable slot list with inter-slot transport banners */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {day.slots.map(slot => {
                const icon = SLOT_ICONS[slot.id] || 'pin';
                const hasPlaces = slot.places.length > 0;
                const hasGhosts = slot.ghostItems && slot.ghostItems.length > 0;
                const slotSuggestions = suggestions?.filter(
                  s => s.targetDay === day.dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
                ) || [];
                const slotReactions = reactions?.filter(r => r.placeKey.startsWith(`${day.dayNumber}-${slot.id}-`)) || [];
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
                    style={{
                      borderBottom: '1px solid var(--t-linen)',
                      background: isDropActive ? 'rgba(42,122,86,0.06)' : undefined,
                      borderLeft: isDropActive ? '3px solid var(--t-verde)' : '3px solid transparent',
                      transition: 'all 150ms ease',
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
                        <span style={{ fontFamily: FONT.mono, fontSize: SLOT_LABEL_SIZE, color: INK['35'] }}>
                          {slot.time}
                        </span>
                      )}
                    </div>

                    {/* Placed items */}
                    {slot.places.map(p => {
                      const srcStyle = SOURCE_STYLES[(p.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
                      const subtitle = p.friendAttribution?.note || p.terrazzoReasoning?.rationale || p.tasteNote || '';
                      const placeKey = `${day.dayNumber}-${slot.id}-${p.name}`;
                      const placeReactions = reactions?.filter(r => r.placeKey === placeKey) || [];

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
                          className={`group/card mx-${CARD_PX} mb-1.5 rounded-lg cursor-grab card-hover relative`}
                          style={{
                            background: 'rgba(42,122,86,0.03)',
                            border: '1px solid rgba(42,122,86,0.1)',
                          }}
                        >
                          {/* × unplace button — visible on hover */}
                          {onUnplace && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onUnplace(p.id, day.dayNumber, slot.id); }}
                              className="absolute opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center nav-hover"
                              style={{
                                top: 4,
                                right: 4,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.06)',
                                border: 'none',
                                cursor: 'pointer',
                                zIndex: 2,
                              }}
                              title="Remove from slot"
                            >
                              <PerriandIcon name="close" size={10} color={INK['50']} />
                            </button>
                          )}
                          <div
                            className="flex items-start gap-2"
                            style={{ padding: isDesktop ? '10px 12px' : '6px 8px' }}
                          >
                            {/* Left accent bar */}
                            <div
                              className="flex-shrink-0 rounded-full"
                              style={{
                                width: isDesktop ? 3 : 2,
                                height: isDesktop ? 32 : 24,
                                background: 'var(--t-verde)',
                                opacity: 0.5,
                                marginTop: 1,
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-medium truncate"
                                  style={{ color: 'var(--t-ink)', fontFamily: FONT.sans, fontSize: PLACE_NAME_SIZE }}
                                >
                                  {p.name}
                                </span>
                              </div>
                              {subtitle && (
                                <div
                                  className="truncate"
                                  style={{
                                    color: INK['50'],
                                    fontStyle: 'italic',
                                    fontFamily: FONT.sans,
                                    fontSize: SUBTITLE_SIZE,
                                    marginTop: isDesktop ? 2 : 1,
                                  }}
                                >
                                  {subtitle}
                                </div>
                              )}
                              {/* Match score + location on desktop */}
                              {isDesktop && (
                                <div className="flex items-center gap-2 mt-1">
                                  {p.matchScore >= 70 && (
                                    <span
                                      className="px-1 py-px rounded"
                                      style={{
                                        fontFamily: FONT.mono,
                                        fontSize: 8,
                                        fontWeight: 700,
                                        background: 'rgba(42,122,86,0.08)',
                                        color: 'var(--t-verde)',
                                      }}
                                    >
                                      {p.matchScore}% match
                                    </span>
                                  )}
                                  {p.location && (
                                    <span
                                      className="truncate"
                                      style={{
                                        fontFamily: FONT.mono,
                                        fontSize: 8,
                                        color: INK['35'],
                                      }}
                                    >
                                      {p.location.split(',')[0]}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <span
                              className="flex-shrink-0 px-1.5 py-0.5 rounded font-bold"
                              style={{
                                background: srcStyle.bg,
                                color: srcStyle.color,
                                fontFamily: FONT.mono,
                                fontSize: SOURCE_BADGE_SIZE,
                              }}
                            >
                              {srcStyle.label}
                            </span>
                          </div>
                          {/* Reactions */}
                          {placeReactions.length > 0 && (
                            <div style={{ padding: isDesktop ? '0 12px 8px' : '0 8px 4px' }}>
                              <ReactionPills reactions={placeReactions} compact />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Ghost items */}
                    {hasGhosts && !hasPlaces && (
                      <div className={`px-${CARD_PX} pb-1.5 flex flex-col gap-1`}>
                        {slot.ghostItems!.map(ghost => (
                          <GhostCard
                            key={ghost.id}
                            item={ghost}
                            variant="slot"
                            onConfirm={() => confirmGhost(day.dayNumber, slot.id, ghost.id)}
                            onDismiss={() => dismissGhost(day.dayNumber, slot.id, ghost.id)}
                            onTapDetail={() => onTapDetail(ghost)}
                          />
                        ))}
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

                    {/* Empty slot */}
                    {!hasPlaces && !hasGhosts && slotSuggestions.length === 0 && (
                      <div
                        className={`mx-${CARD_PX} mb-1.5 rounded-lg flex items-center justify-center`}
                        style={{
                          height: EMPTY_SLOT_H,
                          border: isDropActive ? '2px dashed var(--t-verde)' : '1px dashed var(--t-linen)',
                          background: isDropActive ? 'rgba(42,122,86,0.06)' : INK['02'],
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 11 : 10, color: INK['30'] }}>
                          + add
                        </span>
                      </div>
                    )}

                    {/* Transport banners positioned after this slot based on departure time */}
                    {getTransportsAfterSlot(day.transport, slot.id).map(t => (
                      <TransportBanner key={t.id} transport={t} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
