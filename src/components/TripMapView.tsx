'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { DEST_COLORS, SOURCE_STYLES, GhostSourceType, SLOT_ICONS, ImportedPlace, SuggestionItem } from '@/types';
import { TYPE_ICONS } from '@/constants/placeTypes';
import { generateDestColor } from '@/lib/destination-helpers';
import { useTripSuggestions } from '@/hooks/useTripSuggestions';

// ─── Types ───
interface TripMapViewProps {
  onTapDetail: (item: ImportedPlace) => void;
  variant: 'mobile' | 'desktop';
}

interface PlacedItem {
  place: ImportedPlace;
  slotLabel: string;
  slotTime: string;
  slotId: string;
  dayNumber: number;
  dayOfWeek?: string;
  date?: string;
  destination?: string;
  orderIndex: number;
}

// ─── Ghost suggestion tiers ───
// Tier 1 (implemented): Library matches — saved places relevant to this destination
// Tier 2 (stub):        Contextual fit — nearby/slot-affinity-aware suggestions
// Tier 3 (stub):        Discovery — Terrazzo place intelligence from other users
type GhostTier = 'library' | 'contextual' | 'discovery';

interface GhostItem {
  place: ImportedPlace;
  dayNumber: number;
  slotId: string;        // best-fit slot for adding
  destination?: string;
  tier: GhostTier;
}

// ─── Helpers ───
const getDestColor = (dest: string) =>
  DEST_COLORS[dest] || generateDestColor(dest);

/** Short label for day pills — e.g. "Mon 15" */
function dayPillLabel(d: { dayNumber: number; date?: string; dayOfWeek?: string }): string {
  const dow = d.dayOfWeek?.slice(0, 3);
  const dateNum = d.date?.replace(/[^0-9]/g, '');
  if (dow && dateNum) return `${dow} ${dateNum}`;
  if (d.date) return d.date;
  return `Day ${d.dayNumber}`;
}

