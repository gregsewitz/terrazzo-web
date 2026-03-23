'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import type { SlotContext } from '@/stores/poolStore';
import { FONT, INK, TEXT, COLOR } from '@/constants/theme';
import { getSourceStyle } from '@/types';
import { getMatchTier, shouldShowTierBadge } from '@/lib/match-tier';
import type { ImportedPlace, TimeSlot } from '@/types';
import QuickEntryInput from '@/components/chat/QuickEntryInput';
import PlaceTimeEditor from '@/components/place/PlaceTimeEditor';
import GhostBadge from './GhostBadge';
import { usePlaceDetail } from '@/context/PlaceDetailContext';
// TODO: Re-enable when multiplayer collaboration is ready
// import { useTripCollaboration } from '@/context/TripCollaborationContext';
import { useTripDrag } from '@/context/TripDragContext';
import { useDragGesture } from '@/hooks/useDragGesture';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
// import type { Suggestion } from '@/stores/collaborationStore';

interface GridCellProps {
  dayNumber: number;
  slot: TimeSlot;
  rowHeight: number;
  colWidth: number;
  isDesktop: boolean;
  onOpenOverlay: (dayNumber: number, slotId: string, rect: DOMRect) => void;
}

const CARD_H = 100;
const CARD_GAP = 4;
const CARD_PX = 3;
const MAX_VISIBLE_CARDS = 2;
const VIEW_ALL_H = 22;

// ─── Option A: "Magazine Row" unified card ─────────────────────────────────

interface GridCardProps {
  /** Card variant determines styling (border, background) */
  variant: 'placed' | 'ghost' | 'quickEntry' | 'suggestion';
  /** Primary label (place name, entry label, suggestion name) */
  name: string;
  /** Type chip: RESTAURANT, BAR, activity category, etc. */
  typeLabel?: string;
  /** Source badge: Friend, Article, Google Maps, Manual, etc. */
  sourceBadge?: { label: string; bg: string; color: string };
  /** Match score 0–100, only shown if >= 70 */
  matchScore?: number;
  /** One-line description (italic, truncated) */
  description?: string;
  /** Primary action button (Add for ghosts, Confirm for tentative) */
  actionButton?: { label: string; onClick: (e: React.MouseEvent) => void };
  /** Dismiss/remove button */
  onDismiss?: (e: React.MouseEvent) => void;
  /** Click handler for the entire card body */
  onClick?: () => void;
  /** Pointer handlers for drag support */
  pointerHandlers?: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Visual state modifiers */
  isHolding?: boolean;
  isDragging?: boolean;
  /** Collaborator accent color (for suggestion cards) */
  collabColor?: string;
  /** Activity/event context from quick entry resolution — shown as a prominent header */
  activityContext?: string;
  /** Specific time for placed cards — rendered inline via PlaceTimeEditor */
  specificTime?: string;
  specificTimeLabel?: string;
  placeType?: string;
  slotId?: string;
  onTimeChange?: (time: string | undefined, label?: string) => void;
}

