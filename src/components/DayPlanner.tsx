'use client';

import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, TripDay, TimeSlot, T } from '@/types';

interface DayPlannerProps {
  onTapDetail: (item: ImportedPlace) => void;
}

const SLOT_ICONS: Record<string, string> = {
  morning: '☀️',
  'late-morning': '🌤',
  lunch: '🍽',
  afternoon: '⛅',
  dinner: '🌙',
  evening: '✨',
};

export default function DayPlanner({ onTapDetail }: DayPlannerProps) {
  const { currentDay, setCurrentDay } = useTripStore();
  const trip = useTripStore(s => s.currentTrip());

  if (!trip) return null;

  const day = trip.days.find(d => d.dayNumber === currentDay) || trip.days[0];

  return (
    <div className="px-4 pt-3 pb-64">
      {/* Trip header */}
      <div className="mb-4">
        <h1
          className="text-2xl mb-0.5"
          style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
        >
          {trip.name}
        </h1>
        <p className="text-xs" style={{ color: 'rgba(28,26,23,0.5)' }}>
          {trip.location} · {trip.days.length} days
        </p>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {trip.days.map(d => (
          <button
            key={d.dayNumber}
            onClick={() => setCurrentDay(d.dayNumber)}
            className="px-3 py-1.5 rounded-full border-none cursor-pointer text-[11px] font-medium transition-all whitespace-nowrap"
            style={{
              background: d.dayNumber === currentDay ? 'var(--t-ink)' : 'rgba(28,26,23,0.06)',
              color: d.dayNumber === currentDay ? 'var(--t-cream)' : 'rgba(28,26,23,0.5)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Day {d.dayNumber}
          </button>
        ))}
      </div>

      {/* Time slots */}
      <div className="flex flex-col gap-2">
        {day.slots.map(slot => (
          <SlotCard key={slot.id} slot={slot} onTapDetail={onTapDetail} />
        ))}
      </div>
    </div>
  );
}

function SlotCard({ slot, onTapDetail }: { slot: TimeSlot; onTapDetail: (item: ImportedPlace) => void }) {
  const icon = SLOT_ICONS[slot.id] || '📍';

  if (slot.place) {
    return (
      <div
        onClick={() => onTapDetail(slot.place!)}
        className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
        style={{
          background: 'white',
          border: '1.5px solid var(--t-verde)',
        }}
      >
        <div className="flex flex-col items-center min-w-[40px]">
          <span className="text-sm">{icon}</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'rgba(28,26,23,0.4)', fontFamily: "'Space Mono', monospace" }}>
            {slot.time}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--t-ink)' }}>
            {slot.place.name}
          </div>
          <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
            {slot.place.tasteNote}
          </div>
        </div>
        <div
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(42,122,86,0.1)', color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
        >
          {slot.place.matchScore}%
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: 'rgba(28,26,23,0.02)',
        border: '1.5px dashed var(--t-travertine)',
      }}
    >
      <div className="flex flex-col items-center min-w-[40px]">
        <span className="text-sm opacity-40">{icon}</span>
        <span className="text-[9px] mt-0.5" style={{ color: 'rgba(28,26,23,0.3)', fontFamily: "'Space Mono', monospace" }}>
          {slot.time}
        </span>
      </div>
      <div className="flex-1">
        <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.3)' }}>
          {slot.label} · Tap a pool item to fill
        </div>
      </div>
    </div>
  );
}
