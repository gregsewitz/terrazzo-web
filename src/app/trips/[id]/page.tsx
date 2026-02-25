'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import ShareSheet from '@/components/ShareSheet';
import ActivityFeed from '@/components/ActivityFeed';
import DragOverlay from '@/components/DragOverlay';
import ExportToMaps from '@/components/ExportToMaps';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useCollaborationSync } from '@/hooks/useCollaborationSync';
import { INK, FONT } from '@/constants/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import DesktopNav from '@/components/DesktopNav';
import DayBoardView from '@/components/DayBoardView';
import PicksGrid from '@/components/PicksGrid';
import PicksRail from '@/components/PicksRail';
import RightPanel from '@/components/RightPanel';
import DreamBoard from '@/components/DreamBoard';
import GraduateModal from '@/components/GraduateModal';
import TripMapView from '@/components/TripMapView';
import OverviewItinerary from '@/components/OverviewItinerary';
import TripBriefing from '@/components/TripBriefing';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

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
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === 'desktop';
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
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [browseAllOpen, setBrowseAllOpen] = useState(false);
  const [browseAllFilter, setBrowseAllFilter] = useState<PlaceType | undefined>(undefined);
  const [ghostsInjected, setGhostsInjected] = useState(false);
  const [viewMode, setViewMode] = useState<TripViewMode>('planner');
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [desktopView, setDesktopView] = useState<'overview' | 'board' | 'map'>('board');

  // Desktop resizable split
  const [boardHeight, setBoardHeight] = useState(60); // percentage of left workspace
  const resizing = useRef(false);

  // Picks rail resizable width
  const RAIL_MIN = 220;
  const RAIL_MAX = 400;
  const [railWidth, setRailWidth] = useState(250);
  const railResizing = useRef(false);

  // Shared day selector state between PicksRail and DayBoardView
  const [selectedRailDay, setSelectedRailDay] = useState<number | null>(null);

  const handleRailResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    railResizing.current = true;
    const startX = e.clientX;
    const startWidth = railWidth;

    const onMove = (ev: PointerEvent) => {
      if (!railResizing.current) return;
      const delta = ev.clientX - startX;
      setRailWidth(Math.min(RAIL_MAX, Math.max(RAIL_MIN, startWidth + delta)));
    };
    const onUp = () => {
      railResizing.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [railWidth]);

  // Collaboration state
  const collabSuggestions = useCollaborationStore(s => s.suggestions);
  const collabReactions = useCollaborationStore(s => s.reactions);
  const collabSlotNotes = useCollaborationStore(s => s.slotNotes);
  const collabMyRole = useCollaborationStore(s => s.myRole);
  const collabCollaborators = useCollaborationStore(s => s.collaborators);
  const collabActivities = useCollaborationStore(s => s.activities);
  const respondToSuggestion = useCollaborationStore(s => s.respondToSuggestion);
  const addReaction = useCollaborationStore(s => s.addReaction);
  const addSlotNote = useCollaborationStore(s => s.addSlotNote);
  const tripId = params.id as string;

  // Start collaboration sync polling
  useCollaborationSync(tripId, true);

  // ─── DRAG & DROP STATE (mobile only) ───
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
    dragSource.current = null;
    setDragItem(item);
    setDragPos({ x: e.clientX, y: e.clientY });
    latestDragY.current = e.clientY;
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  const handleDragStartFromSlot = useCallback((item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => {
    dragSource.current = { dayNumber, slotId };
    setDragItem(item);
    setDragPos({ x: e.clientX, y: e.clientY });
    latestDragY.current = e.clientY;
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

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
      if (y < rect.top + AUTO_SCROLL_ZONE && y > rect.top - 20) {
        const proximity = 1 - Math.max(0, y - rect.top) / AUTO_SCROLL_ZONE;
        container.scrollTop -= AUTO_SCROLL_SPEED * proximity;
      } else if (y > rect.bottom - AUTO_SCROLL_ZONE && y < rect.bottom + 20) {
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
      const sr = stripRect.current;
      if (sr && dragSource.current) {
        const over = e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom;
        setIsOverStrip(over && !target);
      } else {
        setIsOverStrip(false);
      }
    };
    const handleUp = () => {
      stopAutoScroll();
      const src = dragSource.current;
      if (isOverStrip && src && dragItem) {
        unplaceFromSlot(src.dayNumber, src.slotId, dragItem.id);
        setReturningPlaceId(dragItem.id);
        setTimeout(() => setReturningPlaceId(null), 400);
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (dropTarget && dragItem) {
        if (src) {
          moveToSlot(dragItem, src.dayNumber, src.slotId, dropTarget.dayNumber, dropTarget.slotId);
        } else {
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
        p.isFavorited || p.rating?.reaction === 'enjoyed'
      );
      if (starredPlaces.length > 0) {
        injectGhostCandidates(starredPlaces);
      }
      setGhostsInjected(true);
    }
  }, [trip, myPlaces, ghostsInjected, injectGhostCandidates]);

  // ─── Desktop resize handle ───
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startY = e.clientY;
    const startHeight = boardHeight;
    const container = (e.target as HTMLElement).closest('[data-desktop-workspace]');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientY - startY;
      const pctDelta = (delta / containerRect.height) * 100;
      const newHeight = Math.min(85, Math.max(25, startHeight + pctDelta));
      setBoardHeight(newHeight);
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [boardHeight]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <p style={{ color: INK['90'] }}>Trip not found</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DESKTOP LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--t-cream)' }}>
        {/* Desktop top nav */}
        <DesktopNav />

        {/* Trip header bar */}
        <div
          className="flex items-center justify-between px-6 py-2.5"
          style={{ borderBottom: '1px solid var(--t-linen)', background: 'white' }}
        >
          <div className="flex items-center gap-3">
            {/* Breadcrumb */}
            <button
              onClick={() => router.push('/trips')}
              className="bg-transparent border-none cursor-pointer link-hover"
              style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['50'], padding: 0 }}
            >
              Trips
            </button>
            <span style={{ color: INK['20'], fontSize: 12 }}>→</span>
            <h1 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
              {trip.name}
            </h1>
            {trip.status === 'dreaming' && (
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[1px]"
                style={{ background: 'rgba(200,146,58,0.12)', color: '#8a6a2a', fontFamily: FONT.mono }}
              >
                Dreaming
              </span>
            )}
            {(trip.flexibleDates || (trip.startDate && trip.endDate)) && (
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: INK['50'] }}>
                {trip.flexibleDates
                  ? `${trip.days.length} days · flexible`
                  : formatDateRange(trip.startDate!, trip.endDate!)
                }
              </span>
            )}
            {trip.destinations && trip.destinations.length > 0 && (
              <div className="flex items-center gap-1">
                {trip.destinations.map(d => (
                  <span
                    key={d}
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 500,
                      background: INK['04'],
                      color: INK['70'],
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {trip.status !== 'dreaming' && (
              <div
                className="flex rounded-full overflow-hidden"
                style={{ border: '1px solid var(--t-linen)', background: INK['04'] }}
              >
                {([
                  { key: 'overview' as const, label: 'Overview', icon: 'discover' as const },
                  { key: 'board' as const, label: 'Itinerary', icon: 'plan' as const },
                  { key: 'map' as const, label: 'Map', icon: 'location' as const },
                ]).map(tab => {
                  const isActive = desktopView === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setDesktopView(tab.key)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 cursor-pointer"
                      style={{
                        border: 'none',
                        fontFamily: FONT.sans,
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? 'white' : 'transparent',
                        color: isActive ? 'var(--t-ink)' : INK['50'],
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                        borderRadius: isActive ? 20 : 0,
                      }}
                    >
                      <PerriandIcon name={tab.icon} size={13} color={isActive ? 'var(--t-ink)' : INK['40']} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Collaborator avatars */}
            {collabCollaborators.filter(c => c.status === 'accepted').length > 0 && (
              <div className="flex -space-x-2 mr-1" onClick={() => setShowShareSheet(true)} style={{ cursor: 'pointer' }}>
                {collabCollaborators.filter(c => c.status === 'accepted').slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm"
                    style={{
                      background: 'var(--t-linen)',
                      color: 'var(--t-ink)',
                      border: '2px solid white',
                      fontFamily: FONT.sans,
                    }}
                    title={c.name || c.email}
                  >
                    {(c.name || c.email).charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowShareSheet(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer nav-hover"
              style={{
                background: INK['04'],
                border: '1px solid var(--t-linen)',
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 500,
                color: INK['70'],
              }}
            >
              <PerriandIcon name="invite" size={14} color={INK['50']} />
              Share
            </button>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer btn-hover"
              style={{
                background: 'var(--t-ink)',
                border: 'none',
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--t-cream)',
              }}
            >
              <PerriandIcon name="chatBubble" size={14} color="var(--t-cream)" accent="var(--t-cream)" />
              Ask Terrazzo
            </button>
          </div>
        </div>

        {/* Main content area — switches between dream board and planning grid */}
        {trip.status === 'dreaming' ? (
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              {/* Graduation banner */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
                <span className="text-[12px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
                  Ready to set dates and build an itinerary?
                </span>
                <button
                  onClick={() => setShowGraduateModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer btn-hover flex-shrink-0"
                  style={{ background: 'var(--t-verde)', border: 'none', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: 'white' }}
                >
                  <PerriandIcon name="pin" size={13} color="white" />
                  Start Planning
                </button>
              </div>
              <DreamBoard />
            </div>
            <RightPanel activities={collabActivities} />
          </div>
        ) : desktopView === 'overview' ? (
            /* ── OVERVIEW — Editorial Briefing ── */
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto">
                <TripBriefing
                  trip={trip}
                  onTapDay={(dayNum) => { useTripStore.getState().setCurrentDay(dayNum); setDesktopView('board'); }}
                  onTapDetail={openDetail}
                />
              </div>
              <RightPanel activities={collabActivities} />
            </div>
        ) : desktopView === 'map' ? (
            /* ── FULL MAP VIEW ── */
            <div className="flex flex-1 min-h-0">
              <TripMapView onTapDetail={openDetail} variant="desktop" />
            </div>
        ) : (
            /* ── ITINERARY BOARD VIEW ── */
            <div className="flex flex-1 min-h-0">
              {/* ── LEFT: PICKS RAIL ── */}
              <PicksRail
                onTapDetail={openDetail}
                width={railWidth}
                onResizeStart={handleRailResizeStart}
                onUnplace={(placeId, fromDay, fromSlot) => unplaceFromSlot(fromDay, fromSlot, placeId)}
                selectedDay={selectedRailDay}
                onSelectedDayChange={setSelectedRailDay}
              />

              {/* ── CENTER: ITINERARY BOARD ── */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <DayBoardView
                  onTapDetail={openDetail}
                  suggestions={collabSuggestions}
                  reactions={collabReactions}
                  slotNotes={collabSlotNotes}
                  myRole={collabMyRole}
                  onRespondSuggestion={(id, status) => respondToSuggestion(tripId, id, status)}
                  onAddReaction={(key, reaction) => addReaction(tripId, key, reaction)}
                  onAddSlotNote={(day, slot, content) => addSlotNote(tripId, day, slot, content)}
                  onDropPlace={(placeId, dayNumber, slotId) => {
                    const place = myPlaces.find(p => p.id === placeId);
                    if (place) placeFromSaved(place, dayNumber, slotId);
                  }}
                  onMovePlace={(placeId, fromDay, fromSlot, toDay, toSlot) => {
                    const place = myPlaces.find(p => p.id === placeId);
                    if (place) moveToSlot(place, fromDay, fromSlot, toDay, toSlot);
                  }}
                  onUnplace={(placeId, dayNumber, slotId) => {
                    unplaceFromSlot(dayNumber, slotId, placeId);
                  }}
                  onDaySelect={setSelectedRailDay}
                  selectedDay={selectedRailDay}
                />
              </div>

              {/* ── RIGHT: COLLAPSIBLE MAP & NOTES ── */}
              <RightPanel activities={collabActivities} />
            </div>
        )}

        {/* Overlays shared between mobile/desktop */}
        {browseAllOpen && (
          <BrowseAllOverlay
            onClose={() => { setBrowseAllOpen(false); setBrowseAllFilter(undefined); }}
            onTapDetail={(item) => { setBrowseAllOpen(false); setBrowseAllFilter(undefined); openDetail(item); }}
            initialFilter={browseAllFilter}
          />
        )}
        {importOpen && (
          <ImportDrawer onClose={() => { importPatch({ isOpen: false }); resetImport(); }} />
        )}
        {exportOpen && (
          <ExportToMaps
            places={myPlaces.filter(p => p.isFavorited)}
            collectionName={trip.name}
            onClose={() => setExportOpen(false)}
          />
        )}
        {showShareSheet && trip && (
          <ShareSheet
            resourceType="trip"
            resourceId={trip.id}
            resourceName={trip.name}
            onClose={() => setShowShareSheet(false)}
          />
        )}
        {showGraduateModal && (
          <GraduateModal onClose={() => setShowGraduateModal(false)} />
        )}
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  MOBILE LAYOUT (existing — unchanged)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="relative flex flex-col"
      style={{
        height: '100dvh',
        background: 'var(--t-cream)',
        maxWidth: 480,
        margin: '0 auto',
        touchAction: dragItem ? 'none' : 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Main content — fills available space between top and tab bar */}
      <div className="flex-1 flex flex-col min-h-0">
        {trip.status === 'dreaming' ? (
          /* Dreaming mode — dream board thinking space */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Dreaming header — back + trip name + actions */}
            <div
              className="flex items-center justify-between px-3 py-2 flex-shrink-0"
              style={{ background: 'white', borderBottom: '1px solid var(--t-linen)' }}
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <button
                  onClick={() => router.push('/trips')}
                  className="flex items-center justify-center flex-shrink-0 bg-transparent border-none cursor-pointer"
                  style={{ width: 28, height: 28, padding: 0 }}
                  title="Back to trips"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK['50']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <h1
                  className="text-[16px] truncate"
                  style={{ fontFamily: FONT.serif, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}
                >
                  {trip.name}
                </h1>
                <span
                  className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-[0.5px] flex-shrink-0"
                  style={{ background: 'rgba(200,146,58,0.12)', color: '#8a6a2a', fontFamily: FONT.mono }}
                >
                  Dreaming
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setShowShareSheet(true)}
                  className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center"
                  style={{ background: INK['04'], color: 'var(--t-verde)' }}
                  title="Share trip"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
                <button
                  onClick={() => setChatOpen(true)}
                  className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center"
                  style={{ background: 'var(--t-ink)', color: 'var(--t-cream)' }}
                  title="Ask Terrazzo"
                >
                  <PerriandIcon name="chatBubble" size={14} color="var(--t-cream)" accent="var(--t-cream)" />
                </button>
              </div>
            </div>
            {/* Graduation banner */}
            <div className="flex items-center justify-center px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
              <button
                onClick={() => setShowGraduateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer"
                style={{ background: 'var(--t-verde)', border: 'none', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: 'white' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Ready to start planning?
              </button>
            </div>
            <DreamBoard />
          </div>
        ) : viewMode === 'mapView' ? (
          /* ── MAP VIEW — takes full available space ── */
          <>
            {/* Minimal header with view toggle */}
            <DayPlanner
              viewMode={viewMode}
              onSetViewMode={setViewMode}
              onTapDetail={openDetail}
              onOpenUnsorted={() => {}}
              dropTarget={null}
              onRegisterSlotRef={handleRegisterSlotRef}
              onDragStartFromSlot={handleDragStartFromSlot}
              dragItemId={null}
              onUnplace={handleUnplace}
              onBack={() => router.push('/trips')}
              onShare={() => setShowShareSheet(true)}
              onChat={() => setChatOpen(true)}
            />
            <div className="flex-1 flex flex-col min-h-0">
              <TripMapView onTapDetail={openDetail} variant="mobile" />
            </div>
          </>
        ) : (
          <>
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
            suggestions={collabSuggestions}
            reactions={collabReactions}
            slotNotes={collabSlotNotes}
            myRole={collabMyRole}
            onRespondSuggestion={(suggestionId, status) => respondToSuggestion(tripId, suggestionId, status)}
            onAddReaction={(placeKey, reaction) => addReaction(tripId, placeKey, reaction)}
            onAddSlotNote={(dayNumber, slotId, content) => addSlotNote(tripId, dayNumber, slotId, content)}
            onBack={() => router.push('/trips')}
            onShare={() => setShowShareSheet(true)}
            onChat={() => setChatOpen(true)}
          />

          {/* Featured Places — all placed items across itinerary */}
          {viewMode === 'featuredPlaces' && (
            <TripMyPlaces onTapDetail={openDetail} />
          )}

          {/* Activity Feed — collaboration timeline */}
          {viewMode === 'activity' && (
            <ActivityFeed activities={collabActivities} />
          )}

          {viewMode === 'dreamBoard' && (
            <DreamBoard />
          )}
        </div>

        {/* Picks Strip — pinned at bottom above tab bar */}
        {viewMode === 'planner' && (
          <div className="flex-shrink-0" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))', minWidth: 0, width: '100%' }}>
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
          </>
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
          places={myPlaces.filter(p => p.isFavorited)}
          collectionName={trip.name}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Share Sheet */}
      {showShareSheet && trip && (
        <ShareSheet
          resourceType="trip"
          resourceId={trip.id}
          resourceName={trip.name}
          onClose={() => setShowShareSheet(false)}
        />
      )}

      {/* Graduate Modal (dreaming → planning) */}
      {showGraduateModal && (
        <GraduateModal onClose={() => setShowGraduateModal(false)} />
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

// Helper to format ISO date range
function formatDateRange(startDate: string, endDate: string): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const normalize = (d: string) => new Date(d.split('T')[0] + 'T00:00:00');
  const s = normalize(startDate);
  const e = normalize(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  const sMonth = monthNames[s.getMonth()];
  const eMonth = monthNames[e.getMonth()];
  if (sMonth === eMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}`;
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
}
