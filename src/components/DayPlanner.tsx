'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, PlaceType, TimeSlot, SLOT_ICONS, DEST_COLORS } from '@/types';
import { SlotContext, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import GhostCard from './GhostCard';
import MapView from './MapView';

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
  const unsortedCount = useMemo(() => trip?.pool.filter(p => p.status === 'available').length ?? 0, [trip]);

  if (!trip) return null;

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];
  if (!day) return null;

  const destColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };

  return (
    <div className="pb-64" style={{ background: 'var(--t-cream)' }}>
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
            style={{ color: 'rgba(28,26,23,0.55)', fontFamily: "'Space Mono', monospace" }}
          >
            {trip.startDate && trip.endDate && formatDateRange(trip.startDate, trip.endDate)}
          </span>
        </div>

        {/* View Toggle */}
        <div
          className="flex gap-1 mt-2.5 p-0.5 rounded-lg"
          style={{ background: 'var(--t-linen)' }}
        >
          {(['overview', 'myPlaces', 'planner'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onSetViewMode(mode)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: viewMode === mode ? 'white' : 'transparent',
                color: viewMode === mode ? 'var(--t-ink)' : 'rgba(28,26,23,0.55)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {mode === 'overview' ? 'Overview' : mode === 'myPlaces' ? 'My Places' : 'Day Planner'}
            </button>
          ))}
        </div>
      </div>

      {/* Content for planner/overview modes only */}
      {viewMode !== 'myPlaces' && <>

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
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 cursor-pointer transition-all"
              style={{
                border: 'none',
                borderBottom: isDayActive ? `2px solid ${dayDestColor.accent}` : '2px solid transparent',
                background: isDayActive ? `${dayDestColor.accent}08` : 'transparent',
              }}
            >
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                textTransform: 'uppercase' as const,
                color: isDayActive ? dayDestColor.accent : 'rgba(28,26,23,0.4)',
              }}>
                {shortDay}
              </span>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 600,
                color: isDayActive ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
              }}>
                {dateNum}
              </span>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                color: isDayActive ? 'rgba(28,26,23,0.65)' : 'rgba(28,26,23,0.35)',
                marginTop: 1,
              }}>
                {d.destination || 'TBD'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active day detail row — hotel + unsorted */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: `${destColor.accent}08`,
          borderBottom: '1px solid var(--t-linen)',
        }}
      >
        <div className="flex items-center gap-1.5">
          {day.hotel && (
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(28,26,23,0.7)',
            }}>
              {day.hotel}
            </span>
          )}
          {day.destination && (
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(28,26,23,0.45)',
            }}>
              · {day.destination}
            </span>
          )}
        </div>
      </div>

      {viewMode === 'planner' ? (
        <>
          {/* Map view */}
          <MapView
            dayNumber={day.dayNumber}
            destination={day.destination}
            destinationCoords={(() => {
              const geo = trip.geoDestinations?.find(
                g => g.name.toLowerCase() === (day.destination || '').toLowerCase()
              );
              return geo?.lat != null && geo?.lng != null ? { lat: geo.lat, lng: geo.lng } : undefined;
            })()}
            placedItems={day.slots
              .filter(s => s.place)
              .map(s => ({ name: s.place!.name, type: s.place!.type }))}
            ghostItems={day.slots
              .flatMap(s => s.ghostItems || [])
              .map(item => ({ name: item.name, ghostSource: item.ghostSource }))}
          />

          {/* Six time slots */}
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
        </>
      ) : (
        /* Overview — all days at a glance */
        <div className="px-4 py-4 flex flex-col gap-3">
          {trip.days.map(d => {
            const dColor = DEST_COLORS[d.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
            const placedCount = d.slots.filter(s => s.place).length;
            const ghostCount = d.slots.reduce((acc, s) => acc + (s.ghostItems?.length || 0), 0);
            return (
              <div
                key={d.dayNumber}
                onClick={() => { setCurrentDay(d.dayNumber); onSetViewMode('planner'); }}
                className="p-3.5 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background: 'white',
                  border: `1.5px solid var(--t-linen)`,
                  borderLeft: `4px solid ${dColor.accent}`,
                }}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: dColor.accent, fontFamily: "'DM Serif Display', serif" }}
                  >
                    Day {d.dayNumber} · {d.destination}
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.7)' }}>
                    {d.dayOfWeek}, {d.date}
                  </span>
                </div>
                <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.7)' }}>
                  {placedCount} confirmed{ghostCount > 0 ? ` · ${ghostCount} suggestion${ghostCount !== 1 ? 's' : ''}` : ''}
                  {d.hotel ? ` · 🏨 ${d.hotel}` : ''}
                </div>
                {placedCount > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.slots.filter(s => s.place).map(s => (
                      <span
                        key={s.id}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}
                      >
                        {s.place!.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      </>}

      <div style={{ height: 20 }} />
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

// Helper to convert hex to rgb values
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
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
  const icon = SLOT_ICONS[slot.id] || '📍';
  const slotRef = useRef<HTMLDivElement>(null);
  const isEmpty = !slot.place && (!slot.ghostItems || slot.ghostItems.length === 0);

  // Register bounding rect on mount and resize
  const updateRect = useCallback(() => {
    if (onRegisterRef && slotRef.current && isEmpty) {
      onRegisterRef(slotRef.current.getBoundingClientRect());
    } else if (onRegisterRef && !isEmpty) {
      onRegisterRef(null); // Don't accept drops on occupied slots
    }
  }, [onRegisterRef, isEmpty]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  return (
    <div
      ref={slotRef}
      className="px-4 py-4"
      style={{ borderBottom: '1px solid var(--t-linen)' }}
    >
      {/* Slot header */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-lg">{icon}</span>
        <span
          className="text-[13px] font-medium"
          style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}
        >
          {slot.label}
        </span>
      </div>

      {/* Slot content */}
      <div className="flex flex-col gap-2.5">
        {/* Confirmed place */}
        {slot.place && (
          <div
            onClick={() => onTapDetail(slot.place!)}
            className="cursor-pointer transition-all p-3 rounded-lg"
            style={{
              background: 'white',
              border: '1.5px solid var(--t-linen)',
              borderLeft: '4px solid var(--t-verde)',
            }}
          >
            <div
              className="text-[13px] font-medium mb-1"
              style={{ color: 'var(--t-ink)' }}
            >
              {slot.place.name}
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(28,26,23,0.7)' }}>
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold"
                style={{ background: 'var(--t-verde)', color: 'white' }}
              >
                ⏰
              </span>
              {slot.time}
            </div>
          </div>
        )}

        {/* Ghost items — full-width */}
        {slot.ghostItems && slot.ghostItems.map(ghost => (
          <GhostCard
            key={ghost.id}
            item={ghost}
            variant="slot"
            onConfirm={() => confirmGhost(dayNumber, slot.id, ghost.id)}
            onDismiss={() => dismissGhost(dayNumber, slot.id, ghost.id)}
            onTapDetail={() => onTapDetail(ghost)}
          />
        ))}

        {/* Empty state — drop target or click to assign */}
        {isEmpty && (
          <div
            onClick={() => {
              if (onOpenForSlot && allSlots && slotIndex != null) {
                const prevSlot = slotIndex > 0 ? allSlots[slotIndex - 1] : undefined;
                const nextSlot = slotIndex < allSlots.length - 1 ? allSlots[slotIndex + 1] : undefined;
                const before = prevSlot?.place ? { name: prevSlot.place.name, type: prevSlot.place.type, location: prevSlot.place.location } : undefined;
                const after = nextSlot?.place ? { name: nextSlot.place.name, type: nextSlot.place.type, location: nextSlot.place.location } : undefined;
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
            }}
            className="flex items-center justify-center p-3 rounded-lg cursor-pointer transition-all"
            style={{
              border: isDropTarget
                ? '2px dashed var(--t-verde)'
                : '1.5px dashed var(--t-linen)',
              background: isDropTarget
                ? 'rgba(42,122,86,0.08)'
                : 'rgba(243, 239, 232, 0.5)',
              minHeight: 48,
              color: isDropTarget ? 'var(--t-verde)' : 'rgba(28,26,23,0.7)',
              fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: isDropTarget ? 600 : 400,
              transform: isDropTarget ? 'scale(1.02)' : 'none',
              transition: 'all 0.15s ease-out',
            }}
          >
            {isDropTarget ? 'Drop here' : `+ Add ${slot.label.toLowerCase()}`}
          </div>
        )}
      </div>
    </div>
  );
}
