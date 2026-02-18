'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, PlaceType, GhostSourceType, SOURCE_STYLES, SLOT_ICONS, DEST_COLORS, PerriandIconName } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

interface TripMyPlacesProps {
  onTapDetail: (item: ImportedPlace) => void;
}

type FilterType = PlaceType | 'all';

const TYPE_ICONS: Record<PlaceType, PerriandIconName> = {
  restaurant: 'restaurant', bar: 'bar', cafe: 'cafe', museum: 'museum', activity: 'activity',
  hotel: 'hotel', neighborhood: 'neighborhood', shop: 'shop',
};

const TYPE_CHIPS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'bar', label: 'Bars' },
  { value: 'cafe', label: 'Cafés' },
  { value: 'museum', label: 'Museums' },
  { value: 'activity', label: 'Experiences' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'shop', label: 'Shops' },
];

interface PlacedItem {
  place: ImportedPlace;
  slotLabel: string;
  slotTime: string;
  slotId: string;
  dayNumber: number;
  dayOfWeek?: string;
  date?: string;
  destination?: string;
}

export default function TripMyPlaces({ onTapDetail }: TripMyPlacesProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  const [filter, setFilter] = useState<FilterType>('all');

  // Collect all placed items across all days
  const allPlaced = useMemo(() => {
    if (!trip) return [];
    const items: PlacedItem[] = [];
    trip.days.forEach(day => {
      day.slots.forEach(slot => {
        slot.places.forEach(place => {
          items.push({
            place,
            slotLabel: slot.label,
            slotTime: slot.time,
            slotId: slot.id,
            dayNumber: day.dayNumber,
            dayOfWeek: day.dayOfWeek,
            date: day.date,
            destination: day.destination,
          });
        });
      });
    });
    return items;
  }, [trip]);

  // Type counts for chips
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    allPlaced.forEach(item => { c[item.place.type] = (c[item.place.type] || 0) + 1; });
    return c;
  }, [allPlaced]);

  // Filter
  const filtered = useMemo(() => {
    if (filter === 'all') return allPlaced;
    return allPlaced.filter(item => item.place.type === filter);
  }, [allPlaced, filter]);

  if (!trip) return null;

  return (
    <div className="pb-48" style={{ background: 'var(--t-cream)' }}>
      {/* Header + filter chips */}
      <div className="px-4 pt-3 pb-2" style={{ background: 'white', borderBottom: '1px solid var(--t-linen)' }}>
        <div className="flex items-baseline justify-between mb-2">
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'rgba(28,26,23,0.85)' }}>
            {allPlaced.length} place{allPlaced.length !== 1 ? 's' : ''} on this trip
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TYPE_CHIPS.map(chip => {
            const count = chip.value === 'all' ? allPlaced.length : (typeCounts[chip.value] || 0);
            if (chip.value !== 'all' && count === 0) return null;
            const isActive = filter === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => setFilter(chip.value)}
                className="px-2.5 py-1 rounded-2xl text-[10px] whitespace-nowrap flex-shrink-0"
                style={{
                  background: isActive ? 'var(--t-ink)' : 'rgba(28,26,23,0.04)',
                  color: isActive ? 'white' : 'rgba(28,26,23,0.9)',
                  fontWeight: isActive ? 600 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {chip.label} {count > 0 ? count : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Place cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-3xl mb-3 block flex justify-center">
            <PerriandIcon name="trips" size={32} color="var(--t-ink)" />
          </div>
          <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}>
            No places added yet
          </p>
          <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.85)', fontFamily: "'DM Sans', sans-serif" }}>
            Drag places from your picks into the Day Planner to build your itinerary
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-3 pt-3">
          {filtered.map(item => (
            <PlaceCard key={`${item.dayNumber}-${item.slotId}-${item.place.id}`} item={item} onTap={() => onTapDetail(item.place)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Rich place card component
function PlaceCard({ item, onTap }: { item: PlacedItem; onTap: () => void }) {
  const { place } = item;
  const srcStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
  const isReservation = place.ghostSource === 'email';
  const destColor = DEST_COLORS[item.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
  const typeIcon = TYPE_ICONS[place.type] || 'pin';

  // Google data
  const google = place.google;
  const priceStr = google?.priceLevel ? '€'.repeat(google.priceLevel) : null;

  return (
    <div
      onClick={onTap}
      className="rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {/* Thumbnail header — type icon on colored bg */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ background: destColor.bg, borderBottom: `1px solid ${destColor.accent}12` }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 44, height: 44, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <PerriandIcon name={typeIcon} size={24} color="var(--t-ink)" />
          </div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, fontWeight: 600, color: 'var(--t-ink)', lineHeight: 1.2 }}>
              {place.name}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.85)' }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {google?.category && google.category !== place.type && (
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.8)' }}>
                  · {google.category}
                </span>
              )}
              {place.location && (
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.8)' }}>
                  · {place.location.split(',')[0]}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Match score */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span
            className="px-2 py-0.5 rounded-md"
            style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' }}
          >
            {place.matchScore}%
          </span>
        </div>
      </div>

      {/* Body — briefing section */}
      <div className="px-3.5 py-2.5">
        {/* When/where on this trip */}
        <div className="flex items-center gap-1.5 mb-2">
          <PerriandIcon name={SLOT_ICONS[item.slotId] as any || 'pin'} size={13} color="var(--t-ink)" />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: 'rgba(28,26,23,0.9)' }}>
            {item.dayOfWeek?.slice(0, 3)} {item.date} · {item.slotTime}
          </span>
          {item.destination && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: destColor.accent }}>
              {item.destination}
            </span>
          )}
        </div>

        {/* Source + Google info row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span
            className="px-2 py-0.5 rounded-md flex items-center gap-0.5"
            style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: "'Space Mono', monospace" }}
          >
            <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
            {place.source?.name || srcStyle.label}
          </span>
          {isReservation && (
            <span
              className="px-2 py-0.5 rounded-md flex items-center gap-0.5"
              style={{ fontSize: 9, fontWeight: 600, background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
            >
              <PerriandIcon name="check" size={10} color="var(--t-verde)" />
              Reservation
            </span>
          )}
          {google?.rating && (
            <span className="flex items-center gap-0.5" style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.85)' }}>
              <PerriandIcon name="star" size={10} color="rgba(28,26,23,0.85)" />
              {google.rating}{google.reviewCount ? ` (${google.reviewCount.toLocaleString()})` : ''}
            </span>
          )}
          {priceStr && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.8)' }}>
              {priceStr}
            </span>
          )}
        </div>

        {/* Terrazzo insight */}
        {place.terrazzoInsight?.why && (
          <div className="mb-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(200,146,58,0.04)', border: '1px solid rgba(200,146,58,0.1)' }}>
            <div className="flex items-start gap-1.5">
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                <PerriandIcon name="terrazzo" size={11} color="var(--t-honey)" />
              </div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(28,26,23,0.95)', lineHeight: 1.4 }}>
                {place.terrazzoInsight.why}
              </span>
            </div>
            {place.terrazzoInsight.caveat && (
              <div className="flex items-start gap-1.5 mt-1">
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  {/* Using terrazzo for warning since there's no specific warning icon */}
                  <span style={{ fontSize: 12 }}>⚠️</span>
                </div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.85)', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {place.terrazzoInsight.caveat}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Friend note */}
        {place.friendAttribution && (
          <div className="mb-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(42,122,86,0.03)', border: '1px solid rgba(42,122,86,0.08)' }}>
            <div className="flex items-start gap-1.5">
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                <PerriandIcon name="friend" size={11} color="var(--t-verde)" />
              </div>
              <div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: 'var(--t-verde)' }}>
                  {place.friendAttribution.name}
                </span>
                {place.friendAttribution.note && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(28,26,23,0.9)', fontStyle: 'italic', marginLeft: 6 }}>
                    "{place.friendAttribution.note}"
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* What to order */}
        {place.whatToOrder && place.whatToOrder.length > 0 && (
          <div className="mb-2">
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.8)', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
              What to order
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {place.whatToOrder.map((item, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, background: 'rgba(28,26,23,0.04)', color: 'rgba(28,26,23,0.9)' }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {place.tips && place.tips.length > 0 && (
          <div className="mb-1">
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.8)', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
              Tips
            </span>
            <div className="flex flex-col gap-0.5 mt-1">
              {place.tips.map((tip, i) => (
                <span
                  key={i}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.9)', lineHeight: 1.4 }}
                >
                  {tip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Taste note fallback — if no insight or friend note */}
        {!place.terrazzoInsight?.why && !place.friendAttribution?.note && place.tasteNote && (
          <div className="mb-1">
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(28,26,23,0.9)', fontStyle: 'italic', lineHeight: 1.4 }}>
              {place.tasteNote}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
