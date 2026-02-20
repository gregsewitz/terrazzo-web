'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, PlaceType, TimeSlot, Trip, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType } from '@/types';
import { SlotContext, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import GhostCard from './GhostCard';
import CollaboratorGhostCard from './CollaboratorGhostCard';
import ReactionPills from './ReactionPills';
import SlotNoteBubble from './SlotNoteBubble';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';
import { FONT, INK } from '@/constants/theme';
import type { Suggestion, Reaction, SlotNoteItem } from '@/stores/collaborationStore';

export type TripViewMode = 'planner' | 'overview' | 'myPlaces' | 'activity';

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
}

export default function DayPlanner({ viewMode, onSetViewMode, onTapDetail, onOpenUnsorted, onOpenForSlot, dropTarget, onRegisterSlotRef, onDragStartFromSlot, dragItemId, onUnplace, suggestions, reactions, slotNotes, myRole, onRespondSuggestion, onAddReaction, onAddSlotNote }: DayPlannerProps) {
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const setDayHotel = useTripStore(s => s.setDayHotel);
  const setMultipleDaysHotel = useTripStore(s => s.setMultipleDaysHotel);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const [dayMapOpen, setDayMapOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState(false);
  const [hotelDraft, setHotelDraft] = useState('');
  const [propagationPrompt, setPropagationPrompt] = useState<{ hotel: string; dayNumbers: number[]; destination: string } | null>(null);
  const hotelInputRef = useRef<HTMLInputElement>(null);
  // Focus hotel input when entering edit mode
  useEffect(() => {
    if (editingHotel && hotelInputRef.current) {
      hotelInputRef.current.focus();
    }
  }, [editingHotel]);

  // Reset hotel editing state when switching days
  useEffect(() => {
    setEditingHotel(false);
    setHotelDraft('');
    setPropagationPrompt(null);
  }, [currentDay]);

  const handleHotelSave = useCallback(() => {
    if (!trip) return;
    const trimmed = hotelDraft.trim();
    const dayObj = trip.days.find(d => d.dayNumber === currentDay);
    if (!dayObj) return;

    setDayHotel(currentDay, trimmed);
    setEditingHotel(false);

    // Smart propagation: find contiguous same-destination days without a hotel set
    if (trimmed && dayObj.destination) {
      const dest = dayObj.destination;
      const eligibleDays: number[] = [];

      // Scan forward from current day
      for (let i = currentDay + 1; i <= trip.days.length; i++) {
        const d = trip.days.find(td => td.dayNumber === i);
        if (d && d.destination === dest && !d.hotel) {
          eligibleDays.push(i);
        } else break;
      }
      // Scan backward from current day
      for (let i = currentDay - 1; i >= 1; i--) {
        const d = trip.days.find(td => td.dayNumber === i);
        if (d && d.destination === dest && !d.hotel) {
          eligibleDays.unshift(i);
        } else break;
      }

      if (eligibleDays.length > 0) {
        setPropagationPrompt({ hotel: trimmed, dayNumbers: eligibleDays, destination: dest });
      }
    }
  }, [trip, currentDay, hotelDraft, setDayHotel]);

  if (!trip) return null;

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];
  if (!day) return null;

  const destColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };

  return (
    <div style={{ background: 'var(--t-cream)' }}>
      {/* Compact Trip Header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ background: 'white' }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <h1
            className="text-lg"
            style={{
              fontFamily: FONT.serif,
              fontWeight: 600,
              color: 'var(--t-ink)',
            }}
          >
            {trip.name}
          </h1>
          <span
            className="text-[10px]"
            style={{ color: INK['90'], fontFamily: FONT.mono }}
          >
            {trip.startDate && trip.endDate && formatDateRange(trip.startDate, trip.endDate)}
          </span>
        </div>

        {/* View Toggle */}
        <div
          className="flex gap-1 mt-2.5 p-0.5 rounded-lg"
          style={{ background: 'var(--t-linen)' }}
        >
          {(myRole
            ? (['overview', 'planner', 'myPlaces', 'activity'] as const)
            : (['overview', 'planner', 'myPlaces'] as const)
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
              {mode === 'overview' ? 'Overview' : mode === 'myPlaces' ? 'Trip Places' : mode === 'activity' ? 'Activity' : 'Day Planner'}
            </button>
          ))}
        </div>
      </div>

      {/* Planner mode: calendar tabs + context bar + time slots */}
      {viewMode === 'planner' && <>

      {/* Calendar-style day segments */}
      <div
        className="flex"
        style={{
          background: 'white',
          borderTop: '1px solid var(--t-linen)',
        }}
      >
        {trip.days.map((d) => {
          const isDayActive = d.dayNumber === currentDay;
          const dayDestColor = DEST_COLORS[d.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
          const shortDay = d.dayOfWeek?.slice(0, 3) || '';
          const dateNum = d.date?.replace(/\D/g, ' ').trim().split(' ').pop() || d.dayNumber;

          return (
            <button
              key={d.dayNumber}
              onClick={() => setCurrentDay(d.dayNumber)}
              className="flex-1 flex flex-col items-center py-1.5 px-1 cursor-pointer transition-all"
              style={{
                border: 'none',
                borderBottom: isDayActive ? `2px solid ${dayDestColor.accent}` : '2px solid transparent',
                background: isDayActive ? `${dayDestColor.accent}08` : 'transparent',
              }}
            >
              <span style={{
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 600,
                color: isDayActive ? 'var(--t-ink)' : INK['85'],
                lineHeight: 1.2,
              }}>
                {shortDay} {dateNum}
              </span>
              <span style={{
                fontFamily: FONT.sans,
                fontSize: 9,
                fontWeight: 500,
                color: isDayActive ? dayDestColor.accent : INK['80'],
              }}>
                {d.destination || 'TBD'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active day context bar — hotel + map toggle */}
      {(() => {
        const placedItems = day.slots.flatMap(s => s.places);
        const dayDest = (day.destination || '').toLowerCase();
        const ghostItems = day.slots.flatMap(s => s.ghostItems || []).filter(g => {
          // Only show ghost items whose location matches this day's destination
          if (!dayDest) return true;
          const gLoc = (g.location || '').toLowerCase();
          return !gLoc || gLoc.includes(dayDest) || dayDest.includes(gLoc.split(',')[0].trim());
        });
        const geo = trip.geoDestinations?.find(
          g => g.name.toLowerCase() === (day.destination || '').toLowerCase()
        );
        const mapMarkers: MapMarker[] = [
          ...placedItems.map((p, i) => ({
            id: `placed-${i}`,
            name: p.name,
            location: p.location || day.destination || '',
            type: p.type,
            matchScore: p.matchScore,
            tasteNote: p.tasteNote,
            color: SOURCE_STYLES.manual.color,
          })),
          ...ghostItems.map((g, i) => ({
            id: `ghost-${i}`,
            name: g.name,
            location: g.location || day.destination || '',
            type: g.type,
            matchScore: g.matchScore,
            tasteNote: g.tasteNote,
            color: SOURCE_STYLES[(g.ghostSource || 'terrazzo') as keyof typeof SOURCE_STYLES]?.color || SOURCE_STYLES.terrazzo.color,
            isDashed: true,
          })),
        ];

        return (
          <>
            <div
              className="flex items-center justify-between px-3.5 py-1.5"
              style={{
                background: destColor.bg,
                borderBottom: dayMapOpen ? 'none' : `1px solid ${destColor.accent}18`,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {editingHotel ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => { e.preventDefault(); handleHotelSave(); }}
                  >
                    <PerriandIcon name="hotel" size={12} color={destColor.accent} />
                    <input
                      ref={hotelInputRef}
                      type="text"
                      value={hotelDraft}
                      onChange={(e) => setHotelDraft(e.target.value)}
                      onBlur={handleHotelSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setEditingHotel(false);
                          setHotelDraft('');
                        }
                      }}
                      placeholder="Hotel name…"
                      style={{
                        fontFamily: FONT.sans,
                        fontSize: 11,
                        fontWeight: 600,
                        color: destColor.text,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${destColor.accent}`,
                        outline: 'none',
                        padding: '0 2px 1px',
                        width: 130,
                      }}
                    />
                  </form>
                ) : day.hotel ? (
                  <button
                    onClick={() => { setHotelDraft(day.hotel || ''); setEditingHotel(true); }}
                    className="flex items-center gap-1"
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 11,
                      fontWeight: 600,
                      color: destColor.text,
                      whiteSpace: 'nowrap',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <PerriandIcon name="hotel" size={12} color={destColor.text} />
                    {day.hotel}
                  </button>
                ) : (
                  <button
                    onClick={() => { setHotelDraft(''); setEditingHotel(true); }}
                    className="flex items-center gap-1"
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 11,
                      fontWeight: 500,
                      color: `${destColor.accent}80`,
                      whiteSpace: 'nowrap',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <PerriandIcon name="hotel" size={12} color={`${destColor.accent}80`} />
                    + Hotel
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDayMapOpen(!dayMapOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: dayMapOpen ? destColor.accent : `${destColor.accent}15`,
                    color: dayMapOpen ? 'white' : destColor.accent,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: FONT.sans,
                    fontSize: 10,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <PerriandIcon name="pin" size={12} color={dayMapOpen ? 'white' : destColor.accent} />
                  {dayMapOpen ? 'Hide Map' : 'View Map'}
                  {!dayMapOpen && placedItems.length > 0 && (
                    <span style={{ fontFamily: FONT.mono, fontSize: 9, opacity: 0.7 }}>
                      · {placedItems.length} place{placedItems.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
                {placedItems.length >= 2 && (
                  <button
                    onClick={() => {
                      // Build multi-stop Google Maps directions URL from placed items in slot order
                      const waypoints = placedItems.map(p => {
                        const g = p.google as Record<string, unknown> & { lat?: number; lng?: number } | undefined;
                        if (g?.lat && g?.lng) return `${g.lat},${g.lng}`;
                        return encodeURIComponent(`${p.name} ${p.location}`);
                      });
                      const url = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
                      window.open(url, '_blank');
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: `${destColor.accent}15`,
                      color: destColor.accent,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <PerriandIcon name="discover" size={12} color={destColor.accent} />
                    Directions
                  </button>
                )}
              </div>
            </div>

            {/* Smart hotel propagation prompt */}
            {propagationPrompt && (
              <div
                className="flex items-center justify-between px-3.5 py-2"
                style={{
                  background: `${destColor.accent}10`,
                  borderBottom: `1px solid ${destColor.accent}18`,
                }}
              >
                <span style={{
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  fontWeight: 500,
                  color: destColor.text,
                }}>
                  Apply <strong>{propagationPrompt.hotel}</strong> to all {propagationPrompt.destination} days?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setMultipleDaysHotel(propagationPrompt.dayNumbers, propagationPrompt.hotel);
                      setPropagationPrompt(null);
                    }}
                    className="px-2.5 py-1 rounded-full"
                    style={{
                      background: destColor.accent,
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setPropagationPrompt(null)}
                    className="px-2.5 py-1 rounded-full"
                    style={{
                      background: `${destColor.accent}15`,
                      color: destColor.accent,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: FONT.sans,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Inline map panel */}
            {dayMapOpen && (
              <div style={{ borderBottom: `1px solid ${destColor.accent}18` }}>
                <GoogleMapView
                  key={`map-day-${day.dayNumber}-${day.destination}`}
                  markers={mapMarkers}
                  height={300}
                  fallbackDestination={day.destination}
                  fallbackCoords={geo?.lat != null && geo?.lng != null ? { lat: geo.lat, lng: geo.lng } : undefined}
                />
                {/* Map legend */}
                <div className="flex items-center gap-3 px-3.5 py-1.5" style={{ background: INK['02'] }}>
                  {placedItems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_STYLES.manual.color }} />
                      <span style={{ fontFamily: FONT.mono, fontSize: 8, color: INK['85'] }}>
                        {placedItems.length} planned
                      </span>
                    </div>
                  )}
                  {ghostItems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_STYLES.terrazzo.color, opacity: 0.5 }} />
                      <span style={{ fontFamily: FONT.mono, fontSize: 8, color: INK['80'] }}>
                        {ghostItems.length} suggested
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Compact time slots */}
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

          return (
            <TimeSlotCard
              key={slot.id}
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


// Overview Itinerary — grouped-by-day list of all placed items
function OverviewItinerary({ trip, onTapDay, onTapDetail }: { trip: Trip; onTapDay: (dayNum: number) => void; onTapDetail: (item: ImportedPlace) => void }) {
  const totalPlaces = trip.days.reduce((acc, d) => acc + d.slots.reduce((a, s) => a + s.places.length, 0), 0);
  const totalSlots = trip.days.reduce((acc, d) => acc + d.slots.length, 0);

  return (
    <div className="px-3 py-3 pb-48" style={{ background: 'var(--t-cream)' }}>
      {/* Summary */}
      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['85'] }}>
          {totalPlaces} place{totalPlaces !== 1 ? 's' : ''} planned
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['75'] }}>
          {totalSlots - totalPlaces} slot{(totalSlots - totalPlaces) !== 1 ? 's' : ''} open
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {trip.days.map(d => {
          const dColor = DEST_COLORS[d.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
          const shortDay = d.dayOfWeek?.slice(0, 3) || '';
          const allPlaced = d.slots.flatMap(s => s.places.map(p => ({ place: p, slot: s })));

          return (
            <div key={d.dayNumber}>
              {/* Day header — tappable to jump to planner */}
              <div
                className="flex items-center justify-between px-3 py-1.5 rounded-t-lg cursor-pointer"
                style={{ background: dColor.bg }}
                onClick={() => onTapDay(d.dayNumber)}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: FONT.sans, fontSize: 12, fontWeight: 700, color: dColor.text }}>
                    {shortDay} {d.date}
                  </span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 500, color: dColor.accent }}>
                    {d.destination}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {d.hotel && (
                    <span className="flex items-center gap-1" style={{ fontFamily: FONT.sans, fontSize: 10, color: dColor.accent, opacity: 0.7 }}>
                      <PerriandIcon name="hotel" size={11} color={dColor.accent} />
                      {d.hotel}
                    </span>
                  )}
                  <span style={{ fontFamily: FONT.mono, fontSize: 9, color: dColor.accent, opacity: 0.6 }}>
                    {allPlaced.length}/{d.slots.length}
                  </span>
                </div>
              </div>

              {/* Place rows */}
              <div className="rounded-b-lg overflow-hidden" style={{ border: `1px solid ${dColor.accent}15`, borderTop: 'none' }}>
                {allPlaced.length === 0 ? (
                  <div
                    className="px-3 py-3 text-center cursor-pointer"
                    style={{ background: 'white' }}
                    onClick={() => onTapDay(d.dayNumber)}
                  >
                    <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['80'] }}>
                      No places yet — tap to plan
                    </span>
                  </div>
                ) : (
                  allPlaced.map(({ place, slot }, idx) => {
                    const srcStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
                    const isReservation = place.ghostSource === 'email';
                    const subtitle = place.friendAttribution?.note || place.terrazzoReasoning?.rationale || place.tasteNote || '';
                    const truncSub = subtitle.length > 65 ? subtitle.slice(0, 62) + '…' : subtitle;

                    return (
                      <div
                        key={place.id}
                        onClick={() => onTapDetail(place)}
                        className="flex items-start gap-2.5 px-3 py-2 cursor-pointer"
                        style={{ background: 'white', borderTop: idx > 0 ? '1px solid var(--t-linen)' : undefined }}
                      >
                        <div style={{ width: isReservation ? 3 : 2, height: 30, borderRadius: 2, background: isReservation ? srcStyle.color : 'var(--t-verde)', flexShrink: 0, marginTop: 2 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <PerriandIcon name={SLOT_ICONS[slot.id] as any || 'pin'} size={12} color="var(--t-ink)" />
                            <span style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                              {place.name}
                            </span>
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ fontSize: 8, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}>
                              <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
                              {place.source?.name || srcStyle.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['80'], whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {slot.time}
                            </span>
                            {truncSub && (
                              <span style={{ fontFamily: FONT.sans, fontSize: 10, fontStyle: 'italic', color: INK['85'], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {truncSub}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const isEmpty = !hasPlaces && (!slot.ghostItems || slot.ghostItems.length === 0);
  const hasGhosts = slot.ghostItems && slot.ghostItems.length > 0;

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
                    className="text-[8px] font-semibold px-1.5 py-px rounded flex-shrink-0 flex items-center gap-0.5"
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
                >
                  <PerriandIcon name="close" size={8} color={INK['35']} />
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
                      ><PerriandIcon name="loveReaction" size={12} color="#dc2626" accent="#dc2626" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddReaction(placeKey, 'not_for_me'); }}
                        className="px-1.5 py-0.5 rounded-full flex items-center justify-center"
                        style={{ background: INK['05'], border: 'none', cursor: 'pointer' }}
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
