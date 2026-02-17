'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, SOURCE_STYLES, GhostSourceType } from '@/types';

interface TriageDeckProps {
  places: ImportedPlace[];
  tripName: string;
  onClose: () => void;
  onTapDetail: (item: ImportedPlace) => void;
}

type TriageAction = 'star' | 'skip';

interface SwipeState {
  x: number;
  startX: number;
  swiping: boolean;
}

export default function TriageDeck({ places, tripName, onClose, onTapDetail }: TriageDeckProps) {
  const ratePlace = useTripStore(s => s.ratePlace);
  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const placeItem = useTripStore(s => s.placeItem);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, TriageAction>>(new Map());
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const [swipe, setSwipe] = useState<SwipeState>({ x: 0, startX: 0, swiping: false });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const currentPlace = places[currentIndex];
  const starredCount = useMemo(() =>
    Array.from(decisions.values()).filter(d => d === 'star').length, [decisions]);
  const skippedCount = useMemo(() =>
    Array.from(decisions.values()).filter(d => d === 'skip').length, [decisions]);
  const isDone = currentIndex >= places.length;
  const progress = places.length > 0 ? (currentIndex / places.length) * 100 : 0;

  // Day labels for the day picker
  const dayLabels = useMemo(() => {
    if (!trip) return [];
    return trip.days.map(d => ({
      dayNumber: d.dayNumber,
      label: d.dayOfWeek?.slice(0, 3) || `D${d.dayNumber}`,
      date: d.date || '',
    }));
  }, [trip]);

  const handleAction = useCallback((action: TriageAction) => {
    if (!currentPlace) return;
    setExitDir(action === 'star' ? 'right' : 'left');
    setDecisions(prev => new Map(prev).set(currentPlace.id, action));

    if (action === 'star') {
      ratePlace(currentPlace.id, { reaction: 'myPlace', ratedAt: new Date().toISOString() });
      // If a day is selected, place into the first empty slot of that day
      if (selectedDay !== null && trip) {
        const day = trip.days.find(d => d.dayNumber === selectedDay);
        const emptySlot = day?.slots.find(s => !s.place);
        if (emptySlot) {
          placeItem(currentPlace.id, selectedDay, emptySlot.id);
        }
      }
    }

    setTimeout(() => {
      setCurrentIndex(i => i + 1);
      setExitDir(null);
      setSwipe({ x: 0, startX: 0, swiping: false });
      setSelectedDay(null);
    }, 250);
  }, [currentPlace, ratePlace, selectedDay, trip, placeItem]);

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setSwipe({ x: 0, startX: e.touches[0].clientX, swiping: true });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!swipe.swiping) return;
    setSwipe(prev => ({ ...prev, x: e.touches[0].clientX - prev.startX }));
  };
  const onTouchEnd = () => {
    if (Math.abs(swipe.x) > 80) {
      handleAction(swipe.x > 0 ? 'star' : 'skip');
    } else {
      setSwipe({ x: 0, startX: 0, swiping: false });
    }
  };

  // Swipe transform
  const getCardStyle = (): React.CSSProperties => {
    if (exitDir === 'right') return { transform: 'translateX(120%) rotate(12deg)', opacity: 0, transition: 'all 0.25s ease-out' };
    if (exitDir === 'left') return { transform: 'translateX(-120%) rotate(-12deg)', opacity: 0, transition: 'all 0.25s ease-out' };
    if (swipe.swiping && swipe.x !== 0) {
      const rotate = swipe.x * 0.05;
      return { transform: `translateX(${swipe.x}px) rotate(${rotate}deg)`, transition: 'none' };
    }
    return { transform: 'translateX(0) rotate(0deg)', transition: 'all 0.2s ease-out' };
  };

  // Swipe indicator opacity
  const starOpacity = Math.min(Math.max(swipe.x / 80, 0), 1);
  const skipOpacity = Math.min(Math.max(-swipe.x / 80, 0), 1);

  // ─── Done screen ───
  if (isDone) {
    const starred = places.filter(p => decisions.get(p.id) === 'star');
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
        <div className="flex items-center px-4 pt-5 pb-3">
          <button onClick={onClose} className="text-sm bg-transparent border-none cursor-pointer" style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}>
            ← Back to trip
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-4xl mb-4">✦</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: 'var(--t-ink)', marginBottom: 8 }}>
            All sorted
          </h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(28,26,23,0.5)', maxWidth: 260 }}>
            {starredCount} starred · {skippedCount} skipped
          </p>
          {starred.length > 0 && (
            <div className="w-full max-w-xs text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}>
                Starred
              </p>
              {starred.map(p => (
                <div key={p.id} className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(42,122,86,0.06)', border: '1px solid rgba(42,122,86,0.12)' }}>
                  <span style={{ color: 'var(--t-verde)', fontSize: 14 }}>★</span>
                  <span className="text-[13px]" style={{ color: 'var(--t-ink)' }}>{p.name}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'rgba(28,26,23,0.4)' }}>{p.matchScore}%</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            className="mt-8 px-8 py-3 rounded-full border-none cursor-pointer text-sm font-semibold"
            style={{ background: 'var(--t-ink)', color: 'var(--t-cream)', fontFamily: "'DM Sans', sans-serif" }}
          >
            Back to planner
          </button>
        </div>
      </div>
    );
  }

  // ─── Active triage screen ───
  const sourceStyle = SOURCE_STYLES[(currentPlace.ghostSource as GhostSourceType) || 'manual'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <button onClick={onClose} className="text-sm bg-transparent border-none cursor-pointer" style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}>
          ← {tripName}
        </button>
        <span className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}>
          {currentIndex + 1} of {places.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--t-linen)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--t-verde)' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px]" style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}>★ {starredCount}</span>
          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.3)', fontFamily: "'Space Mono', monospace" }}>{skippedCount} skipped</span>
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-5 py-3 relative overflow-hidden">
        {/* Swipe hint overlays */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl pointer-events-none transition-opacity" style={{ opacity: skipOpacity, color: 'var(--t-signal-red)' }}>
          ✗
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-3xl pointer-events-none transition-opacity" style={{ opacity: starOpacity, color: 'var(--t-verde)' }}>
          ★
        </div>

        {/* The card */}
        <div
          className="w-full rounded-2xl overflow-hidden shadow-lg cursor-grab active:cursor-grabbing"
          style={{
            ...getCardStyle(),
            background: 'white',
            border: '1.5px solid var(--t-linen)',
            maxHeight: '65vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Photo area / gradient placeholder */}
          <div
            className="relative w-full flex items-end"
            style={{
              height: 180,
              background: `linear-gradient(135deg, ${sourceStyle.color}22 0%, ${sourceStyle.color}08 100%)`,
            }}
          >
            {/* Source badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
              <span className="text-[11px]">{sourceStyle.icon}</span>
              <span className="text-[10px] font-medium" style={{ color: sourceStyle.color }}>
                {currentPlace.ghostSource === 'friend' ? currentPlace.friendAttribution?.name : sourceStyle.label}
              </span>
            </div>
            {/* Match score */}
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
              <span className="text-[11px] font-bold" style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}>
                {currentPlace.matchScore}%
              </span>
            </div>
            {/* Place type icon */}
            <div className="absolute bottom-3 left-3">
              <span className="text-[28px]" style={{ opacity: 0.3 }}>
                {currentPlace.type === 'restaurant' ? '🍽' : currentPlace.type === 'museum' ? '🏛' : currentPlace.type === 'hotel' ? '🏨' : currentPlace.type === 'bar' ? '🍸' : currentPlace.type === 'cafe' ? '☕' : currentPlace.type === 'shop' ? '🛍' : '📍'}
              </span>
            </div>
          </div>

          {/* Card body */}
          <div className="px-4 py-4 flex-1 overflow-y-auto" onClick={() => onTapDetail(currentPlace)}>
            <h3 className="mb-1" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--t-ink)', margin: 0 }}>
              {currentPlace.name}
            </h3>
            <p className="text-[12px] mb-3" style={{ color: 'rgba(28,26,23,0.5)' }}>
              {currentPlace.location} · {currentPlace.type}
            </p>

            {/* Terrazzo insight */}
            {currentPlace.terrazzoInsight && (
              <div className="rounded-lg px-3 py-2.5 mb-3" style={{ background: 'var(--t-cream)', border: '1px solid var(--t-linen)' }}>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--t-ink)', margin: 0 }}>
                  {currentPlace.terrazzoInsight.why}
                </p>
                {currentPlace.terrazzoInsight.caveat && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'rgba(28,26,23,0.45)', margin: 0 }}>
                    {currentPlace.terrazzoInsight.caveat}
                  </p>
                )}
              </div>
            )}

            {/* Friend note */}
            {currentPlace.friendAttribution?.note && (
              <div className="rounded-lg px-3 py-2.5 mb-3" style={{ background: 'rgba(42,122,86,0.04)', border: '1px solid rgba(42,122,86,0.1)' }}>
                <p className="text-[12px] italic" style={{ color: 'var(--t-ink)', margin: 0 }}>
                  &ldquo;{currentPlace.friendAttribution.note}&rdquo;
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--t-verde)', margin: 0 }}>
                  — {currentPlace.friendAttribution.name}
                </p>
              </div>
            )}

            {/* Google data */}
            {currentPlace.google && (
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                {currentPlace.google.rating && (
                  <span>⭐ {currentPlace.google.rating}</span>
                )}
                {currentPlace.google.reviewCount && (
                  <span>({currentPlace.google.reviewCount.toLocaleString()})</span>
                )}
                {currentPlace.google.priceLevel && (
                  <span>{'$'.repeat(currentPlace.google.priceLevel)}</span>
                )}
              </div>
            )}
          </div>

          {/* Day picker */}
          <div className="px-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'rgba(28,26,23,0.4)', fontFamily: "'Space Mono', monospace" }}>
              Assign to day
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {dayLabels.map(d => {
                const isActive = selectedDay === d.dayNumber;
                return (
                  <button
                    key={d.dayNumber}
                    onClick={() => setSelectedDay(isActive ? null : d.dayNumber)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium border-none cursor-pointer transition-all"
                    style={{
                      background: isActive ? 'var(--t-ink)' : 'var(--t-cream)',
                      color: isActive ? 'var(--t-cream)' : 'var(--t-ink)',
                      border: isActive ? 'none' : '1px solid var(--t-linen)',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedDay(null)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium border-none cursor-pointer"
                style={{
                  background: selectedDay === null ? 'rgba(28,26,23,0.06)' : 'transparent',
                  color: 'rgba(28,26,23,0.4)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 px-6 pb-6 pt-2">
        <button
          onClick={() => handleAction('skip')}
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl cursor-pointer transition-all active:scale-95"
          style={{
            background: 'white',
            border: '2px solid var(--t-linen)',
            color: 'rgba(28,26,23,0.4)',
          }}
          title="Skip"
        >
          ✗
        </button>
        <button
          onClick={() => handleAction('star')}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl cursor-pointer transition-all active:scale-95"
          style={{
            background: 'var(--t-verde)',
            border: 'none',
            color: 'white',
            boxShadow: '0 4px 16px rgba(42,122,86,0.3)',
          }}
          title="Star"
        >
          ★
        </button>
      </div>
    </div>
  );
}