function GridCard({
  variant, name, typeLabel, sourceBadge, matchScore, description,
  actionButton, onDismiss, onClick, pointerHandlers,
  isHolding, isDragging, collabColor, activityContext,
  specificTime, specificTimeLabel, placeType, slotId, onTimeChange,
}: GridCardProps) {
  const isGhost = variant === 'ghost';
  const isSuggestion = variant === 'suggestion';
  const isQuickEntry = variant === 'quickEntry';

  // Determine card chrome
  let bg = 'rgba(58,128,136,0.03)';
  let border = '1px solid rgba(58,128,136,0.1)';
  if (isGhost) {
    bg = 'var(--t-cream)';
    border = `1.5px dashed ${sourceBadge?.color || 'rgba(58,128,136,0.3)'}`;
  } else if (isSuggestion) {
    bg = `${collabColor || '#6366f1'}08`;
    border = `1.5px dashed ${collabColor || '#6366f1'}55`;
  } else if (isQuickEntry) {
    bg = 'white';
    border = `1px solid ${INK['10']}`;
  }
  if (isHolding) {
    bg = 'rgba(58,128,136,0.08)';
    border = '1.5px solid rgba(58,128,136,0.3)';
  }

  return (
    <div
      data-grid-card
      onClick={onClick}
      onPointerDown={pointerHandlers?.onPointerDown}
      onPointerMove={pointerHandlers?.onPointerMove}
      onPointerUp={pointerHandlers?.onPointerUp}
      onPointerCancel={pointerHandlers?.onPointerCancel}
      className={`mx-${CARD_PX} rounded group/card card-hover relative`}
      style={{
        height: CARD_H,
        background: bg,
        border,
        padding: '6px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
        overflow: 'hidden',
        opacity: isDragging ? 0.3 : 1,
        transform: isHolding ? 'scale(1.02)' : 'none',
        transition: 'opacity 150ms, transform 100ms, background 100ms, border 100ms',
        cursor: pointerHandlers ? 'grab' : 'pointer',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* ─── Activity-first layout: activity title + time are primary ─── */}
      {activityContext ? (
        <>
          {/* Row 0: Activity name = primary title */}
          <div className="flex items-start gap-1.5 min-w-0">
            <span
              className="font-semibold flex-1"
              style={{
                color: TEXT.primary, fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.25,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {activityContext}
            </span>
            {onDismiss && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDismiss(e); }}
                className="flex-shrink-0 w-5 h-5 rounded-full items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
                style={{ background: INK['08'], border: 'none', cursor: 'pointer', display: 'flex' }}
                aria-label="Remove"
              >
                <PerriandIcon name="close" size={8} color={TEXT.secondary} />
              </button>
            )}
          </div>

          {/* Row 1: Time — prominent, right under the activity */}
          {specificTime && placeType && (
            <div>
              <PlaceTimeEditor
                specificTime={specificTime}
                specificTimeLabel={specificTimeLabel}
                placeType={placeType as import('@/types').PlaceType}
                slotId={slotId}
                onSave={onTimeChange || (() => {})}
                compact
              />
            </div>
          )}

          {/* Row 2: Venue name (secondary) + metadata */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              style={{
                fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              at {name}
            </span>
            {shouldShowTierBadge(matchScore) && (() => {
              const tier = getMatchTier(matchScore);
              return (
                <span
                  className="flex-shrink-0 px-1 rounded"
                  style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, background: tier.bg, color: tier.color }}
                >
                  {tier.shortLabel}
                </span>
              );
            })()}
            {sourceBadge && (
              <span
                className="flex-shrink-0 px-1.5 py-px rounded font-bold"
                style={{ background: sourceBadge.bg, color: sourceBadge.color, fontFamily: FONT.mono, fontSize: 8 }}
              >
                Via {sourceBadge.label}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ─── Standard layout: venue name is primary ─── */}
          {/* Row 1: Name + action buttons */}
          <div className="flex items-start gap-1.5 min-w-0">
            {isSuggestion && collabColor && (
              <div className="flex-shrink-0 rounded-full mt-1" style={{ width: 6, height: 6, background: collabColor }} />
            )}
            <span
              className="font-semibold flex-1"
              style={{
                color: TEXT.primary, fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.25,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {name}
            </span>
            {actionButton && (
              <button
                onClick={(e) => { e.stopPropagation(); actionButton.onClick(e); }}
                className="flex-shrink-0 px-1.5 py-px rounded font-semibold btn-hover"
                style={{ background: COLOR.darkTeal, color: 'white', border: 'none', cursor: 'pointer', fontFamily: FONT.sans, fontSize: 10 }}
              >
                {actionButton.label}
              </button>
            )}
            {onDismiss && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDismiss(e); }}
                className="flex-shrink-0 w-5 h-5 rounded-full items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
                style={{ background: INK['08'], border: 'none', cursor: 'pointer', display: 'flex' }}
                aria-label="Remove"
              >
                <PerriandIcon name="close" size={8} color={TEXT.secondary} />
              </button>
            )}
          </div>

          {/* Row 1.5: Time — shown right after name for non-activity cards */}
          {(specificTime || (variant === 'placed' && onTimeChange)) && placeType && (
            <div style={{ marginTop: -1 }}>
              <PlaceTimeEditor
                specificTime={specificTime}
                specificTimeLabel={specificTimeLabel}
                placeType={placeType as import('@/types').PlaceType}
                slotId={slotId}
                onSave={onTimeChange || (() => {})}
                compact
              />
            </div>
          )}

          {/* Row 2: Metadata chips */}
          <div className="flex items-center gap-1.5 min-w-0">
            {typeLabel && (
              <span
                className="flex-shrink-0"
                style={{ fontFamily: FONT.mono, fontSize: 8.5, fontWeight: 600, color: TEXT.tertiary, textTransform: 'uppercase', letterSpacing: 0.3 }}
              >
                {typeLabel}
              </span>
            )}
            {shouldShowTierBadge(matchScore) && (() => {
              const tier = getMatchTier(matchScore);
              return (
                <span
                  className="flex-shrink-0 px-1 rounded"
                  style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, background: tier.bg, color: tier.color }}
                >
                  {tier.shortLabel}
                </span>
              );
            })()}
            {sourceBadge && (
              <span
                className="flex-shrink-0 px-1.5 py-px rounded font-bold"
                style={{ background: sourceBadge.bg, color: sourceBadge.color, fontFamily: FONT.mono, fontSize: 8 }}
              >
                Via {sourceBadge.label}
              </span>
            )}
          </div>

          {/* Row 3: Description — dedicated line, 2-line clamp */}
          {description && (
            <div
              style={{
                fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary, fontStyle: 'italic', lineHeight: 1.35,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {description}
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── Placed card with drag support ───────────────────────────────────────

function PlacedGridCard({ place, dayNumber, slotId }: { place: ImportedPlace; dayNumber: number; slotId: string }) {
  const { openDetail } = usePlaceDetail();
  const { dragItemId, onDragStartFromSlot } = useTripDrag();
  const unplaceFromSlot = useTripStore(s => s.unplaceFromSlot);
  const setPlaceTime = useTripStore(s => s.setPlaceTime);

  const handleDragActivate = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    onDragStartFromSlot(item, dayNumber, slotId, e);
  }, [onDragStartFromSlot, dayNumber, slotId]);

  const { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, holdingId } = useDragGesture({
    onDragActivate: handleDragActivate,
    onTap: openDetail,
    layout: 'vertical',
    isDragging: !!dragItemId,
  });

  const srcStyle = getSourceStyle(place);

  // Build description from the richest available data
  // If activityContext is present, skip userContext (it's redundant — shown in the banner)
  // specificTime is now rendered via PlaceTimeEditor, no longer needed as description fallback
  const description = (place.userContext && !place.activityContext)
    ? `"${place.userContext}"`
    : place.enrichment?.description
      || place.google?.editorialSummary
      || place.whatToOrder?.[0] && `Order: ${place.whatToOrder[0]}`
      || place.tips?.[0]
      || place.terrazzoInsight?.why
      || '';

  return (
    <GridCard
      variant="placed"
      name={place.name}
      typeLabel={place.type}
      sourceBadge={srcStyle}
      matchScore={place.matchScore}
      description={description}
      activityContext={place.activityContext}
      specificTime={place.specificTime}
      specificTimeLabel={place.specificTimeLabel}
      placeType={place.type}
      slotId={slotId}
      onTimeChange={(time, label) => setPlaceTime(dayNumber, slotId, place.id, time, label)}
      onDismiss={() => unplaceFromSlot(dayNumber, slotId, place.id)}
      pointerHandlers={{
        onPointerDown: (e) => handlePointerDown(place, e),
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
      }}
      isHolding={holdingId === place.id}
      isDragging={dragItemId === place.id}
    />
  );
}


// ─── Main GridCell component ─────────────────────────────────────────────

function GridCell({ dayNumber, slot, rowHeight, colWidth, isDesktop, onOpenOverlay }: GridCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const { openDetail: onTapDetail } = usePlaceDetail();
  // TODO: Re-enable when multiplayer collaboration is ready
  // const { suggestions, myRole, onRespondSuggestion } = useTripCollaboration();
  const { dropTarget, onRegisterSlotRef } = useTripDrag();
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const removeQuickEntry = useTripStore(s => s.removeQuickEntry);
  const confirmQuickEntry = useTripStore(s => s.confirmQuickEntry);
  const addQuickEntry = useTripStore(s => s.addQuickEntry);

  const [quickInputOpen, setQuickInputOpen] = React.useState(false);

  const isDropActive = dropTarget?.dayNumber === dayNumber && dropTarget?.slotId === slot.id;

  // ─── Slot selection for proximity-aware pool browsing ───
  const selectSlot = usePoolStore(s => s.selectSlot);
  const currentSlotContext = usePoolStore(s => s.slotContext);
  const isSlotSelected = currentSlotContext?.slotId === slot.id && currentSlotContext?.dayNumber === dayNumber;

  // Register slot rect for drag hit-testing
  // Register slot element for live hit-testing during drag.
  // Pass the element ref so hit-test can call getBoundingClientRect() live
  // instead of relying on cached rects that go stale after scroll.
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    (onRegisterSlotRef as (d: number, s: string, r: DOMRect | null, el?: HTMLElement | null) => void)(
      dayNumber, slot.id, el.getBoundingClientRect(), el
    );
    const report = () => onRegisterSlotRef(dayNumber, slot.id, el.getBoundingClientRect());
    window.addEventListener('resize', report);
    return () => {
      window.removeEventListener('resize', report);
      onRegisterSlotRef(dayNumber, slot.id, null);
    };
  }, [dayNumber, slot.id, onRegisterSlotRef]);

  // TODO: Re-enable when multiplayer collaboration is ready
  // const slotSuggestions = suggestions?.filter(
  //   s => s.targetDay === dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
  // ) || [];

  // Collect all items in priority order for display
  const allItems = useMemo(() => {
    const items: Array<{ type: 'place' | 'quickEntry' | 'ghost'; data: unknown; id: string }> = [];
    for (const p of slot.places) {
      items.push({ type: 'place', data: p, id: p.id });
    }
    for (const qe of (slot.quickEntries || [])) {
      items.push({ type: 'quickEntry', data: qe, id: qe.id });
    }
    for (const g of (slot.ghostItems || [])) {
      items.push({ type: 'ghost', data: g, id: g.id });
    }
    // TODO: Re-enable when multiplayer collaboration is ready
    // for (const sg of slotSuggestions) {
    //   items.push({ type: 'suggestion', data: sg, id: sg.id });
    // }
    return items;
  }, [slot.places, slot.quickEntries, slot.ghostItems]);

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

  // Build slot context for proximity-aware pool browsing
  const handleSelectSlot = useCallback(() => {
    const trip = useTripStore.getState().trips.find(t => t.id === useTripStore.getState().currentTripId);
    const day = trip?.days.find(d => d.dayNumber === dayNumber);
    const slotOrder = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];
    const slotIdx = slotOrder.indexOf(slot.id);

    let before: SlotContext['adjacentPlaces']['before'];
    let after: SlotContext['adjacentPlaces']['after'];

    if (day) {
      for (let i = slotIdx - 1; i >= 0; i--) {
        const s = day.slots.find(sl => sl.id === slotOrder[i]);
        if (s && s.places.length > 0) {
          const p = s.places[s.places.length - 1];
          before = { name: p.name, type: p.type, location: p.location || '' };
          break;
        }
      }
      for (let i = slotIdx + 1; i < slotOrder.length; i++) {
        const s = day.slots.find(sl => sl.id === slotOrder[i]);
        if (s && s.places.length > 0) {
          const p = s.places[0];
          after = { name: p.name, type: p.type, location: p.location || '' };
          break;
        }
      }
    }

    selectSlot({
      slotId: slot.id,
      slotLabel: slot.label,
      dayNumber,
      adjacentPlaces: { before, after },
      suggestedTypes: SLOT_TYPE_AFFINITY[slot.id] || [],
    });
  }, [dayNumber, slot.id, slot.label, selectSlot]);

  // Clicking any cell selects the slot for proximity-aware pool browsing.
  // Clicking an already-selected slot opens the quick entry input.
  const handleCellClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-grid-card]') || (e.target as HTMLElement).closest('button')) return;
    if (quickInputOpen) return;
    if (isSlotSelected) {
      // Already selected — open quick entry
      setQuickInputOpen(true);
    } else {
      handleSelectSlot();
    }
  }, [quickInputOpen, isSlotSelected, handleSelectSlot]);

  /** Fixed-height wrapper to keep all cards uniform */
  const cardSlot = (key: string, children: React.ReactNode, extraProps?: Record<string, string>) => (
    <div key={key} {...extraProps} style={{ height: CARD_H + CARD_GAP, minHeight: CARD_H + CARD_GAP, maxHeight: CARD_H + CARD_GAP, flexShrink: 0 }}>
      {children}
    </div>
  );

  const renderItem = (item: typeof allItems[number]) => {
    switch (item.type) {
      case 'place':
        return cardSlot(item.id, (
          <PlacedGridCard place={item.data as ImportedPlace} dayNumber={dayNumber} slotId={slot.id} />
        ));

      case 'quickEntry': {
        const qe = item.data as import('@/types').QuickEntry;
        const isTentative = qe.status === 'tentative';
        const isResolving = qe.status === 'resolving';
        const timeDesc = qe.specificTime
          ? `${qe.specificTimeLabel ? `${qe.specificTimeLabel} at ` : ''}${qe.specificTime}`
          : '';
        return cardSlot(item.id, (
          <GridCard
            variant="quickEntry"
            name={qe.label}
            typeLabel={isResolving ? 'RESOLVING…' : qe.category?.toUpperCase()}
            description={timeDesc || (isTentative ? 'Tentative entry' : isResolving ? 'Finding place…' : undefined)}
            actionButton={isTentative && confirmQuickEntry ? { label: 'Confirm', onClick: () => confirmQuickEntry(dayNumber, slot.id, qe.id) } : undefined}
            onDismiss={isResolving ? undefined : () => removeQuickEntry(dayNumber, slot.id, qe.id)}
          />
        ));
      }

      case 'ghost': {
        const ghost = item.data as ImportedPlace;
        const gSrc = getSourceStyle(ghost);
        const gNote = ghost.userContext
          ? `"${ghost.userContext}"`
          : ghost.enrichment?.description
            || ghost.google?.editorialSummary
            || ghost.tips?.[0]
            || ghost.terrazzoReasoning?.rationale
            || '';
        return cardSlot(item.id, (
          <GridCard
            variant="ghost"
            name={ghost.name}
            typeLabel={ghost.type}
            sourceBadge={gSrc}
            matchScore={ghost.matchScore}
            description={gNote}
            actionButton={{ label: 'Add', onClick: () => confirmGhost(dayNumber, slot.id, ghost.id) }}
            onDismiss={() => dismissGhost(dayNumber, slot.id, ghost.id)}
            onClick={() => onTapDetail(ghost)}
          />
        ), { 'data-tour': 'ghost-card' });
      }

      // TODO: Re-enable when multiplayer collaboration is ready
      // case 'suggestion': {
      //   const sg = item.data as Suggestion;
      //   const COLLAB_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];
      //   let hash = 0;
      //   for (let i = 0; i < sg.userId.length; i++) hash = ((hash << 5) - hash + sg.userId.charCodeAt(i)) | 0;
      //   const collabColor = COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
      //   const userName = sg.user?.name || sg.user?.email?.split('@')[0] || 'Collaborator';
      //   return cardSlot(item.id, (
      //     <GridCard
      //       variant="suggestion"
      //       name={sg.placeName}
      //       typeLabel={sg.placeType?.toUpperCase()}
      //       description={sg.reason ? `${userName}: "${sg.reason}"` : `Suggested by ${userName}`}
      //       collabColor={collabColor}
      //       actionButton={myRole === 'owner' ? { label: 'Accept', onClick: () => onRespondSuggestion?.(sg.id, 'accepted') } : undefined}
      //       onDismiss={myRole === 'owner' ? () => onRespondSuggestion?.(sg.id, 'rejected') : undefined}
      //     />
      //   ));
      // }

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
        borderRight: `1px solid ${INK['06']}`,
        borderBottom: `1px solid ${INK['06']}`,
        background: isSlotSelected
          ? 'rgba(58,128,136,0.04)'
          : isDropActive
            ? 'rgba(58,128,136,0.06)'
            : 'white',
        borderLeft: isSlotSelected
          ? `3px solid ${COLOR.darkTeal}`
          : isDropActive
            ? `3px solid ${COLOR.darkTeal}`
            : '3px solid transparent',
        transition: 'all 150ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Visible cards */}
      <div className="flex-1 pt-1 overflow-hidden">
        {visibleItems.map(renderItem)}

        {/* Inline quick entry — works in both empty and populated cells */}
        {quickInputOpen && (
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

        {/* Selected slot state — empty cells show "Browsing places" prompt */}
        {isSlotSelected && totalCount === 0 && !quickInputOpen && (
          <div className={`mx-${CARD_PX} rounded flex flex-col items-center justify-center gap-2`} style={{ height: CARD_H, border: `1.5px dashed ${COLOR.darkTeal}`, background: 'rgba(58,128,136,0.03)' }}>
            <span style={{ fontFamily: FONT.sans, fontSize: isDesktop ? 11 : 10, fontWeight: 600, color: COLOR.darkTeal }}>
              Browsing places…
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setQuickInputOpen(true); }}
              className="rounded-md flex items-center gap-1"
              style={{
                fontFamily: FONT.sans, fontSize: 10, fontWeight: 500,
                color: TEXT.secondary, background: INK['04'], border: `1px solid ${INK['10']}`,
                padding: '3px 8px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>+</span> Add entry
            </button>
          </div>
        )}

        {/* Populated selected cells — compact "+ Add entry" button */}
        {isSlotSelected && totalCount > 0 && !quickInputOpen && (
          <div className={`px-${CARD_PX} pb-1.5`}>
            <button
              onClick={(e) => { e.stopPropagation(); setQuickInputOpen(true); }}
              className="w-full rounded flex items-center justify-center gap-1"
              style={{
                fontFamily: FONT.sans, fontSize: 10, fontWeight: 500,
                color: COLOR.darkTeal, background: 'rgba(58,128,136,0.05)',
                border: `1px dashed rgba(58,128,136,0.3)`,
                padding: '5px 8px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>+</span> Add entry
            </button>
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
            border: 'none',
            borderTop: `1px solid ${INK['06']}`,
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 600,
            color: TEXT.secondary,
            letterSpacing: 0.3,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(58,128,136,0.06)';
            e.currentTarget.style.color = COLOR.darkTeal;
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
