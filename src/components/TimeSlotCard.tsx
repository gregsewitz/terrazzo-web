'use client';

import { useCallback, useRef, useEffect, useState, memo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { TimeSlot, ImportedPlace, GhostSourceType, SOURCE_STYLES, SLOT_ICONS } from '@/types';
import { SlotContext, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import GhostCard from './GhostCard';
import CollaboratorGhostCard from './CollaboratorGhostCard';
import ReactionPills from './ReactionPills';
import SlotNoteBubble from './SlotNoteBubble';
import { FONT, INK } from '@/constants/theme';
import { hasGhostItems } from '@/utils/ghostFiltering';
import type { Suggestion, Reaction, SlotNoteItem } from '@/stores/collaborationStore';

const SLOT_HOLD_DELAY = 250;
const SLOT_DRAG_THRESHOLD = 6;

interface TimeSlotCardProps {
  slot: TimeSlot;
  dayNumber: number;
  destColor: { bg: string; accent: string; text: string };
  onTapDetail: (item: ImportedPlace) => void;
  onOpenUnsorted: () => void;
  onOpenForSlot?: (ctx: SlotContext) => void;
  allSlots?: TimeSlot[];
  slotIndex?: number;
  isDropTarget?: boolean;
  onRegisterRef?: (rect: DOMRect | null) => void;
  onDragStartFromSlot?: (item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => void;
  dragItemId?: string | null;
  onUnplace?: (placeId: string, dayNumber: number, slotId: string) => void;
  // Collaboration
  suggestions?: Suggestion[];
  reactions?: Reaction[];
  slotNoteItems?: SlotNoteItem[];
  myRole?: 'owner' | 'suggester' | 'viewer' | null;
  onRespondSuggestion?: (suggestionId: string, status: 'accepted' | 'rejected') => void;
  onAddReaction?: (placeKey: string, reaction: 'love' | 'not_for_me') => void;
  onAddSlotNote?: (content: string) => void;
}

function TimeSlotCard({ slot, dayNumber, destColor, onTapDetail, onOpenUnsorted, onOpenForSlot, allSlots, slotIndex, isDropTarget, onRegisterRef, onDragStartFromSlot, dragItemId, onUnplace, suggestions, reactions, slotNoteItems, myRole, onRespondSuggestion, onAddReaction, onAddSlotNote }: TimeSlotCardProps) {
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const unplaceFromSlot = useTripStore(s => s.unplaceFromSlot);
  const icon = SLOT_ICONS[slot.id] || 'pin';
  const slotRef = useRef<HTMLDivElement>(null);
  const hasPlaces = slot.places.length > 0;
  const isEmpty = !hasPlaces && !hasGhostItems(slot);
  const hasGhosts = hasGhostItems(slot);

  // ─── Drag-from-slot gesture handling ───
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdItem = useRef<ImportedPlace | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const gestureDecided = useRef(false);
  const [holdingPlaceId, setHoldingPlaceId] = useState<string | null>(null);

  const clearSlotHold = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    holdItem.current = null;
    pointerStart.current = null;
    gestureDecided.current = false;
    setHoldingPlaceId(null);
  }, []);

  const handlePlacePointerDown = useCallback((place: ImportedPlace, e: React.PointerEvent) => {
    if (!onDragStartFromSlot) return;
    e.stopPropagation();
    pointerStart.current = { x: e.clientX, y: e.clientY };
    holdItem.current = place;
    gestureDecided.current = false;

    holdTimer.current = setTimeout(() => {
      if (holdItem.current && !gestureDecided.current) {
        gestureDecided.current = true;
        onDragStartFromSlot(holdItem.current, dayNumber, slot.id, e);
        holdItem.current = null;
        setHoldingPlaceId(null);
      }
    }, SLOT_HOLD_DELAY);

    // Visual hold feedback
    setTimeout(() => {
      if (holdItem.current?.id === place.id && !gestureDecided.current) {
        setHoldingPlaceId(place.id);
      }
    }, 120);
  }, [onDragStartFromSlot, dayNumber, slot.id]);

  const handlePlacePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current || gestureDecided.current || !onDragStartFromSlot) return;
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    const dx = Math.abs(e.clientX - pointerStart.current.x);

    if (dy > SLOT_DRAG_THRESHOLD || dx > SLOT_DRAG_THRESHOLD) {
      gestureDecided.current = true;
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      if (holdItem.current) {
        onDragStartFromSlot(holdItem.current, dayNumber, slot.id, e);
        holdItem.current = null;
        setHoldingPlaceId(null);
      }
    }
  }, [onDragStartFromSlot, dayNumber, slot.id]);

  const handlePlacePointerUp = useCallback(() => {
    clearSlotHold();
  }, [clearSlotHold]);

  // Register bounding rect on mount and resize — all slots are valid drop targets
  const updateRect = useCallback(() => {
    if (onRegisterRef && slotRef.current) {
      onRegisterRef(slotRef.current.getBoundingClientRect());
    }
  }, [onRegisterRef]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  const handleEmptyClick = () => {
    if (onOpenForSlot && allSlots && slotIndex != null) {
      const prevSlot = slotIndex > 0 ? allSlots[slotIndex - 1] : undefined;
      const nextSlot = slotIndex < allSlots.length - 1 ? allSlots[slotIndex + 1] : undefined;
      const prevPlace = prevSlot?.places[prevSlot.places.length - 1];
      const nextPlace = nextSlot?.places[0];
      const before = prevPlace ? { name: prevPlace.name, type: prevPlace.type, location: prevPlace.location } : undefined;
      const after = nextPlace ? { name: nextPlace.name, type: nextPlace.type, location: nextPlace.location } : undefined;
      onOpenForSlot({
        slotId: slot.id,
        slotLabel: slot.label,
        dayNumber,
        adjacentPlaces: { before, after },
        suggestedTypes: SLOT_TYPE_AFFINITY[slot.id] || [],
      });
    } else {
      onOpenUnsorted();
    }
  };

  // ─── Ghost slots get expanded GhostCard; confirmed/empty stay compact ───
  if (hasGhosts && !hasPlaces) {
    return (
      <div
        ref={slotRef}
        style={{
          borderBottom: '1px solid var(--t-linen)',
          background: isDropTarget ? 'rgba(42,122,86,0.04)' : undefined,
          transition: 'background 0.15s ease-out',
        }}
      >
        {/* Compact header row for the slot */}
        <div
          className="flex items-center gap-2 px-4"
          style={{ height: 32 }}
        >
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            <PerriandIcon name={icon as any} size={14} color="var(--t-ink)" />
          </div>
          <span
            className="text-[11px]"
            style={{
              fontFamily: FONT.mono,
              color: INK['85'],
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            {slot.label}
          </span>
          {slot.ghostItems!.length > 1 && (
            <span className="text-[9px]" style={{ color: INK['80'] }}>
              {slot.ghostItems!.length} suggestions
            </span>
          )}
        </div>

        {/* Ghost cards */}
        <div className="px-4 pb-2.5 flex flex-col gap-2">
          {slot.ghostItems!.map(ghost => (
            <GhostCard
              key={ghost.id}
              item={ghost}
              variant="slot"
              onConfirm={() => confirmGhost(dayNumber, slot.id, ghost.id)}
              onDismiss={() => dismissGhost(dayNumber, slot.id, ghost.id)}
              onTapDetail={() => onTapDetail(ghost)}
            />
          ))}
          {/* Collaborator suggestions */}
          {suggestions && suggestions.length > 0 && suggestions.map(sg => (
            <CollaboratorGhostCard
              key={sg.id}
              suggestion={sg}
              isOwner={myRole === 'owner'}
              onAccept={() => onRespondSuggestion?.(sg.id, 'accepted')}
              onReject={() => onRespondSuggestion?.(sg.id, 'rejected')}
            />
          ))}
        </div>
        {/* Slot notes */}
        {((slotNoteItems && slotNoteItems.length > 0) || (myRole === 'suggester' || myRole === 'owner')) && (
          <div className="px-4 pb-2">
            <SlotNoteBubble
              notes={slotNoteItems || []}
              canAdd={myRole === 'suggester' || myRole === 'owner'}
              onAddNote={onAddSlotNote}
            />
          </div>
        )}
      </div>
    );
  }

  // ─── Compact layout: one row per confirmed place + empty drop target ───
  return (
    <div
      ref={slotRef}
      style={{
        borderBottom: '1px solid var(--t-linen)',
        borderLeft: isDropTarget ? '3px solid var(--t-verde)' : '3px solid transparent',
        background: isDropTarget
          ? 'rgba(42,122,86,0.06)'
          : hasPlaces
            ? 'rgba(42,122,86,0.055)'
            : undefined,
        transition: 'background 0.2s ease-out, border-left 0.15s ease-out',
      }}
    >
      {/* Slot label row */}
      {hasPlaces && (
        <div className="flex items-center gap-2 px-4" style={{ height: 28 }}>
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            <PerriandIcon name={icon as any} size={14} color="var(--t-ink)" />
          </div>
          <span
            className="text-[10px] flex-shrink-0"
            style={{
              fontFamily: FONT.mono,
              color: INK['85'],
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            {slot.label}
          </span>
          {slot.time && (
            <span
              className="text-[10px]"
              style={{ color: INK['80'], fontFamily: FONT.mono }}
            >
              {slot.time}
            </span>
          )}
        </div>
      )}

      {/* Confirmed places — draggable card style with source + insight */}
      {slot.places.map((p, pIdx) => {
        const srcStyle = SOURCE_STYLES[(p.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
        const isReservation = p.ghostSource === 'email';
        const isDragging = dragItemId === p.id;
        const isHolding = holdingPlaceId === p.id;
        const subtitle = p.friendAttribution?.note
          || p.terrazzoReasoning?.rationale
          || p.tasteNote
          || '';
        return (
          <div
            key={p.id}
            className="mx-3 mb-1.5 rounded-lg cursor-pointer overflow-hidden select-none"
            onClick={() => { if (!isDragging) onTapDetail(p); }}
            onPointerDown={(e) => handlePlacePointerDown(p, e)}
            onPointerMove={handlePlacePointerMove}
            onPointerUp={handlePlacePointerUp}
            onPointerCancel={handlePlacePointerUp}
            style={{
              background: 'white',
              border: isHolding
                ? '1.5px solid var(--t-verde)'
                : '1px solid rgba(42,122,86,0.12)',
              opacity: isDragging ? 0.3 : 1,
              transform: isDragging
                ? 'scale(0.95)'
                : isHolding
                  ? 'scale(0.97) translateY(-1px)'
                  : 'none',
              boxShadow: isHolding
                ? '0 4px 12px rgba(42,122,86,0.15)'
                : 'none',
              transition: 'opacity 0.2s, transform 0.2s ease-out, border 0.15s, box-shadow 0.15s',
              touchAction: 'none',
            }}
          >
            <div className="flex items-start gap-2 px-2.5 py-2">
              {/* Source bar — solid for reservations, regular for others */}
              <div
                className="flex-shrink-0 rounded-full mt-0.5"
                style={{
                  width: isReservation ? 3 : 2,
                  height: 30,
                  background: isReservation ? srcStyle.color : 'var(--t-verde)',
                  opacity: isReservation ? 1 : 0.5,
                }}
              />
              {/* Content — name + source on line 1, insight on line 2 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[12px] font-medium truncate"
                    style={{ color: 'var(--t-ink)' }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-px rounded flex-shrink-0 flex items-center gap-0.5"
                    style={{ background: srcStyle.bg, color: srcStyle.color }}
                  >
                    <PerriandIcon name={srcStyle.icon} size={8} color={srcStyle.color} /> {p.ghostSource === 'friend' ? p.friendAttribution?.name : srcStyle.label}
                  </span>
                </div>
                {subtitle && (
                  <div
                    className="text-[10px] truncate mt-px"
                    style={{
                      color: INK['85'],
                      fontStyle: 'italic',
                      fontFamily: FONT.sans,
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
              {/* Remove button — visible to owner or when not in collaboration mode */}
              {(myRole === 'owner' || !myRole) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUnplace) {
                      onUnplace(p.id, dayNumber, slot.id);
                    } else {
                      unplaceFromSlot(dayNumber, slot.id, p.id);
                    }
                  }}
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                  style={{
                    background: INK['05'],
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="Remove place"
                >
                  <PerriandIcon name="close" size={8} color={INK['55']} />
                </button>
              )}
            </div>
            {/* Reaction pills for this place */}
            {(() => {
              const placeKey = `${dayNumber}-${slot.id}-${p.name}`;
              const placeReactions = reactions?.filter(r => r.placeKey === placeKey) || [];
              if (placeReactions.length === 0 && !myRole) return null;
              return (
                <div className="flex items-center gap-1.5 px-2.5 pb-1.5">
                  <ReactionPills reactions={placeReactions} compact />
                  {myRole && myRole !== 'owner' && onAddReaction && (
                    <div className="flex gap-1 ml-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddReaction(placeKey, 'love'); }}
                        className="px-1.5 py-0.5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,0.06)', border: 'none', cursor: 'pointer' }}
                        aria-label="Love this place"
                      ><PerriandIcon name="loveReaction" size={12} color="#dc2626" accent="#dc2626" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddReaction(placeKey, 'not_for_me'); }}
                        className="px-1.5 py-0.5 rounded-full flex items-center justify-center"
                        style={{ background: INK['05'], border: 'none', cursor: 'pointer' }}
                        aria-label="Not for me"
                      ><PerriandIcon name="unsure" size={12} color={INK['60']} accent={INK['60']} /></button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Collaborator suggestions for this slot */}
      {suggestions && suggestions.length > 0 && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {suggestions.map(sg => (
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
      {((slotNoteItems && slotNoteItems.length > 0) || (myRole === 'suggester' || myRole === 'owner')) && (
        <div className="px-3 pb-2">
          <SlotNoteBubble
            notes={slotNoteItems || []}
            canAdd={myRole === 'suggester' || myRole === 'owner'}
            onAddNote={onAddSlotNote}
          />
        </div>
      )}

      {/* Add padding at bottom of filled slots */}
      {hasPlaces && <div style={{ height: 4 }} />}

      {/* Empty slot — drop target / add row */}
      {!hasPlaces && (
        <div
          className="flex items-center gap-2 px-4 cursor-pointer"
          onClick={handleEmptyClick}
          style={{
            height: isDropTarget ? 56 : 48,
            background: isDropTarget ? 'rgba(42,122,86,0.06)' : 'transparent',
            borderLeft: isDropTarget ? '3px solid var(--t-verde)' : '3px solid transparent',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
            style={{
              background: isDropTarget ? 'rgba(42,122,86,0.1)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <PerriandIcon name={icon as any} size={14} color={isDropTarget ? 'var(--t-verde)' : 'var(--t-ink)'} />
          </div>
          <span
            className="text-[11px] flex-shrink-0"
            style={{
              width: 62,
              fontFamily: FONT.mono,
              color: isDropTarget ? 'var(--t-verde)' : INK['85'],
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
              fontWeight: isDropTarget ? 600 : 400,
              transition: 'color 0.15s, font-weight 0.15s',
            }}
          >
            {slot.label}
          </span>
          <span
            className="text-[11px]"
            style={{
              color: isDropTarget ? 'var(--t-verde)' : INK['75'],
              fontWeight: isDropTarget ? 600 : 400,
              transition: 'color 0.15s',
            }}
          >
            {isDropTarget ? 'Drop here ↓' : '+ add'}
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(TimeSlotCard);
