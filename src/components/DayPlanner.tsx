'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, TimeSlot, SLOT_ICONS, DEST_COLORS } from '@/types';
import GhostCard from './GhostCard';
import MapView from './MapView';

interface DayPlannerProps {
  onTapDetail: (item: ImportedPlace) => void;
  onOpenUnsorted: () => void;
}

export default function DayPlanner({ onTapDetail, onOpenUnsorted }: DayPlannerProps) {
  const currentDay = useTripStore(s => s.currentDay);
  const setCurrentDay = useTripStore(s => s.setCurrentDay);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const unsortedCount = useMemo(() => trip?.pool.filter(p => p.status === 'available').length ?? 0, [trip]);
  const [viewMode, setViewMode] = useState<'planner' | 'overview'>('planner');

  if (!trip) return null;

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];
  if (!day) return null;

  const destColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };

  return (
    <div className="pb-64" style={{ background: 'var(--t-cream)' }}>
      {/* Trip Header — white card with border */}
      <div
        className="px-4 py-4"
        style={{
          background: 'white',
          borderBottom: '1px solid var(--t-linen)',
        }}
      >
        <h1
          className="text-xl mb-1"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 600,
            color: 'var(--t-ink)',
          }}
        >
          {trip.name}
        </h1>
        <p
          className="text-xs"
          style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'DM Sans', sans-serif" }}
        >
          {trip.location}
          {trip.startDate && trip.endDate && ` · ${formatDateRange(trip.startDate, trip.endDate)}`}
        </p>

        {/* View Toggle — Day Planner / Overview */}
        <div
          className="flex gap-2 mt-3 p-1 rounded-lg"
          style={{ background: 'var(--t-linen)' }}
        >
          <button
            onClick={() => setViewMode('planner')}
            className="flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all"
            style={{
              background: viewMode === 'planner' ? 'white' : 'transparent',
              color: viewMode === 'planner' ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Day Planner
          </button>
          <button
            onClick={() => setViewMode('overview')}
            className="flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all"
            style={{
              background: viewMode === 'overview' ? 'white' : 'transparent',
              color: viewMode === 'overview' ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Overview
          </button>
        </div>
      </div>

      {/* Unsorted Pill — honey-bordered with gradient */}
      {unsortedCount > 0 && (
        <button
          onClick={onOpenUnsorted}
          className="mx-4 mt-3 w-[calc(100%-2rem)] flex items-center justify-between py-3 px-3.5 rounded-lg cursor-pointer transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(200, 146, 58, 0.1) 0%, rgba(200, 146, 58, 0.05) 100%)',
            border: '1.5px solid var(--t-honey)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span
            className="text-[13px] font-medium"
            style={{ color: 'var(--t-ink)' }}
          >
            {unsortedCount} unsorted places · View all →
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--t-honey)' }}
          >
            →
          </span>
        </button>
      )}

      {/* Day Strip — white bg with border, horizontal scroll */}
      <div
        className="flex gap-2 py-3 px-4 overflow-x-auto"
        style={{
          background: 'white',
          borderBottom: '1px solid var(--t-linen)',
          scrollbarWidth: 'none',
          marginTop: unsortedCount > 0 ? 0 : 0,
        }}
      >
        {trip.days.map((d) => {
          const isDayActive = d.dayNumber === currentDay;
          const dayDestColor = DEST_COLORS[d.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
          const destAbbrv = d.destination ? d.destination.substring(0, 3).toUpperCase() : 'DST';

          return (
            <button
              key={d.dayNumber}
              onClick={() => setCurrentDay(d.dayNumber)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg flex-shrink-0 cursor-pointer transition-all"
              style={{
                background: isDayActive ? `rgba(${hexToRgb(dayDestColor.accent)}, 0.08)` : 'var(--t-cream)',
                border: isDayActive ? `1.5px solid ${dayDestColor.accent}` : '1.5px solid var(--t-linen)',
                color: isDayActive ? dayDestColor.accent : 'var(--t-ink)',
                fontFamily: "'DM Sans', sans-serif",
                minWidth: 48,
              }}
            >
              <div
                className="text-xs font-bold"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {d.dayNumber}
              </div>
              <div
                className="text-[10px] font-normal"
                style={{
                  opacity: 0.7,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                {destAbbrv}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day Header — destination-colored gradient */}
      <div
        className="px-4 py-4"
        style={{
          background: `linear-gradient(135deg, ${destColor.bg} 0%, rgba(${hexToRgb(destColor.accent)}, 0.08) 100%)`,
          borderBottom: `2px solid rgba(${hexToRgb(destColor.accent)}, 0.15)`,
        }}
      >
        <div className="flex items-baseline gap-2 mb-2">
          <div
            className="text-[22px]"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 600,
              color: destColor.accent,
            }}
          >
            {day.destination || 'Destination'}
          </div>
          <span
            className="text-xs"
            style={{ color: 'rgba(28,26,23,0.5)' }}
          >
            Day {day.dayNumber} · {day.dayOfWeek}, {day.date}
          </span>
        </div>
        {day.hotel && (
          <div
            className="text-xs"
            style={{ color: 'rgba(28,26,23,0.5)' }}
          >
            🏨 {day.hotel}
          </div>
        )}
      </div>

      {viewMode === 'planner' ? (
        <>
          {/* Map view */}
          <MapView
            dayNumber={day.dayNumber}
            destination={day.destination}
            destinationCoords={(() => {
              // Look up geocoded coords for this day's destination
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
            {day.slots.map(slot => (
              <TimeSlotCard
                key={slot.id}
                slot={slot}
                dayNumber={day.dayNumber}
                destColor={destColor}
                onTapDetail={onTapDetail}
                onOpenUnsorted={onOpenUnsorted}
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
                onClick={() => { setCurrentDay(d.dayNumber); setViewMode('planner'); }}
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
                  <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                    {d.dayOfWeek}, {d.date}
                  </span>
                </div>
                <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
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
}

function TimeSlotCard({ slot, dayNumber, destColor, onTapDetail, onOpenUnsorted }: TimeSlotCardProps) {
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const icon = SLOT_ICONS[slot.id] || '📍';

  return (
    <div
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
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(28,26,23,0.5)' }}>
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

        {/* Empty state — opens pool tray to assign a place */}
        {!slot.place && (!slot.ghostItems || slot.ghostItems.length === 0) && (
          <div
            onClick={onOpenUnsorted}
            className="flex items-center justify-center p-3 rounded-lg cursor-pointer transition-all hover:border-[var(--t-honey)]"
            style={{
              border: '1.5px dashed var(--t-linen)',
              background: 'rgba(243, 239, 232, 0.5)',
              minHeight: 48,
              color: 'rgba(28,26,23,0.5)',
              fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            + Add {slot.label.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}
