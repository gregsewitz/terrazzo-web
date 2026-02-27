'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, TimeSlot, Trip, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType, HotelInfo, TransportEvent } from '@/types';
import { SlotContext, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import TimeSlotCard from './TimeSlotCard';
import OverviewItinerary from './OverviewItinerary';
import TripBriefing from './TripBriefing';
import DaySelector from './DaySelector';
import DayContextBar from './DayContextBar';
import { TransportBanner, TransportInput, getTransportsAfterSlot } from './TransportBanner';
import { FONT, INK } from '@/constants/theme';
import { generateDestColor } from '@/lib/destination-helpers';
import EditableTripName from './EditableTripName';
import DayContextMenu from './DayContextMenu';
import type { Suggestion, Reaction } from '@/stores/collaborationStore';
import { useTripSuggestions } from '@/hooks/useTripSuggestions';

export type TripViewMode = 'planner' | 'overview' | 'mapView' | 'featuredPlaces' | 'dreamBoard';

export interface DropTarget {
  dayNumber: number;
  slotId: string;
}

interface DayPlannerProps {
  viewMode: TripViewMode;
  onSetViewMode: (mode: TripViewMode) => void;
  onTapDetail: (item: ImportedPlace) => void;
  onOpenUnsorted: () => void;
  onOpenForSlot?: (ctx: SlotContext) => void;
  dropTarget?: DropTarget | null;
  onRegisterSlotRef?: (dayNumber: number, slotId: string, rect: DOMRect | null) => void;
  onDragStartFromSlot?: (item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => void;
  dragItemId?: string | null;
  /** Called when a place is removed from a slot (× button) — parent can animate the return */
  onUnplace?: (placeId: string, dayNumber: number, slotId: string) => void;
  // Collaboration props
  suggestions?: Suggestion[];
  reactions?: Reaction[];
  myRole?: 'owner' | 'suggester' | 'viewer' | null;
  onRespondSuggestion?: (suggestionId: string, status: 'accepted' | 'rejected') => void;
  onAddReaction?: (placeKey: string, reaction: 'love' | 'not_for_me') => void;
  onBack?: () => void;
  onShare?: () => void;
  onChat?: () => void;
  onDelete?: () => void;
}

export default function DayPlanner({ viewMode, onSetViewMode, onTapDetail, onOpenUnsorted, onOpenForSlot, dropTarget, onRegisterSlotRef, onDragStartFromSlot, dragItemId, onUnplace, suggestions, reactions, myRole, onRespondSuggestion, onAddReaction, onBack, onShare, onChat, onDelete }: DayPlannerProps) {
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const reorderDays = useTripStore(s => s.reorderDays);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const setDayHotelInfo = useTripStore(s => s.setDayHotelInfo);
  const setMultipleDaysHotelInfo = useTripStore(s => s.setMultipleDaysHotelInfo);
  const setDayDestination = useTripStore(s => s.setDayDestination);
  const renameTrip = useTripStore(s => s.renameTrip);
  const deleteDay = useTripStore(s => s.deleteDay);
  const insertDay = useTripStore(s => s.insertDay);
  const duplicateDay = useTripStore(s => s.duplicateDay);
  const clearDay = useTripStore(s => s.clearDay);
  const addTransport = useTripStore(s => s.addTransport);
  const removeTransport = useTripStore(s => s.removeTransport);
  const updateTransport = useTripStore(s => s.updateTransport);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  // ─── Swipe navigation between days ───
  const swipeRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeLocked = useRef<'x' | 'y' | null>(null);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swipeLocked.current = null;
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!swipeStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStart.current.x;
    const dy = touch.clientY - swipeStart.current.y;
    if (!swipeLocked.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeStart.current || !trip) { swipeStart.current = null; return; }
    const touch = e.changedTouches[0];
    const dx = touch.clientX - swipeStart.current.x;
    const elapsed = Date.now() - swipeStart.current.time;
    if (swipeLocked.current === 'x' && Math.abs(dx) > 50 && elapsed < 500) {
      if (dx < 0 && currentDay < trip.days.length) {
        setCurrentDay(currentDay + 1);
      } else if (dx > 0 && currentDay > 1) {
        setCurrentDay(currentDay - 1);
      }
    }
    swipeStart.current = null;
    swipeLocked.current = null;
  }, [currentDay, setCurrentDay, trip]);

  const [addingTransport, setAddingTransport] = useState(false);
  const [editingTransportId, setEditingTransportId] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
  const [showDayContextMenu, setShowDayContextMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Reset editing state when switching days
  useEffect(() => {
    setAddingTransport(false);
    setEditingTransportId(null);
  }, [currentDay]);

  // Close header menu on outside click
  useEffect(() => {
    if (!showHeaderMenu) return;
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHeaderMenu]);

  // Gather unique destinations for the picker
  const uniqueDestinations = useMemo(() => {
    if (!trip) return [];
    const dests = new Set<string>();
    trip.days.forEach(d => { if (d.destination) dests.add(d.destination); });
    return Array.from(dests);
  }, [trip]);

  // Get destination color with hash-based fallback for new destinations
  const getDestColor = useCallback((dest: string) => {
    return DEST_COLORS[dest] || generateDestColor(dest);
  }, []);

  // Check if the current day's destination has any saved places
  const myPlaces = useSavedStore(s => s.myPlaces);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);

  // ─── Tier 2: Claude-powered contextual suggestions ───
  const { suggestions: claudeSuggestions, isLoading: suggestionsLoading } = useTripSuggestions(
    trip ?? null, currentDay,
    { enabled: true, libraryPlaces: myPlaces }
  );

  // Inject Claude suggestions into slot.ghostItems when they arrive
  const lastInjectedKeyRef = useRef<string>('');
  useEffect(() => {
    if (!claudeSuggestions.length || !myPlaces.length) return;

    // Build a key to avoid re-injecting the same suggestions
    const key = claudeSuggestions.map(s => s.placeId).sort().join(',');
    if (key === lastInjectedKeyRef.current) return;
    lastInjectedKeyRef.current = key;

    // Enrich suggestion items with full place data + ghost metadata
    const ghostPlaces = claudeSuggestions
      .map(s => {
        const place = myPlaces.find(p => p.id === s.placeId);
        if (!place) return null;
        return {
          ...place,
          id: `ghost-claude-${place.id}`,
          ghostSource: 'terrazzo' as const,
          ghostStatus: 'proposed' as const,
          terrazzoReasoning: { rationale: s.rationale, confidence: s.confidence },
        };
      })
      .filter(Boolean) as ImportedPlace[];

    if (ghostPlaces.length > 0) {
      injectGhostCandidates(ghostPlaces);
    }
  }, [claudeSuggestions, myPlaces, injectGhostCandidates]);

  if (!trip) return null;

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];
  if (!day) return null;

  const destColor = getDestColor(day.destination || '');

  return (
    <div style={{ background: 'var(--t-cream)' }}>
      {/* Compact Trip Header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ background: 'white' }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center flex-shrink-0 bg-transparent border-none cursor-pointer"
                style={{ width: 28, height: 28, padding: 0, marginLeft: -6 }}
                title="Back to trips"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK['50']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <EditableTripName
              name={trip.name}
              onRename={(newName) => renameTrip(trip.id, newName)}
              className="text-lg truncate"
              style={{
                fontFamily: FONT.serif,
                fontWeight: 600,
                color: 'var(--t-ink)',
                margin: 0,
                display: 'block',
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="text-[10px]"
              style={{ color: INK['90'], fontFamily: FONT.mono }}
            >
              {trip.flexibleDates
                ? `${trip.days.length} days · dates flexible`
                : (trip.startDate && trip.endDate && formatDateRange(trip.startDate, trip.endDate))
              }
            </span>
            {onShare && (
              <button
                onClick={onShare}
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
            )}
            {onChat && (
              <button
                onClick={onChat}
                className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center"
                style={{ background: 'var(--t-ink)', color: 'var(--t-cream)' }}
                title="Ask Terrazzo"
              >
                <PerriandIcon name="chatBubble" size={14} color="var(--t-cream)" accent="var(--t-cream)" />
              </button>
            )}
            {/* Overflow menu */}
            {onDelete && (
              <div className="relative" ref={headerMenuRef}>
                <button
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center"
                  style={{ background: INK['04'] }}
                  title="More options"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={INK['50']}>
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
                {showHeaderMenu && (
                  <div
                    className="absolute right-0 mt-1 py-1 rounded-lg shadow-lg z-50"
                    style={{
                      background: 'white',
                      border: '1px solid var(--t-linen)',
                      minWidth: 160,
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        onDelete();
                      }}
                      className="w-full text-left px-3 py-2 border-none cursor-pointer flex items-center gap-2"
                      style={{
                        background: 'none',
                        fontFamily: FONT.sans,
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--t-signal-red, #d63020)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete trip
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div
          className="flex gap-1 mt-2.5 p-0.5 rounded-lg"
          style={{ background: 'var(--t-linen)' }}
        >
          {(['overview', 'planner', 'mapView', 'dreamBoard'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onSetViewMode(mode)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: viewMode === mode ? 'white' : 'transparent',
                color: viewMode === mode ? 'var(--t-ink)' : INK['90'],
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {mode === 'overview' ? 'Overview' : mode === 'mapView' ? 'Map' : mode === 'dreamBoard' ? 'Dream Board' : 'Day\u00A0Planner'}
            </button>
          ))}
        </div>
      </div>

      {/* Planner mode: calendar tabs + context bar + time slots */}
      {viewMode === 'planner' && <>

      {/* Calendar-style day selector strip */}
      <DaySelector
        trip={trip}
        currentDay={currentDay}
        setCurrentDay={setCurrentDay}
        getDestColor={getDestColor}
        onOpenDayMenu={() => setShowDayContextMenu(true)}
        onDayLongPress={(dayNum) => { setCurrentDay(dayNum); setShowDayContextMenu(true); }}
      />

      {/* Day context menu — triggered by "..." button or long-press on DaySelector */}
      {showDayContextMenu && (
        <DayContextMenu
          dayNumber={currentDay}
          dayCount={trip.days.length}
          variant="sheet"
          onAddBefore={() => insertDay('before', currentDay)}
          onAddAfter={() => insertDay('after', currentDay)}
          onDuplicate={() => duplicateDay(currentDay)}
          onClear={() => clearDay(currentDay)}
          onDelete={() => { setShowDayContextMenu(false); setShowDeleteDayConfirm(true); }}
          onClose={() => setShowDayContextMenu(false)}
          onMoveEarlier={() => reorderDays(currentDay, currentDay - 1)}
          onMoveLater={() => reorderDays(currentDay, currentDay + 1)}
          currentDestination={day.destination}
          uniqueDestinations={uniqueDestinations}
          getDestColor={getDestColor}
          onChangeDestination={(dest) => setDayDestination(currentDay, dest)}
        />
      )}

      {/* Active day context bar — hotel + map toggle */}
      <DayContextBar
        day={day}
        trip={trip}
        currentDay={currentDay}
        destColor={destColor}
        onTapDetail={onTapDetail}
        setDayHotelInfo={setDayHotelInfo}
        setMultipleDaysHotelInfo={setMultipleDaysHotelInfo}
        addTransport={addTransport}
        removeTransport={removeTransport}
        updateTransport={updateTransport}
        addingTransport={addingTransport}
        setAddingTransport={setAddingTransport}
        editingTransportId={editingTransportId}
        setEditingTransportId={setEditingTransportId}
      />


      {/* Compact time slots with inter-slot transport banners — swipeable */}
      <div
        ref={swipeRef}
        className="flex flex-col"
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        {day.slots.map((slot, idx) => {
          // Filter collaboration data for this slot
          const slotSuggestions = suggestions?.filter(
            s => s.targetDay === day.dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
          ) || [];
          const slotReactions = reactions?.filter(r => {
            // placeKey format: "dayNumber-slotId-placeName"
            return r.placeKey.startsWith(`${day.dayNumber}-${slot.id}-`);
          }) || [];
          // Notes module removed — collaboration mode not yet implemented

          // Transport banners that should appear AFTER this slot
          const transportsAfter = !addingTransport
            ? getTransportsAfterSlot(day.transport, slot.id)
            : [];

          return (
            <div key={slot.id}>
              <TimeSlotCard
                slot={slot}
                dayNumber={day.dayNumber}
                destColor={destColor}
                onTapDetail={onTapDetail}
                onOpenUnsorted={onOpenUnsorted}
                onOpenForSlot={onOpenForSlot}
                allSlots={day.slots}
                slotIndex={idx}
                isDropTarget={dropTarget?.dayNumber === day.dayNumber && dropTarget?.slotId === slot.id}
                onRegisterRef={onRegisterSlotRef
                  ? (rect) => onRegisterSlotRef(day.dayNumber, slot.id, rect)
                  : undefined}
                onDragStartFromSlot={onDragStartFromSlot}
                dragItemId={dragItemId}
                onUnplace={onUnplace}
                isLoadingSuggestions={suggestionsLoading}
                suggestions={slotSuggestions}
                reactions={slotReactions}
                myRole={myRole}
                onRespondSuggestion={onRespondSuggestion}
                onAddReaction={onAddReaction}
              />
              {/* Transport banners positioned after this slot based on departure time */}
              {transportsAfter.map(t => (
                editingTransportId === t.id ? (
                  <TransportInput
                    key={t.id}
                    initial={t}
                    fromDefault={day.destination}
                    onSave={(updates) => {
                      updateTransport(currentDay, t.id, updates);
                      setEditingTransportId(null);
                    }}
                    onCancel={() => setEditingTransportId(null)}
                  />
                ) : (
                  <TransportBanner
                    key={t.id}
                    transport={t}
                    onEdit={() => setEditingTransportId(t.id)}
                    onRemove={() => removeTransport(currentDay, t.id)}
                  />
                )
              ))}
            </div>
          );
        })}
      </div>

      </>}

      {/* Overview mode: editorial trip briefing */}
      {viewMode === 'overview' && (
        <TripBriefing trip={trip} onTapDay={(dayNum) => { setCurrentDay(dayNum); onSetViewMode('planner'); }} onTapDetail={onTapDetail} />
      )}

      {/* Delete day confirmation dialog */}
      {showDeleteDayConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowDeleteDayConfirm(false)}
        >
          <div
            className="rounded-2xl p-6 mx-6"
            style={{ background: 'white', maxWidth: 340, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: FONT.serif, fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: 'var(--t-ink)' }}>
              Remove {day.dayOfWeek ? `${day.dayOfWeek}` : `Day ${currentDay}`}?
            </h3>
            <p style={{ fontFamily: FONT.sans, fontSize: 13, color: INK['70'], margin: '0 0 20px', lineHeight: 1.5 }}>
              {day.destination && <>{day.destination} · </>}
              {day.slots.flatMap(s => s.places).length > 0
                ? 'Placed items will return to your unsorted pool.'
                : 'This day has no placed items.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteDayConfirm(false)}
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
                  setShowDeleteDayConfirm(false);
                  deleteDay(currentDay);
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
      )}
    </div>
  );
}

// Helper to format ISO date range into readable text
function formatDateRange(startDate: string, endDate: string): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Normalize: strip time portion if present, then parse as local date
  const normalize = (d: string) => new Date(d.split('T')[0] + 'T00:00:00');
  const s = normalize(startDate);
  const e = normalize(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  const sMonth = monthNames[s.getMonth()];
  const eMonth = monthNames[e.getMonth()];
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()}–${e.getDate()}`;
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
}
