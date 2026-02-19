'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { useImportStore } from '@/stores/importStore';
import type { SlotContext } from '@/stores/poolStore';
import { ImportedPlace, PlaceRating, PlaceType } from '@/types';
import TabBar from '@/components/TabBar';
import DayPlanner from '@/components/DayPlanner';
import type { TripViewMode, DropTarget } from '@/components/DayPlanner';
import TripMyPlaces from '@/components/TripMyPlaces';
import PicksStrip from '@/components/PicksStrip';
import BrowseAllOverlay from '@/components/BrowseAllOverlay';
import ImportDrawer from '@/components/ImportDrawer';
import ChatSidebar from '@/components/ChatSidebar';
import DragOverlay from '@/components/DragOverlay';
import ExportToMaps from '@/components/ExportToMaps';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { INK } from '@/constants/theme';

// ─── Auto-scroll config for drag near edges ───
const AUTO_SCROLL_ZONE = 60;   // px from edge where auto-scroll activates
const AUTO_SCROLL_SPEED = 6;   // px per frame at max proximity

export default function TripDetailPage() {
  const ratePlace = useTripStore(s => s.ratePlace);
  return (
    <PlaceDetailProvider config={{
      onRate: (place, rating) => ratePlace(place.id, rating),
    }}>
      <TripDetailContent />
    </PlaceDetailProvider>
  );
}

