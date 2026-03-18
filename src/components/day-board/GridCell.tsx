'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { FONT, INK, TEXT } from '@/constants/theme';
import { SOURCE_STYLES, GhostSourceType } from '@/types';
import type { ImportedPlace, TimeSlot } from '@/types';
import { PlacedCard } from '@/components/day-board';
import QuickEntryCard from '@/components/chat/QuickEntryCard';
import QuickEntryInput from '@/components/chat/QuickEntryInput';
import CollaboratorGhostCard from '@/components/place/CollaboratorGhostCard';
import GhostBadge from './GhostBadge';
import { usePlaceDetail } from '@/context/PlaceDetailContext';
import { useTripCollaboration } from '@/context/TripCollaborationContext';
import { useTripDrag } from '@/context/TripDragContext';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

interface GridCellProps {
  dayNumber: number;
  slot: TimeSlot;
  rowHeight: number;
  colWidth: number;
  isDesktop: boolean;
  onOpenOverlay: (dayNumber: number, slotId: string, rect: DOMRect) => void;
}

const CARD_H = 72;
const CARD_PX = 3;
const MAX_VISIBLE_CARDS = 2;
const VIEW_ALL_H = 22;

/**
 * A single cell in the day planner grid. Shows up to 2 cards, with a
 * "View all (N)" bar when there are 3+ items. Acts as a drop target.
 */
