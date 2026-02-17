'use client';

import { useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, TimeSlot, TripDay, SLOT_ICONS, DEST_COLORS } from '@/types';
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

  if (!trip) return null;

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];
  if (!day) return null;

  // Get destination abbreviation for this day (3 letters)
  const destAbbrv = day.destination ? day.destination.substring(0, 3).toUpperCase() : 'DST';
  const destColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };

  // Determine if this is the first day of a new destination
  const prevDay = currentDay > 1 ? trip.days.find(d => d.dayNumber === currentDay - 1) : null;
  const isNewDestination = !prevDay || prevDay.destination !== day.destination;

  return (
    <div className="px-4 pt-3 pb-64">
      {/* Trip header - DM Serif Display italic + location + dates */}
      <div className="mb-6">
        <h1
          className="text-3xl mb-1 italic"
          style={{
            fontFamily: "'DM Serif Display', serif",
            color: 'var(--t-ink)',
            fontStyle: 'italic',
          }}
        >
          {trip.name}
        </h1>
        <p className="text-xs" style={{ color: 'rgba(28,26,23,0.5)' }}>
          {trip.location}
          {trip.startDate && trip.endDate && ` · ${trip.startDate} to ${trip.endDate}`}
        </p>
      </div>

      {/* Unsorted pill - honey-colored with count */}
      {unsortedCount > 0 && (
        <button
          onClick={onOpenUnsorted}
          className="w-full mb-6 py-2.5 px-3 rounded-full border-none cursor-pointer text-sm font-medium transition-all"
          style={{
            background: 'var(--t-honey)',
            color: 'var(--t-ink)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {unsortedCount} unsorted places · View all →
        </button>
      )}

      {/* Day strip - horizontal scrollable with day number, day of week, destination label */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
        {trip.days.map((d, idx) => {
          const isPrevNewDest = idx === 0 ? true : trip.days[idx - 1].destination !== d.destination;
          const isDayActive = d.dayNumber === currentDay;
          const dayDestColor = DEST_COLORS[d.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };

          return (
            <div key={d.dayNumber} className="flex flex-col items-center gap-1 whitespace-nowrap">
              {/* Destination label above first day of segment */}
              {isPrevNewDest && (
                <div
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: dayDestColor.accent, fontFamily: "'Space Mono', monospace" }}
                >
                  {d.destination ? d.destination.substring(0, 3).toUpperCase() : 'DST'}
                </div>
              )}

              {/* Day button */}
              <button
                onClick={() => setCurrentDay(d.dayNumber)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border-none cursor-pointer transition-all"
                style={{
                  background: isDayActive ? dayDestColor.accent : 'rgba(28,26,23,0.06)',
                  color: isDayActive ? 'white' : 'rgba(28,26,23,0.5)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div
                  className="text-lg font-bold"
                  style={{ fontFamily: "'Space Mono', monospace", color: isDayActive ? 'white' : 'var(--t-ink)' }}
                >
                  {d.dayNumber}
                </div>
                <div
                  className="text-[9px] uppercase tracking-wide font-medium"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    color: isDayActive ? 'white' : 'rgba(28,26,23,0.4)',
                  }}
                >
                  {d.dayOfWeek?.substring(0, 3) || 'day'}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Day header card - colored left border matching destination */}
      <div className="mb-6">
        <div
          className="rounded-lg p-4 flex items-start justify-between"
          style={{
            background: 'white',
            borderLeft: `4px solid ${destColor.accent}`,
          }}
        >
          <div>
            <div
              className="text-sm font-bold uppercase tracking-wider mb-1"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: 'var(--t-ink)',
              }}
            >
              Day {day.dayNumber} · {day.dayOfWeek}
            </div>
            {day.date && (
              <div
                className="text-sm italic"
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  color: 'rgba(28,26,23,0.7)',
                }}
              >
                {day.date}
              </div>
            )}
          </div>

          <div className="text-right">
            {day.destination && (
              <div
                className="text-xs font-semibold"
                style={{ color: 'var(--t-ink)' }}
              >
                {day.destination}
              </div>
            )}
            {day.hotel && (
              <div
                className="text-xs mt-1"
                style={{ color: 'rgba(28,26,23,0.6)', fontStyle: 'italic' }}
              >
                {day.hotel}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map view */}
      <MapView
        dayNumber={day.dayNumber}
        destination={day.destination}
        placedItems={day.slots
          .filter(s => s.place)
          .map(s => ({ name: s.place!.name, type: s.place!.type }))}
        ghostItems={day.slots
          .flatMap(s => s.ghostItems || [])
          .map(item => ({ name: item.name, ghostSource: item.ghostSource }))}
      />

      {/* Six time slots */}
      <div className="flex flex-col gap-4">
        {day.slots.map(slot => (
          <TimeSlotCard
            key={slot.id}
            slot={slot}
            dayNumber={day.dayNumber}
            destColor={destColor}
            onTapDetail={onTapDetail}
          />
        ))}
      </div>
    </div>
  );
}

interface TimeSlotCardProps {
  slot: TimeSlot;
  dayNumber: number;
  destColor: { bg: string; accent: string; text: string };
  onTapDetail: (item: ImportedPlace) => void;
}

function TimeSlotCard({ slot, dayNumber, destColor, onTapDetail }: TimeSlotCardProps) {
  const confirmGhost = useTripStore(s => s.confirmGhost);
  const dismissGhost = useTripStore(s => s.dismissGhost);
  const icon = SLOT_ICONS[slot.id] || '📍';
  const itemCount = (slot.place ? 1 : 0) + (slot.ghostItems?.length || 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Slot header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div
          className="text-xs font-bold uppercase tracking-wider"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: 'var(--t-ink)',
          }}
        >
          {slot.label}
        </div>
        {itemCount > 0 && (
          <div
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(200,146,58,0.15)',
              color: 'var(--t-amber)',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {itemCount}
          </div>
        )}
      </div>

      {/* Slot content */}
      <div className="flex flex-col gap-2 pl-6">
        {/* Confirmed place */}
        {slot.place && (
          <div
            onClick={() => onTapDetail(slot.place!)}
            className="cursor-pointer transition-all hover:scale-[1.01] p-3 rounded-lg"
            style={{
              background: 'white',
              borderLeft: '3px solid var(--t-verde)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--t-ink)' }}
                >
                  {slot.place.name}
                </div>
              </div>
              <div
                className="text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: 'rgba(42,122,86,0.1)',
                  color: 'var(--t-verde)',
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                {slot.place.matchScore}%
              </div>
            </div>

            {/* Time pin with honey color */}
            <div className="flex items-center gap-1 mt-2">
              <span
                className="text-xs"
                style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}
              >
                · {slot.time}
              </span>
            </div>
          </div>
        )}

        {/* Ghost items */}
        {slot.ghostItems && slot.ghostItems.map(ghost => (
          <GhostCard
            key={ghost.id}
            item={ghost}
            onConfirm={() => confirmGhost(dayNumber, slot.id, ghost.id)}
            onDismiss={() => dismissGhost(dayNumber, slot.id, ghost.id)}
            onTapDetail={() => onTapDetail(ghost)}
          />
        ))}

        {/* Empty state */}
        {!slot.place && (!slot.ghostItems || slot.ghostItems.length === 0) && (
          <div
            className="flex items-center justify-center p-3 rounded-lg transition-all hover:scale-[1.01] cursor-pointer"
            style={{
              border: '1.5px dashed var(--t-linen)',
              background: 'rgba(28,26,23,0.02)',
              minHeight: 48,
            }}
          >
            <div
              className="text-sm text-center"
              style={{ color: 'rgba(28,26,23,0.3)', fontFamily: "'DM Sans', sans-serif" }}
            >
              + Add {slot.label.toLowerCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