function TripDetailContent() {
  const params = useParams();
  const { openDetail } = usePlaceDetail();
  const setCurrentTrip = useTripStore(s => s.setCurrentTrip);
  const placeFromSaved = useTripStore(s => s.placeFromSaved);
  const moveToSlot = useTripStore(s => s.moveToSlot);
  const unplaceFromSlot = useTripStore(s => s.unplaceFromSlot);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const importOpen = useImportStore(s => s.isOpen);
  const importPatch = useImportStore(s => s.patch);
  const resetImport = useImportStore(s => s.reset);
  const [chatOpen, setChatOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [browseAllOpen, setBrowseAllOpen] = useState(false);
  const [browseAllFilter, setBrowseAllFilter] = useState<PlaceType | undefined>(undefined);
  const [ghostsInjected, setGhostsInjected] = useState(false);
  const [viewMode, setViewMode] = useState<TripViewMode>('planner');

  // ─── DRAG & DROP STATE ───
  const [dragItem, setDragItem] = useState<ImportedPlace | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isOverStrip, setIsOverStrip] = useState(false);
  const [returningPlaceId, setReturningPlaceId] = useState<string | null>(null);
  const slotRects = useRef<Map<string, { dayNumber: number; slotId: string; rect: DOMRect }>>(new Map());
  const stripRect = useRef<DOMRect | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const latestDragY = useRef<number>(0);
  // Track where the drag originated — null means from pick strip, { day, slotId } means from a slot
  const dragSource = useRef<{ dayNumber: number; slotId: string } | null>(null);

  const handleRegisterSlotRef = useCallback((dayNumber: number, slotId: string, rect: DOMRect | null) => {
    const key = `${dayNumber}-${slotId}`;
    if (rect) {
      slotRects.current.set(key, { dayNumber, slotId, rect });
    } else {
      slotRects.current.delete(key);
    }
  }, []);

  const handleRegisterStripRect = useCallback((rect: DOMRect | null) => {
    stripRect.current = rect;
  }, []);

  // Refresh all slot rects from DOM — needed during auto-scroll
  const refreshSlotRects = useCallback(() => {
    // The slot rects auto-refresh via scroll listeners in TimeSlotCard
    // but we can force a sync re-read here
  }, []);

  const hitTestSlots = useCallback((x: number, y: number): DropTarget | null => {
    for (const [, entry] of slotRects.current) {
      const { rect, dayNumber, slotId } = entry;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { dayNumber, slotId };
      }
    }
    return null;
  }, []);

  const handleDragStart = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    dragSource.current = null; // from pick strip
    setDragItem(item);
    setDragPos({ x: e.clientX, y: e.clientY });
    latestDragY.current = e.clientY;
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const handleDragStartFromSlot = useCallback((item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => {
    dragSource.current = { dayNumber, slotId }; // from a time slot
    setDragItem(item);
    setDragPos({ x: e.clientX, y: e.clientY });
    latestDragY.current = e.clientY;
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  // Remove from slot → animate return to picks strip
  const handleUnplace = useCallback((placeId: string, dayNumber: number, slotId: string) => {
    unplaceFromSlot(dayNumber, slotId, placeId);
    setReturningPlaceId(placeId);
    setTimeout(() => setReturningPlaceId(null), 400);
  }, [unplaceFromSlot]);

  // ─── Auto-scroll loop during drag ───
  const startAutoScroll = useCallback(() => {
    const scroll = () => {
      const container = scrollContainerRef.current;
      if (!container) { autoScrollRaf.current = null; return; }

      const rect = container.getBoundingClientRect();
      const y = latestDragY.current;

      // Near top edge — scroll up
      if (y < rect.top + AUTO_SCROLL_ZONE && y > rect.top - 20) {
        const proximity = 1 - Math.max(0, y - rect.top) / AUTO_SCROLL_ZONE;
        container.scrollTop -= AUTO_SCROLL_SPEED * proximity;
      }
      // Near bottom edge — scroll down
      else if (y > rect.bottom - AUTO_SCROLL_ZONE && y < rect.bottom + 20) {
        const proximity = 1 - Math.max(0, rect.bottom - y) / AUTO_SCROLL_ZONE;
        container.scrollTop += AUTO_SCROLL_SPEED * proximity;
      }

      autoScrollRaf.current = requestAnimationFrame(scroll);
    };
    autoScrollRaf.current = requestAnimationFrame(scroll);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current != null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  }, []);

  // Global pointer move / up while dragging
  useEffect(() => {
    if (!dragItem) return;

    startAutoScroll();

    const handleMove = (e: PointerEvent) => {
      e.preventDefault();
      setDragPos({ x: e.clientX, y: e.clientY });
      latestDragY.current = e.clientY;
      const target = hitTestSlots(e.clientX, e.clientY);
      setDropTarget(target);

      // Check if hovering over the picks strip (only relevant when dragging from a slot)
      const sr = stripRect.current;
      if (sr && dragSource.current) {
        const over = e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom;
        setIsOverStrip(over && !target); // slot takes priority
      } else {
        setIsOverStrip(false);
      }
    };

    const handleUp = () => {
      stopAutoScroll();

      const src = dragSource.current;

      if (isOverStrip && src && dragItem) {
        // Dropping from slot back onto picks strip — unplace it
        unplaceFromSlot(src.dayNumber, src.slotId, dragItem.id);
        setReturningPlaceId(dragItem.id);
        setTimeout(() => setReturningPlaceId(null), 400);
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (dropTarget && dragItem) {
        if (src) {
          // Dragging from one slot to another
          moveToSlot(dragItem, src.dayNumber, src.slotId, dropTarget.dayNumber, dropTarget.slotId);
        } else {
          // Dragging from pick strip
          placeFromSaved(dragItem, dropTarget.dayNumber, dropTarget.slotId);
        }
        if (navigator.vibrate) navigator.vibrate(15);
      }

      dragSource.current = null;
      setDragItem(null);
      setDragPos(null);
      setDropTarget(null);
      setIsOverStrip(false);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      stopAutoScroll();
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragItem, dropTarget, isOverStrip, hitTestSlots, placeFromSaved, moveToSlot, unplaceFromSlot, startAutoScroll, stopAutoScroll]);

  useEffect(() => {
    if (params.id) {
      setCurrentTrip(params.id as string);
    }
  }, [params.id, setCurrentTrip]);

  // On trip load, inject starred My Places as ghost candidates (once)
  useEffect(() => {
    if (trip && !ghostsInjected) {
      const starredPlaces = myPlaces.filter(p =>
        p.isShortlisted || p.rating?.reaction === 'enjoyed'
      );
      if (starredPlaces.length > 0) {
        injectGhostCandidates(starredPlaces);
      }
      setGhostsInjected(true);
    }
  }, [trip, myPlaces, ghostsInjected, injectGhostCandidates]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <p style={{ color: INK['90'] }}>Trip not found</p>
      </div>
    );
  }


  return (
    <div
      className="h-screen relative flex flex-col"
      style={{
        background: 'var(--t-cream)',
        maxWidth: 480,
        margin: '0 auto',
        touchAction: dragItem ? 'none' : 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Top-right action pill */}
      <div className="fixed top-4 right-4 z-30">
        <button
          onClick={() => setChatOpen(true)}
          className="w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center text-sm shadow-md"
          style={{ background: 'var(--t-ink)', color: 'var(--t-cream)' }}
          title="Ask Terrazzo"
        >
          💬
        </button>
      </div>

      {/* Main content — fills available space between top and tab bar */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Day Planner (includes header + 3-way toggle for all modes) */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
          <DayPlanner
            viewMode={viewMode}
            onSetViewMode={setViewMode}
            onTapDetail={openDetail}
            onOpenUnsorted={() => { setBrowseAllFilter(undefined); setBrowseAllOpen(true); }}
            onOpenForSlot={(ctx: SlotContext) => {
              setBrowseAllFilter(ctx.suggestedTypes?.[0] as PlaceType | undefined);
              setBrowseAllOpen(true);
            }}
            dropTarget={dropTarget}
            onRegisterSlotRef={handleRegisterSlotRef}
            onDragStartFromSlot={handleDragStartFromSlot}
            dragItemId={dragItem?.id ?? null}
            onUnplace={handleUnplace}
          />

          {/* Trip Places — all placed items across itinerary */}
          {viewMode === 'myPlaces' && (
            <TripMyPlaces onTapDetail={openDetail} />
          )}
        </div>

        {/* Picks Strip — pinned at bottom above tab bar */}
        {viewMode === 'planner' && (
          <div className="flex-shrink-0" style={{ paddingBottom: 90, minWidth: 0, width: '100%' }}>
            <PicksStrip
              onTapDetail={openDetail}
              onBrowseAll={() => { setBrowseAllFilter(undefined); setBrowseAllOpen(true); }}
              onDragStart={handleDragStart}
              dragItemId={dragItem?.id ?? null}
              isDropTarget={isOverStrip}
              onRegisterRect={handleRegisterStripRect}
              returningPlaceId={returningPlaceId}
            />
          </div>
        )}
      </div>

      {/* Browse All Overlay — full list access from picks strip */}
      {browseAllOpen && (
        <BrowseAllOverlay
          onClose={() => { setBrowseAllOpen(false); setBrowseAllFilter(undefined); }}
          onTapDetail={(item) => { setBrowseAllOpen(false); setBrowseAllFilter(undefined); openDetail(item); }}
          initialFilter={browseAllFilter}
        />
      )}

      {/* Drag Overlay — floating card following pointer */}
      {dragItem && dragPos && (
        <DragOverlay
          item={dragItem}
          x={dragPos.x}
          y={dragPos.y}
          isOverTarget={!!dropTarget}
        />
      )}

      {/* Tab Bar */}
      <TabBar />

      {/* PlaceDetailSheet, RatingSheet, BriefingView, AddToShortlistSheet
           are all rendered by PlaceDetailProvider — no duplication needed */}

      {/* Import Drawer */}
      {importOpen && (
        <ImportDrawer
          onClose={() => {
            importPatch({ isOpen: false });
            resetImport();
          }}
        />
      )}

      {/* Export to Maps */}
      {exportOpen && (
        <ExportToMaps
          places={myPlaces.filter(p => p.isShortlisted)}
          collectionName={trip.name}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        tripContext={trip ? {
          name: trip.name,
          destinations: trip.destinations || [trip.location],
          totalDays: trip.days.length,
          currentDay: trip.days[0] ? {
            dayNumber: trip.days[0].dayNumber,
            destination: trip.days[0].destination,
            slots: trip.days[0].slots.map(s => ({
              label: s.label,
              place: s.places[0] ? {
                name: s.places[0].name,
                type: s.places[0].type,
                matchScore: s.places[0].matchScore,
              } : undefined,
            })),
            hotel: trip.days[0].hotel,
          } : undefined,
        } : undefined}
      />
    </div>
  );
}