function GridCell({ dayNumber, slot, rowHeight, colWidth, isDesktop, onOpenOverlay }: GridCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const { openDetail: onTapDetail } = usePlaceDetail();
  const { suggestions, myRole, onRespondSuggestion } = useTripCollaboration();
  const { dropTarget, onRegisterSlotRef } = useTripDrag();
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const removeQuickEntry = useTripStore(s => s.removeQuickEntry);
  const confirmQuickEntry = useTripStore(s => s.confirmQuickEntry);
  const addQuickEntry = useTripStore(s => s.addQuickEntry);

  const [quickInputOpen, setQuickInputOpen] = React.useState(false);

  const isDropActive = dropTarget?.dayNumber === dayNumber && dropTarget?.slotId === slot.id;

  // Register slot rect for drag hit-testing
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const report = () => onRegisterSlotRef(dayNumber, slot.id, el.getBoundingClientRect());
    report();
    window.addEventListener('resize', report);
    const scrollParent = el.closest('.overflow-x-auto') || el.closest('.overflow-y-auto');
    if (scrollParent) {
      scrollParent.addEventListener('scroll', report, { passive: true });
    }
    return () => {
      window.removeEventListener('resize', report);
      if (scrollParent) scrollParent.removeEventListener('scroll', report);
      onRegisterSlotRef(dayNumber, slot.id, null);
    };
  }, [dayNumber, slot.id, onRegisterSlotRef]);

  const slotSuggestions = suggestions?.filter(
    s => s.targetDay === dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
  ) || [];

  // Collect all items in priority order for display
  const allItems = useMemo(() => {
    const items: Array<{ type: 'place' | 'quickEntry' | 'ghost' | 'suggestion'; data: unknown; id: string }> = [];
    for (const p of slot.places) {
      items.push({ type: 'place', data: p, id: p.id });
    }
    for (const qe of (slot.quickEntries || [])) {
      items.push({ type: 'quickEntry', data: qe, id: qe.id });
    }
    for (const g of (slot.ghostItems || [])) {
      items.push({ type: 'ghost', data: g, id: g.id });
    }
    for (const sg of slotSuggestions) {
      items.push({ type: 'suggestion', data: sg, id: sg.id });
    }
    return items;
  }, [slot.places, slot.quickEntries, slot.ghostItems, slotSuggestions]);

  const totalCount = allItems.length;
  const isOverflow = totalCount > MAX_VISIBLE_CARDS;
  const visibleItems = isOverflow ? allItems.slice(0, MAX_VISIBLE_CARDS) : allItems;

  // Count hidden ghost cards for the badge
  const hiddenGhostCount = isOverflow
    ? allItems.slice(MAX_VISIBLE_CARDS).filter(i => i.type === 'ghost').length
    : 0;

  const handleOpenOverlay = useCallback(() => {
    if (cellRef.current) {
      onOpenOverlay(dayNumber, slot.id, cellRef.current.getBoundingClientRect());
    }
  }, [dayNumber, slot.id, onOpenOverlay]);

  // Click on empty cell to add entry; click on populated cell opens overlay
  const handleCellClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if clicking on a card or button inside the cell
    if ((e.target as HTMLElement).closest('[data-grid-card]') || (e.target as HTMLElement).closest('button')) return;
    if (totalCount === 0 && !quickInputOpen) {
      setQuickInputOpen(true);
    } else if (totalCount > 0) {
      handleOpenOverlay();
    }
  }, [totalCount, quickInputOpen, handleOpenOverlay]);

  /** Wrap any card in a fixed-height container so all cards are uniform.
   *  Uses relative/absolute positioning to truly constrain children
   *  that have their own minHeight (like PlacedCard). */
  const cardWrapper = (key: string, children: React.ReactNode) => (
    <div
      key={key}
      data-grid-card
      style={{
        position: 'relative',
        height: CARD_H + 6,
        minHeight: CARD_H + 6,
        maxHeight: CARD_H + 6,
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: CARD_H + 6,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );

  const renderItem = (item: typeof allItems[number]) => {
    switch (item.type) {
      case 'place':
        return cardWrapper(item.id, (
          <PlacedCard
            place={item.data as ImportedPlace}
            dayNumber={dayNumber}
            slotId={slot.id}
            isDesktop={isDesktop}
            CARD_H={CARD_H}
            CARD_PX={CARD_PX}
          />
        ));
      case 'quickEntry': {
        const qe = item.data as import('@/types').QuickEntry;
        return cardWrapper(item.id, (
          <QuickEntryCard
            entry={qe}
            onRemove={() => removeQuickEntry(dayNumber, slot.id, qe.id)}
            onConfirm={qe.status === 'tentative' ? () => confirmQuickEntry(dayNumber, slot.id, qe.id) : undefined}
          />
        ));
      }
      case 'ghost': {
        const ghost = item.data as ImportedPlace;
        const gSrc = SOURCE_STYLES[(ghost.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
        const gNote = ghost.friendAttribution?.note
          ? `"${ghost.friendAttribution.note}"`
          : ghost.terrazzoReasoning?.rationale
            || ghost.enrichment?.description
            || ghost.google?.editorialSummary
            || ghost.tips?.[0]
            || '';
        return cardWrapper(item.id, (
          <div
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
              <button
                onClick={(e) => { e.stopPropagation(); confirmGhost(dayNumber, slot.id, ghost.id); }}
                className="flex-shrink-0 px-1.5 py-px rounded font-semibold btn-hover"
                style={{ background: 'var(--t-dark-teal)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: FONT.sans, fontSize: 10 }}
              >
                Add
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); dismissGhost(dayNumber, slot.id, ghost.id); }}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: INK['08'], border: 'none', cursor: 'pointer' }}
                aria-label="Dismiss suggestion"
              >
                <PerriandIcon name="close" size={9} color={INK['70']} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 min-w-0" style={{ marginTop: 2 }}>
              <span className="flex-shrink-0 px-1.5 py-px rounded-full flex items-center gap-0.5 font-semibold" style={{ background: gSrc.bg, color: gSrc.color, fontSize: 8 }}>
                {gSrc.label}
              </span>
              {gNote && <span className="truncate italic" style={{ color: TEXT.secondary, fontSize: 10 }}>{gNote}</span>}
            </div>
          </div>
        ));
      }
      case 'suggestion': {
        const sg = item.data as Parameters<typeof CollaboratorGhostCard>[0]['suggestion'];
        return cardWrapper(item.id, (
          <CollaboratorGhostCard
            suggestion={sg}
            isOwner={myRole === 'owner'}
            onAccept={() => onRespondSuggestion?.(sg.id, 'accepted')}
            onReject={() => onRespondSuggestion?.(sg.id, 'rejected')}
          />
        ));
      }
      default:
        return null;
    }
  };

  return (
    <div
      ref={cellRef}
      className="relative cursor-pointer"
      onClick={handleCellClick}
      style={{
        height: rowHeight,
        overflow: 'hidden',
        borderRight: '1px solid var(--t-linen)',
        borderBottom: '1px solid var(--t-linen)',
        background: isDropActive ? 'rgba(58,128,136,0.06)' : 'white',
        borderLeft: isDropActive ? '3px solid var(--t-dark-teal)' : '3px solid transparent',
        transition: 'all 150ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Visible cards */}
      <div className="flex-1 pt-1 overflow-hidden">
        {visibleItems.map(renderItem)}

        {/* Inline quick entry for empty cells */}
        {quickInputOpen && totalCount === 0 && (
          <div className={`px-${CARD_PX} mb-1.5`}>
            <QuickEntryInput
              slotLabel={slot.label}
              onSubmit={(entry) => {
                addQuickEntry(dayNumber, slot.id, entry);
                setQuickInputOpen(false);
              }}
              onCancel={() => setQuickInputOpen(false)}
            />
          </div>
        )}
      </div>

      {/* "View all" bar for overflow */}
      {isOverflow && (
        <button
          onClick={handleOpenOverlay}
          className="w-full flex items-center justify-center cursor-pointer"
          style={{
            height: VIEW_ALL_H,
            flexShrink: 0,
            background: INK['02'],
            borderTop: `1px solid ${INK['06']}`,
            border: 'none',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: INK['06'],
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 600,
            color: TEXT.secondary,
            letterSpacing: 0.3,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(58,128,136,0.06)';
            e.currentTarget.style.color = 'var(--t-dark-teal)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = INK['02'];
            e.currentTarget.style.color = TEXT.secondary;
          }}
        >
          View all ({totalCount})
        </button>
      )}

      {/* Ghost badge for hidden suggestions */}
      {hiddenGhostCount > 0 && (
        <GhostBadge count={hiddenGhostCount} onClick={handleOpenOverlay} />
      )}
    </div>
  );
}

export default React.memo(GridCell);
