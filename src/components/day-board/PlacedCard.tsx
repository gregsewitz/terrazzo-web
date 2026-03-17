'use client';

import React, { useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useDragGesture } from '@/hooks/useDragGesture';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import PlaceTimeEditor from '../PlaceTimeEditor';
import { FONT, INK, TEXT } from '@/constants/theme';
import { ImportedPlace, SOURCE_STYLES, GhostSourceType } from '@/types';
import type { Reaction } from '@/stores/collaborationStore';

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
        background: isHolding ? 'rgba(58,128,136,0.08)' : 'rgba(58,128,136,0.03)',
        border: isHolding ? '1.5px solid rgba(58,128,136,0.3)' : '1px solid rgba(58,128,136,0.1)',
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
        <span className="font-semibold truncate flex-1" style={{ color: TEXT.primary, fontFamily: FONT.sans, fontSize: isDesktop ? 12 : 11, lineHeight: 1.2 }}>
          {place.name}
        </span>
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: TEXT.secondary, textTransform: 'uppercase' }}>
          {place.type}
        </span>
        {place.matchScore >= 70 && (
          <span className="flex-shrink-0 px-1 rounded" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, fontWeight: 700, background: 'rgba(58,128,136,0.1)', color: 'var(--t-dark-teal)' }}>
            {Math.round(place.matchScore)}%
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
            <span className="truncate flex-1" style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 10 : 9, color: TEXT.secondary, fontStyle: 'italic' }}>
              {context}
            </span>
          )}
          {loves > 0 && (
            <span className="flex-shrink-0 flex items-center gap-0.5" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: '#c93c3c' }}>
              ♥ {loves}
            </span>
          )}
          {nopes > 0 && (
            <span className="flex-shrink-0 flex items-center gap-0.5" style={{ fontFamily: FONT.mono, fontSize: isDesktop ? 9 : 8, color: TEXT.secondary }}>
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

export default PlacedCard;
