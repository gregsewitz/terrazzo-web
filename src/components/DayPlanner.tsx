'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, TimeSlot, Trip, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType, HotelInfo, TransportEvent } from '@/types';
import { SlotContext, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import TimeSlotCard from './TimeSlotCard';
import OverviewItinerary from './OverviewItinerary';
import DaySelector from './DaySelector';
import DayContextBar from './DayContextBar';
import { TransportBanner, TransportInput, getTransportsAfterSlot } from './TransportBanner';
import { FONT, INK } from '@/constants/theme';
import { generateDestColor } from '@/lib/destination-helpers';
import type { Suggestion, Reaction, SlotNoteItem } from '@/stores/collaborationStore';

export type TripViewMode = 'planner' | 'overview' | 'featuredPlaces' | 'activity' | 'dreamBoard';

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
  slotNotes?: SlotNoteItem[];
  myRole?: 'owner' | 'suggester' | 'viewer' | null;
  onRespondSuggestion?: (suggestionId: string, status: 'accepted' | 'rejected') => void;
  onAddReaction?: (placeKey: string, reaction: 'love' | 'not_for_me') => void;
  onAddSlotNote?: (dayNumber: number, slotId: string, content: string) => void;
  onBack?: () => void;
  onShare?: () => void;
  onChat?: () => void;
}

export default function DayPlanner({ viewMode, onSetViewMode, onTapDetail, onOpenUnsorted, onOpenForSlot, dropTarget, onRegisterSlotRef, onDragStartFromSlot, dragItemId, onUnplace, suggestions, reactions, slotNotes, myRole, onRespondSuggestion, onAddReaction, onAddSlotNote, onBack, onShare, onChat }: DayPlannerProps) {
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const reorderDays = useTripStore(s => s.reorderDays);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const setDayHotelInfo = useTripStore(s => s.setDayHotelInfo);
  const setMultipleDaysHotelInfo = useTripStore(s => s.setMultipleDaysHotelInfo);
  const setDayDestination = useTripStore(s => s.setDayDestination);
  const addTransport = useTripStore(s => s.addTransport);
  const removeTransport = useTripStore(s => s.removeTransport);
  const updateTransport = useTripStore(s => s.updateTransport);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const [addingTransport, setAddingTransport] = useState(false);
  const [editingTransportId, setEditingTransportId] = useState<string | null>(null);

  // Reset editing state when switching days
  useEffect(() => {
    setAddingTransport(false);
    setEditingTransportId(null);
  }, [currentDay]);

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
            <h1
              className="text-lg truncate"
              style={{
                fontFamily: FONT.serif,
                fontWeight: 600,
                color: 'var(--t-ink)',
                margin: 0,
              }}
            >
              {trip.name}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="text-[10px]"
              style={{ color: INK['90'], fontFamily: FONT.mono }}
            >
              {trip.startDate && trip.endDate && formatDateRange(trip.startDate, trip.endDate)}
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
          </div>
        </div>

        {/* View Toggle */}
        <div
          className="flex gap-1 mt-2.5 p-0.5 rounded-lg"
          style={{ background: 'var(--t-linen)' }}
        >
          {(myRole
            ? (['overview', 'planner', 'dreamBoard', 'featuredPlaces', 'activity'] as const)
            : (['overview', 'planner', 'dreamBoard', 'featuredPlaces'] as const)
          ).map(mode => (
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
              {mode === 'overview' ? 'Overview' : mode === 'featuredPlaces' ? 'Featured Places' : mode === 'activity' ? 'Activity' : mode === 'dreamBoard' ? 'Dream Board' : 'Day Planner'}
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
        reorderDays={reorderDays}
        setDayDestination={setDayDestination}
        getDestColor={getDestColor}
        uniqueDestinations={uniqueDestinations}
      />

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

      {/* Empty destination nudge — no saved places match this day */}
      {(() => {
        const dest = day.destination;
        if (!dest) return null;
        const destLower = dest.toLowerCase();
        const hasPlacedOrGhost = day.slots.some(s =>
          s.places.length > 0 || (s.ghostItems && s.ghostItems.length > 0)
        );
        if (hasPlacedOrGhost) return null;
        const hasSavedPlaces = myPlaces.some(p =>
          p.isFavorited && p.location?.toLowerCase().includes(destLower)
        );
        if (hasSavedPlaces) return null;
        return (
          <div
            className="mx-3 my-2 px-4 py-3 flex flex-col items-center gap-1.5"
            style={{
              background: `${destColor.accent}08`,
              borderRadius: 12,
              border: `1px dashed ${destColor.accent}30`,
            }}
          >
            <span style={{
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 500,
              color: destColor.text || INK['70'],
              textAlign: 'center',
            }}>
              No saved places in {dest} yet
            </span>
            <span style={{
              fontFamily: FONT.sans,
              fontSize: 11,
              color: INK['50'],
              textAlign: 'center',
            }}>
              Search and save places to start planning this day
            </span>
          </div>
        );
      })()}

      {/* Compact time slots with inter-slot transport banners */}
      <div className="flex flex-col">
        {day.slots.map((slot, idx) => {
          // Filter collaboration data for this slot
          const slotSuggestions = suggestions?.filter(
            s => s.targetDay === day.dayNumber && s.targetSlotId === slot.id && s.status === 'pending'
          ) || [];
          const slotReactions = reactions?.filter(r => {
            // placeKey format: "dayNumber-slotId-placeName"
            return r.placeKey.startsWith(`${day.dayNumber}-${slot.id}-`);
          }) || [];
          const slotNoteItems = slotNotes?.filter(
            n => n.dayNumber === day.dayNumber && n.slotId === slot.id
          ) || [];

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
                suggestions={slotSuggestions}
                reactions={slotReactions}
                slotNoteItems={slotNoteItems}
                myRole={myRole}
                onRespondSuggestion={onRespondSuggestion}
                onAddReaction={onAddReaction}
                onAddSlotNote={onAddSlotNote ? (content: string) => onAddSlotNote(day.dayNumber, slot.id, content) : undefined}
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

      {/* Overview mode: itinerary list grouped by day */}
      {viewMode === 'overview' && (
        <OverviewItinerary trip={trip} onTapDay={(dayNum) => { setCurrentDay(dayNum); onSetViewMode('planner'); }} onTapDetail={onTapDetail} />
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
