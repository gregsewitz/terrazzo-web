'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, PlaceType, TimeSlot, Trip, SLOT_ICONS, DEST_COLORS, SOURCE_STYLES, GhostSourceType } from '@/types';
import { SlotContext, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import GhostCard from './GhostCard';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';

export type TripViewMode = 'planner' | 'overview' | 'myPlaces';

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
}

export default function DayPlanner({ viewMode, onSetViewMode, onTapDetail, onOpenUnsorted, onOpenForSlot, dropTarget, onRegisterSlotRef }: DayPlannerProps) {
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const [dayMapOpen, setDayMapOpen] = useState(false);
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
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 600,
              color: 'var(--t-ink)',
            }}
          >
            {trip.name}
          </h1>
          <span
            className="text-[10px]"
            style={{ color: 'rgba(28,26,23,0.9)', fontFamily: "'Space Mono', monospace" }}
          >
            {trip.startDate && trip.endDate && formatDateRange(trip.startDate, trip.endDate)}
          </span>
        </div>

        {/* View Toggle */}
        <div
          className="flex gap-1 mt-2.5 p-0.5 rounded-lg"
          style={{ background: 'var(--t-linen)' }}
        >
          {(['overview', 'planner', 'myPlaces'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onSetViewMode(mode)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: viewMode === mode ? 'white' : 'transparent',
                color: viewMode === mode ? 'var(--t-ink)' : 'rgba(28,26,23,0.9)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {mode === 'overview' ? 'Overview' : mode === 'myPlaces' ? 'Trip Places' : 'Day Planner'}
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
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: isDayActive ? 'var(--t-ink)' : 'rgba(28,26,23,0.85)',
                lineHeight: 1.2,
              }}>
                {shortDay} {dateNum}
              </span>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 9,
                fontWeight: 500,
                color: isDayActive ? dayDestColor.accent : 'rgba(28,26,23,0.8)',
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
                {day.hotel && (
                  <span className="flex items-center gap-1" style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    color: destColor.text,
                    whiteSpace: 'nowrap',
                  }}>
                    <PerriandIcon name="hotel" size={12} color={destColor.text} />
                    {day.hotel}
                  </span>
                )}
              </div>
              <button
                onClick={() => setDayMapOpen(!dayMapOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: dayMapOpen ? destColor.accent : `${destColor.accent}15`,
                  color: dayMapOpen ? 'white' : destColor.accent,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                <PerriandIcon name="pin" size={12} color={dayMapOpen ? 'white' : destColor.accent} />
                {dayMapOpen ? 'Hide Map' : 'View Map'}
                {!dayMapOpen && placedItems.length > 0 && (
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, opacity: 0.7 }}>
                    · {placedItems.length} place{placedItems.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </div>

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
                <div className="flex items-center gap-3 px-3.5 py-1.5" style={{ background: 'rgba(28,26,23,0.02)' }}>
                  {placedItems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_STYLES.manual.color }} />
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: 'rgba(28,26,23,0.85)' }}>
                        {placedItems.length} planned
                      </span>
                    </div>
                  )}
                  {ghostItems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_STYLES.terrazzo.color, opacity: 0.5 }} />
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: 'rgba(28,26,23,0.8)' }}>
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
        {day.slots.map((slot, idx) => (
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
          />
        ))}
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
  const s = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate + 'T00:00:00');
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
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'rgba(28,26,23,0.85)' }}>
          {totalPlaces} place{totalPlaces !== 1 ? 's' : ''} planned
        </span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'rgba(28,26,23,0.75)' }}>
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
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: dColor.text }}>
                    {shortDay} {d.date}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: dColor.accent }}>
                    {d.destination}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {d.hotel && (
                    <span className="flex items-center gap-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: dColor.accent, opacity: 0.7 }}>
                      <PerriandIcon name="hotel" size={11} color={dColor.accent} />
                      {d.hotel}
                    </span>
                  )}
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: dColor.accent, opacity: 0.6 }}>
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
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(28,26,23,0.8)' }}>
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
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                              {place.name}
                            </span>
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ fontSize: 8, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: "'Space Mono', monospace" }}>
                              <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
                              {place.source?.name || srcStyle.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.8)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {slot.time}
                            </span>
                            {truncSub && (
                              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontStyle: 'italic', color: 'rgba(28,26,23,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
}

function TimeSlotCard({ slot, dayNumber, destColor, onTapDetail, onOpenUnsorted, onOpenForSlot, allSlots, slotIndex, isDropTarget, onRegisterRef }: TimeSlotCardProps) {
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const unplaceFromSlot = useTripStore(s => s.unplaceFromSlot);
  const icon = SLOT_ICONS[slot.id] || 'pin';
  const slotRef = useRef<HTMLDivElement>(null);
  const hasPlaces = slot.places.length > 0;
  const isEmpty = !hasPlaces && (!slot.ghostItems || slot.ghostItems.length === 0);
  const hasGhosts = slot.ghostItems && slot.ghostItems.length > 0;

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
              fontFamily: "'Space Mono', monospace",
              color: 'rgba(28,26,23,0.85)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            {slot.label}
          </span>
          {slot.ghostItems!.length > 1 && (
            <span className="text-[9px]" style={{ color: 'rgba(28,26,23,0.8)' }}>
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
        </div>
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
              fontFamily: "'Space Mono', monospace",
              color: 'rgba(28,26,23,0.85)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            {slot.label}
          </span>
          {slot.time && (
            <span
              className="text-[10px]"
              style={{ color: 'rgba(28,26,23,0.8)', fontFamily: "'Space Mono', monospace" }}
            >
              {slot.time}
            </span>
          )}
        </div>
      )}

      {/* Confirmed places — card style with source + insight */}
      {slot.places.map((p, pIdx) => {
        const srcStyle = SOURCE_STYLES[(p.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;
        const isReservation = p.ghostSource === 'email';
        const subtitle = p.friendAttribution?.note
          || p.terrazzoReasoning?.rationale
          || p.tasteNote
          || '';
        return (
          <div
            key={p.id}
            className="mx-3 mb-1.5 rounded-lg cursor-pointer transition-all overflow-hidden"
            onClick={() => onTapDetail(p)}
            style={{
              background: 'white',
              border: '1px solid rgba(42,122,86,0.12)',
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
                    className="text-[8px] font-semibold px-1.5 py-px rounded flex-shrink-0"
                    style={{ background: srcStyle.bg, color: srcStyle.color }}
                  >
                    {srcStyle.icon} {p.ghostSource === 'friend' ? p.friendAttribution?.name : srcStyle.label}
                  </span>
                </div>
                {subtitle && (
                  <div
                    className="text-[10px] truncate mt-px"
                    style={{
                      color: 'rgba(28,26,23,0.85)',
                      fontStyle: 'italic',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
              {/* Remove button — returns place to picks strip */}
              <button
                onClick={(e) => { e.stopPropagation(); unplaceFromSlot(dayNumber, slot.id, p.id); }}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  background: 'rgba(28,26,23,0.05)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <PerriandIcon name="close" size={8} color="rgba(28,26,23,0.35)" />
              </button>
            </div>
          </div>
        );
      })}

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
              fontFamily: "'Space Mono', monospace",
              color: isDropTarget ? 'var(--t-verde)' : 'rgba(28,26,23,0.85)',
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
              color: isDropTarget ? 'var(--t-verde)' : 'rgba(28,26,23,0.75)',
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
