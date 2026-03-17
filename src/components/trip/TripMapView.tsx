'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import GoogleMapView from '@/components/maps/GoogleMapView';
import type { MapMarker } from '@/components/maps/GoogleMapView';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, TEXT, INK } from '@/constants/theme';
import { SOURCE_STYLES, GhostSourceType, ImportedPlace } from '@/types';
import { generateDestColor } from '@/lib/destination-helpers';
import { useTripSuggestions } from '@/hooks/useTripSuggestions';
import { trackInteraction } from '@/lib/interaction-tracker';
import {
  MobileDetailCard,
  MobileGhostCard,
  SidebarPlaceCard,
  DesktopDetailCard,
  DesktopGhostCard,
  type PlacedItem,
  type GhostItem,
  type GhostTier,
} from '@/components/trip-map';

// ─── Types ───
interface TripMapViewProps {
  onTapDetail: (item: ImportedPlace) => void;
  variant: 'mobile' | 'desktop';
}

// ─── Helpers ───
const getDestColor = generateDestColor;

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

    // Track map_pin_tap interaction
    const allItems = [...filteredItems, ...ghostCandidates];
    const tapped = allItems.find(i => i.place.id === id);
    const gpid = tapped?.place.google?.placeId;
    if (gpid) {
      trackInteraction('map_pin_tap', gpid, 'trip_map', {
        tripId: trip?.id,
        placeType: tapped?.place.type,
      });
    }
  }, [ghostCandidates, filteredItems, trip?.id]);

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
              background: showDirections ? 'var(--t-dark-teal)' : 'rgba(255,255,255,0.92)',
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
                background: 'rgba(0,42,85,0.85)',
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
                      background: showDirections ? 'var(--t-dark-teal)' : INK['04'],
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
              <span style={{ fontFamily: FONT.sans, fontSize: 13, color: TEXT.secondary, marginTop: 12 }}>
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
