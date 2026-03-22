'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { FONT, INK, TEXT } from '@/constants/theme';
import { SLOT_ICONS, getSourceStyle } from '@/types';
import type { ImportedPlace, TimeSlot } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { PlacedCard } from '@/components/day-board';
import QuickEntryCard from '@/components/chat/QuickEntryCard';
import QuickEntryInput from '@/components/chat/QuickEntryInput';
// TODO: Re-enable when multiplayer collaboration is ready
// import CollaboratorGhostCard from '@/components/place/CollaboratorGhostCard';
import { usePlaceDetail } from '@/context/PlaceDetailContext';
// import { useTripCollaboration } from '@/context/TripCollaborationContext';
import { useTripDrag } from '@/context/TripDragContext';

interface SlotOverlayProps {
  dayNumber: number;
  slot: TimeSlot;
  anchorRect: DOMRect;
  colWidth: number;
  onClose: () => void;
}

/**
 * Modal-like overlay for expanded slot view. Shows all items in a slot
 * when the cell is overflowing (3+ items). Anchored to the grid cell.
 */
function SlotOverlay({ dayNumber, slot, anchorRect, colWidth, onClose }: SlotOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { openDetail: onTapDetail } = usePlaceDetail();
  // TODO: Re-enable when multiplayer collaboration is ready
  // const { suggestions, myRole, onRespondSuggestion } = useTripCollaboration();
  const { onRegisterSlotRef, dropTarget } = useTripDrag();
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const removeQuickEntry = useTripStore(s => s.removeQuickEntry);
  const confirmQuickEntry = useTripStore(s => s.confirmQuickEntry);
  const updateQuickEntry = useTripStore(s => s.updateQuickEntry);
  const addQuickEntry = useTripStore(s => s.addQuickEntry);

  const [showQuickInput, setShowQuickInput] = React.useState(false);
  const [editingEntryKey, setEditingEntryKey] = React.useState<string | null>(null);

  // TODO: Re-enable when multiplayer collaboration is ready
  // const slotSuggestions = suggestions?.filter(
  //   s => s.targetDay === dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
  // ) || [];

  const CARD_H = 50;
  const CARD_PX = 3;
  const icon = SLOT_ICONS[slot.id] || 'pin';

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position the overlay aligned to the anchor cell
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100,
    left: Math.max(8, anchorRect.left),
    top: Math.max(8, anchorRect.top - 20),
    width: Math.max(colWidth, 280),
    maxHeight: 420,
    background: 'white',
    borderRadius: 12,
    border: '1px solid var(--t-linen)',
    boxShadow: '0 8px 32px rgba(0,42,85,0.12), 0 2px 8px rgba(0,42,85,0.06)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  // Adjust if overflowing viewport
  if (typeof window !== 'undefined') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (anchorRect.left + Math.max(colWidth, 280) > vw - 8) {
      style.left = vw - Math.max(colWidth, 280) - 8;
    }
    if ((anchorRect.top - 20) + 420 > vh - 8) {
      style.top = Math.max(8, vh - 420 - 8);
    }
  }

  return (
    <div ref={overlayRef} style={style}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--t-linen)', flexShrink: 0 }}
      >
        <div className="flex items-center gap-1.5">
          <PerriandIcon name={icon as PerriandIconName} size={14} color={INK['60']} />
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: TEXT.secondary, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
            {slot.label}
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
            {slot.time}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center"
          style={{ width: 24, height: 24, borderRadius: 6, background: INK['04'], border: 'none', cursor: 'pointer' }}
          aria-label="Close"
        >
          <PerriandIcon name="close" size={10} color={INK['55']} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'thin' }}>
        {/* Confirmed places */}
        {slot.places.map(p => (
          <PlacedCard
            key={p.id}
            place={p}
            dayNumber={dayNumber}
            slotId={slot.id}
            isDesktop={true}
            CARD_H={CARD_H}
            CARD_PX={CARD_PX}
          />
        ))}

        {/* Quick entries */}
        {slot.quickEntries && slot.quickEntries.length > 0 && (
          <div className={`px-${CARD_PX} pb-0.5`}>
            {slot.quickEntries.map(qe => {
              const entryKey = `${dayNumber}-${slot.id}-${qe.id}`;
              return editingEntryKey === entryKey ? (
                <QuickEntryInput
                  key={qe.id}
                  slotLabel={slot.label}
                  initialValue={qe.text}
                  onSubmit={(updated) => {
                    updateQuickEntry(dayNumber, slot.id, qe.id, {
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
                  onRemove={() => removeQuickEntry(dayNumber, slot.id, qe.id)}
                  onConfirm={qe.status === 'tentative' ? () => confirmQuickEntry(dayNumber, slot.id, qe.id) : undefined}
                  onTap={() => setEditingEntryKey(entryKey)}
                />
              );
            })}
          </div>
        )}

        {/* Ghost items */}
        {slot.ghostItems && slot.ghostItems.length > 0 && slot.ghostItems.map(ghost => {
          const gSrc = getSourceStyle(ghost);
          const gNote = ghost.userContext
            ? `"${ghost.userContext}"`
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
                padding: '6px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold truncate flex-1" style={{ color: TEXT.primary, fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.2 }}>
                  {ghost.name}
                </span>
                <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, textTransform: 'uppercase' }}>
                  {ghost.type}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); confirmGhost(dayNumber, slot.id, ghost.id); }}
                  className="flex-shrink-0 px-1.5 py-px rounded font-semibold btn-hover"
                  style={{ background: 'var(--t-dark-teal)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: FONT.sans, fontSize: 10 }}
                  aria-label="Add place"
                >
                  Add
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissGhost(dayNumber, slot.id, ghost.id); }}
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center nav-hover"
                  style={{ background: INK['08'], border: 'none', cursor: 'pointer' }}
                  aria-label="Dismiss suggestion"
                >
                  <PerriandIcon name="close" size={9} color={INK['70']} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 min-w-0" style={{ marginTop: 2 }}>
                <span className="flex-shrink-0 px-1.5 py-px rounded-full flex items-center gap-0.5 font-semibold" style={{ background: gSrc.bg, color: gSrc.color, fontSize: 8 }}>
                  <PerriandIcon name={gSrc.icon} size={8} color={gSrc.color} />
                  {gSrc.label}
                </span>
                {gNote && (
                  <span className="truncate italic" style={{ color: TEXT.secondary, fontSize: 10 }}>
                    {gNote}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* TODO: Re-enable when multiplayer collaboration is ready */}
        {/* {slotSuggestions.length > 0 && (
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
        )} */}
      </div>

      {/* Footer — add entry */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderTop: '1px solid var(--t-linen)' }}>
        {showQuickInput ? (
          <QuickEntryInput
            slotLabel={slot.label}
            onSubmit={(entry) => {
              addQuickEntry(dayNumber, slot.id, entry);
              setShowQuickInput(false);
            }}
            onCancel={() => setShowQuickInput(false)}
          />
        ) : (
          <button
            onClick={() => setShowQuickInput(true)}
            className="text-[10px] cursor-pointer rounded flex items-center gap-0.5 w-full justify-center py-1.5"
            style={{
              color: TEXT.secondary,
              fontFamily: FONT.sans,
              fontWeight: 500,
              background: INK['04'],
              border: `1px solid ${INK['08']}`,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>+</span> add entry
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(SlotOverlay);