// ─── Component ───
function TripMapView({ onTapDetail, variant }: TripMapViewProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  // Shared day state — read from store so it syncs with DayPlanner
  const storeCurrentDay = useTripStore(s => s.currentDay);
  const setStoreCurrentDay = useTripStore(s => s.setCurrentDay);

  // Local selectedDay: number = specific day, null = "All"
  // Initialize to store's currentDay so map opens on the day user was viewing
  const [selectedDay, setSelectedDayLocal] = useState<number | null>(storeCurrentDay);
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const [activePlaceIsGhost, setActivePlaceIsGhost] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [showDirections, setShowDirections] = useState(false);
  const [showGhosts, setShowGhosts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedGhosts, setDismissedGhosts] = useState<Set<string>>(new Set());
  const dayScrollRef = useRef<HTMLDivElement>(null);

  // Saved store for library-based suggestions
  const savedPlaces = useSavedStore(s => s.myPlaces);
  const savedCollections = useSavedStore(s => s.collections);

  // Trip action for adding ghost suggestions to itinerary
  const placeFromSaved = useTripStore(s => s.placeFromSaved);

  // Sync: when store's currentDay changes externally (e.g. user was on DayPlanner and switched),
  // update our local selection to match — but only if we're not on "All"
  const prevStoreDay = useRef(storeCurrentDay);
  useEffect(() => {
    if (storeCurrentDay !== prevStoreDay.current) {
      prevStoreDay.current = storeCurrentDay;
      setSelectedDayLocal(storeCurrentDay);
    }
  }, [storeCurrentDay]);

  // Wrapper: when user picks a day in the map, update both local + store
  const setSelectedDay = useCallback((day: number | null) => {
    setSelectedDayLocal(day);
    if (day !== null) {
      setStoreCurrentDay(day);
    }
  }, [setStoreCurrentDay]);

  const isMobile = variant === 'mobile';

  // ─── Gather all placed items ───
  const allPlaced = useMemo(() => {
    if (!trip) return [];
    const items: PlacedItem[] = [];
    trip.days.forEach(day => {
      let orderIdx = 0;
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
            orderIndex: orderIdx++,
          });
        });
      });
    });
    return items;
  }, [trip]);

  // ─── Filter ───
  const filteredItems = useMemo(() => {
    let items = allPlaced;
    if (selectedDay !== null) items = items.filter(i => i.dayNumber === selectedDay);
    if (filterType !== 'all') items = items.filter(i => i.place.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.place.name.toLowerCase().includes(q) ||
        i.place.location?.toLowerCase().includes(q) ||
        i.place.type.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allPlaced, selectedDay, filterType, searchQuery]);

  // ═══════════════════════════════════════════════════════════════════════
  //  GHOST SUGGESTION ENGINE
  //  Tier 2: Claude-powered contextual suggestions via useTripSuggestions
  //  Tier 3 (future): Discovery — Terrazzo place intelligence API
  // ═══════════════════════════════════════════════════════════════════════
  const { suggestions: claudeSuggestions, isLoading: suggestionsLoading } = useTripSuggestions(
    trip, selectedDay,
    { enabled: showGhosts && selectedDay !== null, libraryPlaces: savedPlaces }
  );

  // Build ghost items from Claude suggestions by looking up full place data
  const ghostCandidates = useMemo((): GhostItem[] => {
    if (selectedDay === null || !trip) return [];
    const day = trip.days.find(d => d.dayNumber === selectedDay);
    if (!day) return [];

    const placedIds = new Set(allPlaced.map(p => p.place.id));

    return claudeSuggestions
      .map(s => {
        if (dismissedGhosts.has(s.placeId) || placedIds.has(s.placeId)) return null;
        const place = savedPlaces.find(p => p.id === s.placeId);
        if (!place || !place.google?.lat || !place.google?.lng) return null;

        return {
          place: {
            ...place,
            ghostSource: 'terrazzo' as GhostSourceType,
            terrazzoReasoning: { rationale: s.rationale, confidence: s.confidence },
          },
          dayNumber: selectedDay,
          slotId: s.targetSlot,
          destination: day.destination,
          tier: 'contextual' as GhostTier,
        };
      })
      .filter(Boolean) as GhostItem[];
  }, [claudeSuggestions, selectedDay, trip, allPlaced, savedPlaces, dismissedGhosts]);

  // ─── Build markers — NO dependency on activePlace to prevent flashing ───
  const { markers, fallbackDest, fallbackCoords } = useMemo(() => {
    if (!trip) return { markers: [] as MapMarker[], fallbackDest: '', fallbackCoords: undefined };

    // Confirmed itinerary markers — vibrant accent fill
    const confirmed: MapMarker[] = filteredItems.map((item, idx) => {
      const destColor = getDestColor(item.destination || '');
      return {
        id: item.place.id,
        name: item.place.name,
        location: item.place.location || item.destination || '',
        type: item.place.type,
        matchScore: item.place.matchScore,
        color: destColor.accent,
        tasteNote: item.place.tasteNote,
        count: showDirections ? idx + 1 : undefined,
      };
    });

    // Ghost suggestion markers — dashed, cream
    const ghostMkrs: MapMarker[] = showGhosts ? ghostCandidates.map(g => {
      const srcStyle = SOURCE_STYLES[(g.place.ghostSource || 'terrazzo') as GhostSourceType];
      return {
        id: g.place.id,
        name: g.place.name,
        location: g.place.location || g.destination || '',
        lat: g.place.google?.lat,
        lng: g.place.google?.lng,
        type: g.place.type,
        matchScore: g.place.matchScore,
        color: srcStyle?.color || INK['50'],
        tasteNote: g.place.tasteNote,
        isDashed: true,
      };
    }) : [];

    const firstDest = trip.days[0]?.destination || trip.location?.split(',')[0]?.trim() || '';
    const geo = trip.geoDestinations?.find(g => g.name.toLowerCase() === firstDest.toLowerCase());
    const coords = geo?.lat && geo?.lng ? { lat: geo.lat, lng: geo.lng } : undefined;

    return { markers: [...confirmed, ...ghostMkrs], fallbackDest: firstDest, fallbackCoords: coords };
  }, [trip, filteredItems, showDirections, ghostCandidates, showGhosts]);

  // ─── Active item (derived, not in useMemo dep of markers) ───
  const activeItem = useMemo(() =>
    filteredItems.find(i => i.place.id === activePlace),
    [filteredItems, activePlace]
  );

  // ─── Place count by day ───
  const dayCounts = useMemo(() => {
    if (!trip) return {};
    const counts: Record<number, number> = {};
    trip.days.forEach(d => {
      counts[d.dayNumber] = d.slots.reduce((a, s) => a + s.places.length, 0);
    });
    return counts;
  }, [trip]);

  // ─── Active ghost item ───
  const activeGhost = useMemo(() =>
    ghostCandidates.find(g => g.place.id === activePlace),
    [ghostCandidates, activePlace]
  );

  // ─── Handlers ───
  const handleMarkerTap = useCallback((id: string) => {
    setActivePlace(prev => prev === id ? null : id);
    // Determine if this is a ghost
    const isGhost = ghostCandidates.some(g => g.place.id === id);
    setActivePlaceIsGhost(isGhost);
  }, [ghostCandidates]);

  const handleOpenDetail = useCallback(() => {
    if (activeItem) onTapDetail(activeItem.place);
    else if (activeGhost) onTapDetail(activeGhost.place);
  }, [activeItem, activeGhost, onTapDetail]);

  const handleDismiss = useCallback(() => {
    setActivePlace(null);
    setActivePlaceIsGhost(false);
  }, []);

  const handleAddGhost = useCallback(() => {
    if (!activeGhost || !trip) return;
    // All ghost tiers use placeFromSaved — adds the place to the target slot
    placeFromSaved(activeGhost.place, activeGhost.dayNumber, activeGhost.slotId);
    setActivePlace(null);
    setActivePlaceIsGhost(false);
  }, [activeGhost, trip, placeFromSaved]);

  const handleDismissGhost = useCallback(() => {
    if (!activeGhost) return;
    // Hide locally for this session (all tiers)
    setDismissedGhosts(prev => new Set(prev).add(activeGhost.place.id));
    setActivePlace(null);
    setActivePlaceIsGhost(false);
  }, [activeGhost]);

  if (!trip) return null;

  // ─── Day pills (shared) ───
  const dayPills = (
    <>
      <button
        onClick={() => setSelectedDay(null)}
        className="px-3 py-1.5 rounded-full text-[11px] font-medium flex-shrink-0"
        style={{
          fontFamily: FONT.sans,
          background: selectedDay === null ? 'var(--t-ink)' : 'white',
          color: selectedDay === null ? 'var(--t-cream)' : INK['70'],
          border: selectedDay === null ? 'none' : '1px solid var(--t-linen)',
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'all 200ms ease',
        }}
      >
        All
      </button>
      {trip.days.map(d => {
        const isActive = selectedDay === d.dayNumber;
        const dColor = getDestColor(d.destination || '');
        return (
          <button
            key={d.dayNumber}
            onClick={() => setSelectedDay(isActive ? null : d.dayNumber)}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium flex-shrink-0"
            style={{
              fontFamily: FONT.sans,
              background: isActive ? dColor.accent : 'white',
              color: isActive ? 'white' : INK['70'],
              border: isActive ? 'none' : '1px solid var(--t-linen)',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              whiteSpace: 'nowrap',
              transition: 'all 200ms ease',
            }}
          >
            {dayPillLabel(d)}
          </button>
        );
      })}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  MOBILE LAYOUT — Apple Maps style
  // ═══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="relative flex flex-col flex-1 min-h-0" style={{ background: 'var(--t-cream)' }}>
        {/* Search bar */}
        <div
          className="absolute top-0 left-0 right-0 z-10 px-3 pt-2.5 pb-1"
          style={{ background: 'linear-gradient(to bottom, rgba(253,250,243,0.97) 60%, rgba(253,250,243,0))' }}
        >
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
              border: '1px solid rgba(255,255,255,0.6)',
            }}
          >
            <PerriandIcon name="pin" size={14} color={INK['40']} />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: FONT.sans, fontSize: 14, color: 'var(--t-ink)',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <PerriandIcon name="close" size={14} color={INK['40']} />
              </button>
            )}
          </div>
        </div>

        {/* Day pills + controls */}
        <div
          className="absolute z-10 left-0 right-0 flex items-center gap-2 px-3"
          style={{ top: 50 }}
        >
          <div
            ref={dayScrollRef}
            className="flex gap-1.5 flex-1 overflow-x-auto"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {dayPills}
          </div>
          {/* Ghost toggle — only visible when a day is selected */}
          {selectedDay !== null && (
            <button
              onClick={() => setShowGhosts(!showGhosts)}
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 34, height: 34,
                background: showGhosts ? 'rgba(107,139,154,0.9)' : 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                color: showGhosts ? 'white' : INK['60'],
                border: showGhosts ? 'none' : '1px solid rgba(255,255,255,0.6)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 200ms ease',
              }}
            >
              {suggestionsLoading ? (
                <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <PerriandIcon name="sparkle" size={15} color={showGhosts ? 'white' : INK['60']} />
              )}
            </button>
          )}
          <button
            onClick={() => setShowDirections(!showDirections)}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 34, height: 34,
              background: showDirections ? 'var(--t-verde)' : 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: showDirections ? 'white' : INK['60'],
              border: showDirections ? 'none' : '1px solid rgba(255,255,255,0.6)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'all 200ms ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-5-5 18-4-8-9-5z" />
            </svg>
          </button>
        </div>

        {/* Full-screen Google Map */}
        <div className="flex-1 min-h-0" style={{ position: 'relative' }}>
          <GoogleMapView
            markers={markers}
            height="100%"
            fallbackDestination={fallbackDest}
            fallbackCoords={fallbackCoords}
            onMarkerTap={handleMarkerTap}
            activeMarkerId={activePlace}
          />
        </div>

        {/* Place count pill — shows when no place selected */}
        {(() => {
          const hasActive = activeItem || activeGhost;
          const ghostCount = showGhosts ? ghostCandidates.length : 0;
          return (
            <div
              className="absolute z-20 left-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{
                bottom: hasActive ? -60 : 16,
                transform: 'translateX(-50%)',
                background: 'rgba(28,26,23,0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                color: 'var(--t-cream)',
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 500,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transition: 'bottom 350ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease',
                opacity: hasActive ? 0 : 1,
                pointerEvents: hasActive ? 'none' : 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <PerriandIcon name="pin" size={12} color="var(--t-cream)" />
              {filteredItems.length} place{filteredItems.length !== 1 ? 's' : ''}
              {ghostCount > 0 && (
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                  · {ghostCount} suggestion{ghostCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })()}

        {/* Confirmed place detail card */}
        <div
          className="absolute z-20 left-3 right-3"
          style={{
            bottom: (activeItem && !activePlaceIsGhost) ? 12 : -220,
            opacity: (activeItem && !activePlaceIsGhost) ? 1 : 0,
            transition: 'all 350ms cubic-bezier(0.32, 0.72, 0, 1)',
            pointerEvents: (activeItem && !activePlaceIsGhost) ? 'auto' : 'none',
          }}
        >
          {activeItem && !activePlaceIsGhost && (
            <MobileDetailCard
              item={activeItem}
              showDirections={showDirections}
              index={showDirections ? filteredItems.findIndex(i => i.place.id === activeItem.place.id) + 1 : undefined}
              onViewDetail={handleOpenDetail}
              onDismiss={handleDismiss}
              onDirections={() => {
                const q = encodeURIComponent(activeItem.place.name + (activeItem.place.location ? `, ${activeItem.place.location}` : ''));
                window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
              }}
            />
          )}
        </div>

        {/* Ghost place detail card */}
        <div
          className="absolute z-20 left-3 right-3"
          style={{
            bottom: activeGhost ? 12 : -220,
            opacity: activeGhost ? 1 : 0,
            transition: 'all 350ms cubic-bezier(0.32, 0.72, 0, 1)',
            pointerEvents: activeGhost ? 'auto' : 'none',
          }}
        >
          {activeGhost && (
            <MobileGhostCard
              ghost={activeGhost}
              onViewDetail={handleOpenDetail}
              onAdd={handleAddGhost}
              onDismiss={handleDismiss}
              onDismissGhost={handleDismissGhost}
            />
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DESKTOP LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-1 min-h-0" style={{ background: 'var(--t-cream)' }}>
      {/* Left sidebar */}
      <div
        className="flex flex-col h-full flex-shrink-0"
        style={{ width: 340, borderRight: '1px solid var(--t-linen)', background: 'white' }}
      >
        {/* Day tabs */}
        <div
          className="flex gap-1 px-3 pt-3 pb-2 flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: '1px solid var(--t-linen)', scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => setSelectedDay(null)}
            className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{
              fontFamily: FONT.sans,
              background: selectedDay === null ? 'var(--t-ink)' : 'transparent',
              color: selectedDay === null ? 'var(--t-cream)' : INK['60'],
              border: selectedDay === null ? 'none' : `1px solid ${INK['15']}`,
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            All Days
          </button>
          {trip.days.map(d => {
            const isActive = selectedDay === d.dayNumber;
            const dColor = getDestColor(d.destination || '');
            const count = dayCounts[d.dayNumber] || 0;
            return (
              <button
                key={d.dayNumber}
                onClick={() => setSelectedDay(isActive ? null : d.dayNumber)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap"
                style={{
                  fontFamily: FONT.sans,
                  background: isActive ? dColor.accent : 'transparent',
                  color: isActive ? 'white' : INK['60'],
                  border: isActive ? 'none' : `1px solid ${INK['15']}`,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                {dayPillLabel(d)}
                {count > 0 && (
                  <span
                    className="flex items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      width: 16, height: 16,
                      background: isActive ? 'rgba(255,255,255,0.25)' : INK['08'],
                      color: isActive ? 'white' : INK['50'],
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day context */}
        {selectedDay !== null && (() => {
          const day = trip.days.find(d => d.dayNumber === selectedDay);
          if (!day) return null;
          const dColor = getDestColor(day.destination || '');
          return (
            <div className="px-4 py-2.5 flex-shrink-0" style={{ background: dColor.bg, borderBottom: `1px solid ${dColor.accent}15` }}>
              <div className="flex items-center justify-between">
                <div>
                  <span style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 15, fontWeight: 600, color: dColor.text }}>
                    {day.destination || 'Day ' + day.dayNumber}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, color: dColor.accent }}>
                      {day.dayOfWeek ? `${day.dayOfWeek.slice(0, 3)} ${day.date}` : `Day ${day.dayNumber}`}
                    </span>
                    {(day.hotelInfo || day.hotel) && (
                      <span className="flex items-center gap-1" style={{ fontFamily: FONT.sans, fontSize: 10, color: dColor.accent }}>
                        <PerriandIcon name="hotel" size={10} color={dColor.accent} />
                        {day.hotelInfo?.name || day.hotel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowGhosts(!showGhosts)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium"
                    style={{
                      fontFamily: FONT.sans,
                      background: showGhosts ? 'rgba(107,139,154,0.15)' : INK['04'],
                      color: showGhosts ? '#4a6e7a' : INK['60'],
                      border: showGhosts ? '1px solid rgba(107,139,154,0.3)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {suggestionsLoading ? (
                      <div style={{ width: 11, height: 11, border: '1.5px solid rgba(74,110,122,0.3)', borderTop: '1.5px solid #4a6e7a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <PerriandIcon name="sparkle" size={11} color={showGhosts ? '#4a6e7a' : INK['60']} />
                    )}
                    {suggestionsLoading ? 'Loading...' : 'Suggestions'}
                  </button>
                  <button
                    onClick={() => setShowDirections(!showDirections)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium"
                    style={{
                      fontFamily: FONT.sans,
                      background: showDirections ? 'var(--t-verde)' : INK['04'],
                      color: showDirections ? 'white' : INK['60'],
                      border: 'none', cursor: 'pointer',
                      transition: 'all 200ms ease',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l18-5-5 18-4-8-9-5z" />
                    </svg>
                    Route
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Search + filters */}
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-1"
            style={{ background: INK['03'], border: `1px solid ${INK['08']}` }}
          >
            <PerriandIcon name="pin" size={12} color={INK['40']} />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: FONT.sans, fontSize: 11, color: 'var(--t-ink)',
              }}
            />
          </div>
        </div>

        {/* Place list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 pb-4" style={{ scrollbarWidth: 'thin' }}>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PerriandIcon name="pin" size={32} color={INK['20']} />
              <span style={{ fontFamily: FONT.sans, fontSize: 13, color: INK['40'], marginTop: 12 }}>
                No places{selectedDay !== null ? ` on Day ${selectedDay}` : ''} yet
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredItems.map((item, idx) => (
                <SidebarPlaceCard
                  key={`${item.dayNumber}-${item.slotId}-${item.place.id}`}
                  item={item}
                  index={showDirections ? idx + 1 : undefined}
                  isActive={activePlace === item.place.id}
                  showDay={selectedDay === null}
                  onTap={() => onTapDetail(item.place)}
                  onHover={() => setActivePlace(item.place.id)}
                  onLeave={() => { if (activePlace === item.place.id) setActivePlace(null); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: map */}
      <div className="flex-1 min-w-0" style={{ position: 'relative' }}>
        <GoogleMapView
          markers={markers}
          height="100%"
          fallbackDestination={fallbackDest}
          fallbackCoords={fallbackCoords}
          onMarkerTap={handleMarkerTap}
          activeMarkerId={activePlace}
        />

        {/* Floating detail card on map — confirmed */}
        <div
          className="absolute bottom-4 left-4 right-4 z-10"
          style={{
            maxWidth: 420, margin: '0 auto',
            opacity: (activeItem && !activePlaceIsGhost) ? 1 : 0,
            transform: (activeItem && !activePlaceIsGhost) ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 300ms cubic-bezier(0.32, 0.72, 0, 1)',
            pointerEvents: (activeItem && !activePlaceIsGhost) ? 'auto' : 'none',
          }}
        >
          {activeItem && !activePlaceIsGhost && (
            <DesktopDetailCard
              item={activeItem}
              onClose={handleDismiss}
              onViewDetail={handleOpenDetail}
            />
          )}
        </div>

        {/* Floating ghost card on map */}
        <div
          className="absolute bottom-4 left-4 right-4 z-10"
          style={{
            maxWidth: 420, margin: '0 auto',
            opacity: activeGhost ? 1 : 0,
            transform: activeGhost ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 300ms cubic-bezier(0.32, 0.72, 0, 1)',
            pointerEvents: activeGhost ? 'auto' : 'none',
          }}
        >
          {activeGhost && (
            <DesktopGhostCard
              ghost={activeGhost}
              onClose={handleDismiss}
              onViewDetail={handleOpenDetail}
              onAdd={handleAddGhost}
              onDismissGhost={handleDismissGhost}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripMapView);


// ═══════════════════════════════════════════════════════════════════════════
//  MOBILE DETAIL CARD — Apple Maps inspired
// ═══════════════════════════════════════════════════════════════════════════
function MobileDetailCard({
  item, index, showDirections, onViewDetail, onDismiss, onDirections,
}: {
  item: PlacedItem;
  index?: number;
  showDirections: boolean;
  onViewDetail: () => void;
  onDismiss: () => void;
  onDirections: () => void;
}) {
  const { place } = item;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(item.destination || '');

  return (
    <div
      className="rounded-2xl overflow-hidden"
      onClick={onViewDetail}
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid rgba(255,255,255,0.7)',
        cursor: 'pointer',
      }}
    >
      {/* Swipe handle */}
      <div className="flex justify-center pt-2 pb-1" onClick={(e) => { e.stopPropagation(); onDismiss(); }} style={{ cursor: 'pointer' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: INK['15'] }} />
      </div>

      <div className="px-4 pb-3">
        {/* Name row */}
        <div className="flex items-center gap-3 mb-2">
          {index != null ? (
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: destColor.accent, color: 'white',
                fontFamily: FONT.mono, fontSize: 14, fontWeight: 700,
                boxShadow: `0 2px 8px ${destColor.accent}40`,
              }}
            >
              {index}
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 40, height: 40, background: `${destColor.accent}10` }}
            >
              <PerriandIcon name={typeIcon} size={20} color={destColor.accent} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: FONT.serif, fontSize: 17, fontWeight: 600,
                color: 'var(--t-ink)', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {place.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['50'] }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {place.location && (
                <>
                  <span style={{ color: INK['20'] }}>·</span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['50'] }}>
                    {place.location.split(',')[0]}
                  </span>
                </>
              )}
            </div>
          </div>
          {place.matchScore && (
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                fontFamily: FONT.mono, fontSize: 13, fontWeight: 700,
                color: '#c8923a', background: 'rgba(200,146,58,0.08)',
                padding: '4px 8px',
              }}
            >
              {place.matchScore}%
            </div>
          )}
          {/* Chevron hint */}
          <div className="flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK['30']} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Taste note */}
        {(place.terrazzoInsight?.why || place.tasteNote) && (
          <p style={{
            fontFamily: FONT.sans, fontSize: 12, color: INK['60'],
            fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden',
          }}>
            {place.terrazzoInsight?.why || place.tasteNote}
          </p>
        )}

        {/* Info chips + directions button inline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className="px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ fontSize: 10, fontWeight: 600, background: destColor.bg, color: destColor.accent, fontFamily: FONT.mono }}
            >
              Day {item.dayNumber} · {item.slotTime}
            </span>
            {place.google?.rating && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md" style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['60'], background: INK['04'] }}>
                ★ {place.google.rating}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDirections(); }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg"
            style={{
              background: INK['04'], border: `1px solid ${INK['08']}`, color: INK['60'],
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-5-5 18-4-8-9-5z" />
            </svg>
            Directions
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  MOBILE GHOST CARD — dashed cream card for suggestions
// ═══════════════════════════════════════════════════════════════════════════
function MobileGhostCard({
  ghost, onViewDetail, onAdd, onDismiss, onDismissGhost,
}: {
  ghost: GhostItem;
  onViewDetail: () => void;
  onAdd: (g: GhostItem) => void;
  onDismiss: () => void;
  onDismissGhost: (ghostId: string) => void;
}) {
  const { place } = ghost;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(ghost.destination || '');
  const srcStyle = SOURCE_STYLES[(place.ghostSource || 'terrazzo') as GhostSourceType] || SOURCE_STYLES.terrazzo;

  return (
    <div
      style={{
        background: '#faf6ef',
        borderRadius: 20,
        border: '1.5px dashed rgba(0,0,0,0.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center py-2">
        <div style={{ width: 36, height: 4, borderRadius: 2, background: INK['15'] }} />
      </div>

      <div
        className="px-4 pb-4 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 40, height: 40, background: `${destColor.accent}10`, border: `1px dashed ${destColor.accent}30` }}
          >
            <PerriandIcon name={typeIcon} size={20} color={destColor.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: FONT.serif, fontSize: 17, fontWeight: 600,
                color: 'var(--t-ink)', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {place.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                style={{ fontSize: 10, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}
              >
                <PerriandIcon name={srcStyle.icon} size={9} color={srcStyle.color} />
                {srcStyle.label}
              </span>
              <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['50'] }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {place.location && (
                <>
                  <span style={{ color: INK['20'] }}>·</span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['50'] }}>
                    {place.location.split(',')[0]}
                  </span>
                </>
              )}
            </div>
          </div>
          {place.matchScore && (
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                fontFamily: FONT.mono, fontSize: 13, fontWeight: 700,
                color: '#c8923a', background: 'rgba(200,146,58,0.08)',
                padding: '4px 8px',
              }}
            >
              {place.matchScore}%
            </div>
          )}
        </div>

        {/* Taste note */}
        {(place.terrazzoInsight?.why || place.tasteNote) && (
          <p style={{
            fontFamily: FONT.sans, fontSize: 12, color: INK['60'],
            fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden',
          }}>
            {place.terrazzoInsight?.why || place.tasteNote}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(ghost); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: 'var(--t-verde, #3a7d44)', border: 'none',
              color: 'white', fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add to Day {ghost.dayNumber}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissGhost(place.id);
              onDismiss();
            }}
            className="flex items-center justify-center px-4 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: INK['04'], border: `1px solid ${INK['08']}`,
              color: INK['50'], fontFamily: FONT.sans, fontSize: 12, fontWeight: 500,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  SIDEBAR PLACE CARD — desktop list
// ═══════════════════════════════════════════════════════════════════════════
function SidebarPlaceCard({
  item, index, isActive, showDay, onTap, onHover, onLeave,
}: {
  item: PlacedItem;
  index?: number;
  isActive: boolean;
  showDay: boolean;
  onTap: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const { place } = item;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(item.destination || '');

  return (
    <div
      onClick={onTap}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer"
      style={{
        background: isActive ? `${destColor.accent}06` : 'white',
        border: isActive ? `1.5px solid ${destColor.accent}30` : '1px solid transparent',
        boxShadow: isActive ? `0 2px 12px ${destColor.accent}12` : 'none',
        transition: 'all 180ms ease',
      }}
    >
      {index !== undefined ? (
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 24, height: 24,
            background: destColor.accent, color: 'white',
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
          }}
        >
          {index}
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 32, height: 32, background: INK['04'] }}
        >
          <PerriandIcon name={typeIcon} size={16} color="var(--t-ink)" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span style={{
          fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: 'var(--t-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
        }}>
          {place.name}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}>
            {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
          </span>
          {showDay && (
            <span className="px-1.5 rounded-full" style={{
              fontFamily: FONT.mono, fontSize: 8, fontWeight: 600,
              background: destColor.bg, color: destColor.accent,
            }}>
              D{item.dayNumber}
            </span>
          )}
          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['30'] }}>
            {item.slotTime}
          </span>
        </div>
      </div>
      {place.matchScore && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{
          fontFamily: FONT.mono, color: '#c8923a', background: 'rgba(200,146,58,0.08)',
        }}>
          {place.matchScore}%
        </span>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  DESKTOP DETAIL CARD — floating on map
// ═══════════════════════════════════════════════════════════════════════════
function DesktopDetailCard({
  item, onClose, onViewDetail,
}: {
  item: PlacedItem;
  onClose: () => void;
  onViewDetail: () => void;
}) {
  const { place } = item;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(item.destination || '');
  const srcStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid rgba(255,255,255,0.7)',
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: destColor.bg, borderBottom: `1px solid ${destColor.accent}15` }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 9, color: destColor.accent, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
          {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <PerriandIcon name="close" size={16} color={INK['40']} />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: `${destColor.accent}10` }}>
            <PerriandIcon name={typeIcon} size={22} color={destColor.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: FONT.serif, fontSize: 16, fontWeight: 600, color: 'var(--t-ink)' }}>{place.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {place.location && <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}>{place.location.split(',')[0]}</span>}
            </div>
          </div>
          {place.matchScore && (
            <span className="px-2 py-1 rounded-lg" style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: '#c8923a', background: 'rgba(200,146,58,0.08)' }}>
              {place.matchScore}%
            </span>
          )}
        </div>

        {(place.terrazzoInsight?.why || place.tasteNote) && (
          <p style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['60'], fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0' }}>
            {place.terrazzoInsight?.why || place.tasteNote}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="px-2 py-0.5 rounded-md flex items-center gap-0.5" style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}>
            <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
            {place.source?.name || srcStyle.label}
          </span>
          <span className="px-2 py-0.5 rounded-md flex items-center gap-0.5" style={{ fontSize: 9, fontWeight: 600, background: destColor.bg, color: destColor.accent, fontFamily: FONT.mono }}>
            Day {item.dayNumber} · {item.slotTime}
          </span>
          {place.google?.rating && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md" style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['60'], background: INK['04'] }}>
              ★ {place.google.rating}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'var(--t-ink)', border: 'none', color: 'var(--t-cream)', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600 }}
          >
            View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const q = encodeURIComponent(place.name + (place.location ? `, ${place.location}` : ''));
              window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
            }}
            className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl cursor-pointer"
            style={{ background: INK['04'], border: `1px solid ${INK['08']}`, color: INK['60'], fontFamily: FONT.sans, fontSize: 12, fontWeight: 500 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-5-5 18-4-8-9-5z" />
            </svg>
            Directions
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  DESKTOP GHOST CARD — floating suggestion card on map
// ═══════════════════════════════════════════════════════════════════════════
function DesktopGhostCard({
  ghost, onClose, onViewDetail, onAdd, onDismissGhost,
}: {
  ghost: GhostItem;
  onClose: () => void;
  onViewDetail: () => void;
  onAdd: (g: GhostItem) => void;
  onDismissGhost: (ghostId: string) => void;
}) {
  const { place } = ghost;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(ghost.destination || '');
  const srcStyle = SOURCE_STYLES[(place.ghostSource || 'terrazzo') as GhostSourceType] || SOURCE_STYLES.terrazzo;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(250,246,239,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1.5px dashed rgba(0,0,0,0.12)',
      }}
    >
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: `${destColor.accent}06`, borderBottom: '1px dashed rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
            style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}
          >
            <PerriandIcon name={srcStyle.icon} size={9} color={srcStyle.color} />
            {srcStyle.label}
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['40'], textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
            Suggestion
          </span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <PerriandIcon name="close" size={16} color={INK['40']} />
        </button>
      </div>

      <div className="px-4 py-3">
        {/* Place info */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: `${destColor.accent}10`, border: `1px dashed ${destColor.accent}30` }}
          >
            <PerriandIcon name={typeIcon} size={22} color={destColor.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: FONT.serif, fontSize: 16, fontWeight: 600, color: 'var(--t-ink)' }}>{place.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {place.location && (
                <>
                  <span style={{ color: INK['20'] }}>·</span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}>{place.location.split(',')[0]}</span>
                </>
              )}
            </div>
          </div>
          {place.matchScore && (
            <span className="px-2 py-1 rounded-lg" style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: '#c8923a', background: 'rgba(200,146,58,0.08)' }}>
              {place.matchScore}%
            </span>
          )}
        </div>

        {/* Taste note */}
        {(place.terrazzoInsight?.why || place.tasteNote) && (
          <p style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['60'], fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0' }}>
            {place.terrazzoInsight?.why || place.tasteNote}
          </p>
        )}

        {/* Info chips */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {place.google?.rating && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md" style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['60'], background: INK['04'] }}>
              ★ {place.google.rating}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(ghost); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: 'var(--t-verde, #3a7d44)', border: 'none',
              color: 'white', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add to Day {ghost.dayNumber}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${INK['08']}`, color: INK['60'], fontFamily: FONT.sans, fontSize: 12, fontWeight: 500 }}
          >
            Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissGhost(place.id);
              onClose();
            }}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'transparent', border: `1px solid ${INK['08']}`, color: INK['40'], fontFamily: FONT.sans, fontSize: 11, fontWeight: 500 }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
