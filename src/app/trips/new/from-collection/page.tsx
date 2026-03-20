'use client';

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSavedStore } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import DestinationInput, { Destination } from '@/components/trip/DestinationInput';
import DestinationAllocator from '@/components/trip/DestinationAllocator';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import DesktopNav from '@/components/ui/DesktopNav';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { FONT, INK, TEXT } from '@/constants/theme';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';
import { ImportedPlace, TravelContext, TripStatus, GeoDestination, PlaceType } from '@/types';
import { getMatchTier, shouldShowTierBadge } from '@/lib/match-tier';
import { TYPE_COLORS_VIBRANT } from '@/constants/placeTypes';

// ─── Companion options ───────────────────────────────────────────────────────
const COMPANION_OPTIONS: { label: string; iconName: PerriandIconName; key: TravelContext }[] = [
  { label: 'Just me', iconName: 'profile', key: 'solo' },
  { label: 'With partner', iconName: 'heart', key: 'partner' },
  { label: 'With friends', iconName: 'friend', key: 'friends' },
  { label: 'With family', iconName: 'star', key: 'family' },
];

// ─── Place mini-card ─────────────────────────────────────────────────────────
function PlacePill({
  place,
  onRemove,
  compact,
}: {
  place: ImportedPlace;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const typeColor = TYPE_COLORS_VIBRANT[place.type as PlaceType] || TYPE_COLORS_VIBRANT.activity;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: 'white',
        border: `1px solid ${INK['08']}`,
      }}
    >
      {place.google?.photoUrl && (
        <div
          className="w-8 h-8 rounded-lg bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url(${place.google.photoUrl})` }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium truncate" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
          {place.name}
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.5px]"
              style={{ color: typeColor, fontFamily: FONT.mono }}
            >
              {place.type}
            </span>
            {place.location && (
              <span className="text-[10px] truncate" style={{ color: TEXT.secondary }}>
                {place.location.split(',')[0]}
              </span>
            )}
          </div>
        )}
      </div>
      {shouldShowTierBadge(place.matchScore) && (() => {
        const tier = getMatchTier(place.matchScore);
        return (
          <span
            className="text-[10px] font-bold flex-shrink-0"
            style={{ color: tier.color, fontFamily: FONT.mono }}
          >
            {tier.shortLabel}
          </span>
        );
      })()}
      {onRemove && (
        <button
          onClick={onRemove}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ background: INK['06'], border: 'none' }}
          title="Remove"
        >
          <PerriandIcon name="close" size={8} color={TEXT.secondary} />
        </button>
      )}
    </div>
  );
}

// ─── Library search for adding extra places ──────────────────────────────────
function LibrarySearch({
  excludeIds,
  onAdd,
}: {
  excludeIds: Set<string>;
  onAdd: (place: ImportedPlace) => void;
}) {
  const myPlaces = useSavedStore(s => s.myPlaces);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return myPlaces
      .filter(p => !excludeIds.has(p.id))
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [myPlaces, query, excludeIds]);

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <PerriandIcon
          name="discover"
          size={14}
          color={TEXT.secondary}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search your library to add more places..."
          className="w-full text-[13px] py-2.5 pl-9 pr-3 rounded-xl border outline-none"
          style={{
            fontFamily: FONT.sans,
            color: TEXT.primary,
            borderColor: INK['10'],
            background: 'white',
          }}
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onAdd(p); setQuery(''); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-left w-full"
              style={{ background: INK['02'], border: `1px solid transparent` }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                  {p.name}
                </div>
                <div className="text-[10px]" style={{ color: TEXT.secondary }}>
                  {p.type} · {p.location?.split(',')[0]}
                </div>
              </div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}>
                + Add
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page content ───────────────────────────────────────────────────────
function FromCollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const collectionId = searchParams.get('id');
  const isDesktop = useIsDesktop();

  // Stores
  const myPlaces = useSavedStore(s => s.myPlaces);
  const collections = useSavedStore(s => s.collections);
  const createTripAsync = useTripStore(s => s.createTripAsync);

  // Find the collection
  const collection = useMemo(
    () => collections.find(c => c.id === collectionId),
    [collections, collectionId],
  );

  // Places from the collection
  const collectionPlaces = useMemo(() => {
    if (!collection) return [];
    return collection.placeIds
      .map(id => myPlaces.find(p => p.id === id))
      .filter(Boolean) as ImportedPlace[];
  }, [collection, myPlaces]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedPlaces, setSelectedPlaces] = useState<ImportedPlace[]>(() => collectionPlaces);
  const [step, setStep] = useState<'places' | 'details' | 'allocate'>('places');
  const [creating, setCreating] = useState(false);

  // Trip details
  const [tripName, setTripName] = useState(collection?.name || '');
  const [geoDestinations, setGeoDestinations] = useState<Destination[]>([]);
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [numDays, setNumDays] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companion, setCompanion] = useState<TravelContext | null>(null);
  const [groupSize, setGroupSize] = useState('');
  const [status, setStatus] = useState<TripStatus>('planning');
  const [dayAllocation, setDayAllocation] = useState<Record<string, number>>({});

  // Keep selectedPlaces in sync when collectionPlaces loads (async hydration)
  const [initialized, setInitialized] = useState(false);
  if (!initialized && collectionPlaces.length > 0) {
    setSelectedPlaces(collectionPlaces);
    setInitialized(true);
  }

  // Derive cities from selected places for auto-destination
  const placeCities = useMemo(() => {
    const cityCount: Record<string, number> = {};
    selectedPlaces.forEach(p => {
      const parts = p.location?.split(',').map(s => s.trim()) || [];
      const city = parts.length >= 2 ? parts[parts.length - 1] : parts[0];
      if (city) cityCount[city] = (cityCount[city] || 0) + 1;
    });
    return Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count }));
  }, [selectedPlaces]);

  // Pre-fill destinations from place cities when entering details step
  const initDestinations = useCallback(() => {
    if (geoDestinations.length === 0 && placeCities.length > 0) {
      setGeoDestinations(
        placeCities.slice(0, 3).map(c => ({ name: c.city }))
      );
    }
  }, [geoDestinations.length, placeCities]);

  const excludeIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);

  const addPlace = (place: ImportedPlace) => {
    if (!excludeIds.has(place.id)) {
      setSelectedPlaces(prev => [...prev, place]);
    }
  };

  const removePlace = (placeId: string) => {
    setSelectedPlaces(prev => prev.filter(p => p.id !== placeId));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handlePlacesNext = () => {
    initDestinations();
    setStep('details');
  };

  const totalNights = useMemo(() => {
    if (flexibleDates) return Math.max(1, parseInt(numDays) || 5);
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  }, [flexibleDates, numDays, startDate, endDate]);

  const destinationNames = geoDestinations.map(d => d.name);
  const isMultiCity = destinationNames.length > 1;

  const handleDetailsNext = () => {
    if (isMultiCity && status === 'planning') {
      // Init allocation
      const perDest = Math.floor(totalNights / destinationNames.length);
      const remainder = totalNights - perDest * destinationNames.length;
      const alloc: Record<string, number> = {};
      destinationNames.forEach((dest, i) => {
        alloc[dest] = perDest + (i < remainder ? 1 : 0);
      });
      setDayAllocation(alloc);
      setStep('allocate');
    } else {
      handleCreate();
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);

    const effectiveName = tripName.trim() || destinationNames.join(' & ') || collection?.name || 'Trip';
    const pool = selectedPlaces.map(p => ({
      ...p,
      libraryPlaceId: p.libraryPlaceId || p.id,
      status: 'available' as const,
    }));

    try {
      const tripId = await createTripAsync({
        name: effectiveName,
        destinations: destinationNames.length > 0 ? destinationNames : [placeCities[0]?.city || 'Trip'],
        geoDestinations: geoDestinations as GeoDestination[],
        flexibleDates: flexibleDates || undefined,
        numDays: flexibleDates ? Math.max(1, parseInt(numDays) || 5) : undefined,
        startDate: flexibleDates ? '' : (startDate || ''),
        endDate: flexibleDates ? '' : (endDate || ''),
        travelContext: companion || 'solo',
        groupSize: groupSize ? parseInt(groupSize) : undefined,
        status,
        dayAllocation: isMultiCity ? dayAllocation : undefined,
        pool,
        sourceCollectionId: collectionId || undefined,
      });

      router.push(`/trips/${tripId}`);
    } catch (err) {
      console.error('Failed to create trip from collection:', err);
      setCreating(false);
    }
  };

  // ── Loading / not found ────────────────────────────────────────────────────
  if (!collectionId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: TEXT.secondary }}>
        No collection specified
      </div>
    );
  }

  if (!collection && collections.length > 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: TEXT.secondary }}>
        <p className="text-[14px]">Collection not found</p>
        <button
          onClick={() => router.push('/saved')}
          className="text-[13px] bg-transparent border-none cursor-pointer"
          style={{ color: TEXT.accent }}
        >
          ← Back to Library
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const content = (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="px-6 pt-6 pb-10 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* ═══ STEP 1: PLACES ═══ */}
          {step === 'places' && (
            <motion.div
              key="places"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.4 } }}
              exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
            >
              {/* Header */}
              <div className="text-center mb-8">
                <SafeFadeIn delay={0.1} direction="up" distance={12}>
                  <PerriandIcon name="trips" size={40} color="var(--t-dark-teal)" />
                </SafeFadeIn>
                <SafeFadeIn delay={0.16} direction="up" distance={12}>
                  <h1
                    className="text-2xl mt-3 mb-2"
                    style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary }}
                  >
                    Plan a Trip
                  </h1>
                </SafeFadeIn>
                <SafeFadeIn delay={0.22} direction="up" distance={12}>
                  <p className="text-[13px] leading-relaxed" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                    {collection
                      ? <>Starting from <strong style={{ color: TEXT.primary }}>{collection.name}</strong> · {selectedPlaces.length} place{selectedPlaces.length !== 1 ? 's' : ''}</>
                      : 'Loading collection...'
                    }
                  </p>
                </SafeFadeIn>
              </div>

              {/* Place list */}
              <div className="mb-5">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                >
                  YOUR PLACES ({selectedPlaces.length})
                </label>
                <div className="flex flex-col gap-1.5">
                  {selectedPlaces.map(p => (
                    <PlacePill
                      key={p.id}
                      place={p}
                      onRemove={() => removePlace(p.id)}
                    />
                  ))}
                </div>
              </div>

              {/* City summary */}
              {placeCities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {placeCities.map(c => (
                    <span
                      key={c.city}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}
                    >
                      {c.city} ({c.count})
                    </span>
                  ))}
                </div>
              )}

              {/* Add more from library */}
              <div className="mb-8">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                >
                  ADD MORE FROM YOUR LIBRARY
                </label>
                <LibrarySearch excludeIds={excludeIds} onAdd={addPlace} />
              </div>

              {/* CTA */}
              <button
                onClick={handlePlacesNext}
                disabled={selectedPlaces.length === 0}
                className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold transition-all disabled:opacity-30"
                style={{ background: TEXT.primary, color: TEXT.inverse, fontFamily: FONT.sans }}
              >
                Next: Trip Details
              </button>

              <button
                onClick={() => router.back()}
                className="w-full text-center text-[12px] bg-transparent border-none cursor-pointer py-3 mt-1"
                style={{ color: TEXT.secondary }}
              >
                ← Back to collection
              </button>
            </motion.div>
          )}

          {/* ═══ STEP 2: TRIP DETAILS ═══ */}
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.4 } }}
              exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
            >
              <div className="text-center mb-8">
                <PerriandIcon name="pin" size={40} color="var(--t-dark-teal)" />
                <h1
                  className="text-2xl mt-3 mb-2"
                  style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary }}
                >
                  Trip Details
                </h1>
                <p className="text-[13px] leading-relaxed" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                  {selectedPlaces.length} place{selectedPlaces.length !== 1 ? 's' : ''} ready to go. Set the details for your trip.
                </p>
              </div>

              {/* Trip Name */}
              <div className="mb-6">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                >
                  TRIP NAME
                </label>
                <input
                  type="text"
                  value={tripName}
                  onChange={e => setTripName(e.target.value)}
                  placeholder={destinationNames.join(' & ') || collection?.name || 'My Trip'}
                  className="w-full text-base pb-2.5 bg-transparent border-0 border-b outline-none"
                  style={{ fontFamily: FONT.sans, color: TEXT.primary, borderColor: 'var(--t-linen)' }}
                />
              </div>

              {/* Destination */}
              <div className="mb-6">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                >
                  WHERE
                </label>
                <DestinationInput
                  destinations={geoDestinations}
                  onChange={setGeoDestinations}
                  isDreaming={status === 'dreaming'}
                />
                {placeCities.length > 0 && geoDestinations.length === 0 && (
                  <div className="mt-2">
                    <span className="text-[10px]" style={{ color: TEXT.secondary }}>
                      Suggested from your places:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {placeCities.slice(0, 4).map(c => (
                        <button
                          key={c.city}
                          onClick={() => setGeoDestinations(prev => [...prev, { name: c.city }])}
                          className="px-2 py-0.5 rounded-full text-[10px] cursor-pointer"
                          style={{
                            background: 'rgba(58,128,136,0.08)',
                            color: 'var(--t-dark-teal)',
                            border: '1px solid rgba(58,128,136,0.15)',
                            fontFamily: FONT.mono,
                          }}
                        >
                          + {c.city}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="mb-6">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                >
                  TRIP STATUS
                </label>
                <div className="flex gap-2">
                  {([
                    { key: 'planning' as TripStatus, label: 'Planning', iconName: 'pin' as PerriandIconName, desc: 'Dates committed, ready to build' },
                    { key: 'dreaming' as TripStatus, label: 'Dreaming', iconName: 'star' as PerriandIconName, desc: 'Still taking shape' },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setStatus(opt.key)}
                      className="flex-1 flex flex-col items-start gap-1 p-3 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: status === opt.key ? INK['03'] : 'white',
                        borderColor: status === opt.key ? TEXT.primary : 'var(--t-linen)',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <PerriandIcon name={opt.iconName} size={14} color={status === opt.key ? 'var(--t-dark-teal)' : TEXT.secondary} />
                        <span className="text-[12px] font-medium" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-[10px]" style={{ color: TEXT.secondary }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates — only show for planning status */}
              {status === 'planning' && (
                <div className="mb-6">
                  <label
                    className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                    style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                  >
                    WHEN
                  </label>
                  <div className="flex gap-2 mb-3">
                    {([
                      { key: false, label: 'Specific dates' },
                      { key: true, label: 'Flexible / undecided' },
                    ] as const).map(opt => (
                      <button
                        key={String(opt.key)}
                        onClick={() => setFlexibleDates(opt.key)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full border cursor-pointer transition-all text-[11px]"
                        style={{
                          background: flexibleDates === opt.key ? TEXT.primary : 'white',
                          color: flexibleDates === opt.key ? TEXT.inverse : TEXT.primary,
                          borderColor: flexibleDates === opt.key ? TEXT.primary : 'var(--t-linen)',
                          fontFamily: FONT.sans,
                          fontWeight: 500,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {flexibleDates ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={numDays}
                        onChange={e => setNumDays(e.target.value)}
                        className="w-20 text-center text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                        style={{ fontFamily: FONT.sans, color: TEXT.primary, borderColor: 'var(--t-linen)' }}
                      />
                      <span className="text-[12px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>nights</span>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => {
                            const v = e.target.value;
                            setStartDate(v);
                            if (v && (!endDate || endDate <= v)) {
                              const next = new Date(v + 'T00:00:00');
                              next.setDate(next.getDate() + 1);
                              setEndDate(next.toISOString().split('T')[0]);
                            }
                          }}
                          className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                          style={{ fontFamily: FONT.sans, color: TEXT.primary, borderColor: 'var(--t-linen)' }}
                        />
                        <span className="text-[9px] mt-1 block" style={{ color: TEXT.secondary }}>Start</span>
                      </div>
                      <div className="flex items-center text-xs" style={{ color: TEXT.secondary }}>→</div>
                      <div className="flex-1">
                        <input
                          type="date"
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          min={startDate || undefined}
                          className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                          style={{ fontFamily: FONT.sans, color: TEXT.primary, borderColor: 'var(--t-linen)' }}
                        />
                        <span className="text-[9px] mt-1 block" style={{ color: TEXT.secondary }}>End</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Companions */}
              <div className="mb-6">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.secondary }}
                >
                  WHO&apos;S COMING
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPANION_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setCompanion(opt.key)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border cursor-pointer transition-all text-[12px]"
                      style={{
                        background: companion === opt.key ? TEXT.primary : 'white',
                        color: companion === opt.key ? TEXT.inverse : TEXT.primary,
                        borderColor: companion === opt.key ? TEXT.primary : 'var(--t-linen)',
                        fontFamily: FONT.sans,
                        fontWeight: 500,
                      }}
                    >
                      <PerriandIcon name={opt.iconName} size={16} color={companion === opt.key ? 'white' : TEXT.primary} />
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(companion === 'friends' || companion === 'family') && (
                  <div className="mt-3">
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={groupSize}
                      onChange={e => setGroupSize(e.target.value)}
                      placeholder="How many people?"
                      className="w-40 text-sm pb-2 bg-transparent border-0 border-b outline-none"
                      style={{ fontFamily: FONT.sans, color: TEXT.primary, borderColor: 'var(--t-linen)' }}
                    />
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={handleDetailsNext}
                disabled={geoDestinations.length === 0 || creating}
                className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold transition-all disabled:opacity-30"
                style={{ background: TEXT.primary, color: TEXT.inverse, fontFamily: FONT.sans }}
              >
                {creating ? 'Creating...' : (isMultiCity && status === 'planning' ? 'Next: Allocate Nights' : `Create Trip (${selectedPlaces.length} places)`)}
              </button>

              <button
                onClick={() => setStep('places')}
                className="w-full text-center text-[12px] bg-transparent border-none cursor-pointer py-3 mt-1"
                style={{ color: TEXT.secondary }}
              >
                ← Back to places
              </button>
            </motion.div>
          )}

          {/* ═══ STEP 3: ALLOCATE (multi-city) ═══ */}
          {step === 'allocate' && (
            <motion.div
              key="allocate"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.4 } }}
              exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
            >
              <div className="text-center mb-8">
                <PerriandIcon name="location" size={40} color="var(--t-dark-teal)" />
                <h1
                  className="text-2xl mt-3 mb-2"
                  style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary }}
                >
                  Allocate Nights
                </h1>
                <p className="text-[13px] leading-relaxed" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                  You have {totalNights} night{totalNights !== 1 ? 's' : ''} across {destinationNames.length} destinations.
                </p>
              </div>

              <DestinationAllocator
                destinations={destinationNames}
                totalNights={totalNights}
                allocation={dayAllocation}
                onChange={setDayAllocation}
              />

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold transition-all disabled:opacity-30 mt-6"
                style={{ background: TEXT.primary, color: TEXT.inverse, fontFamily: FONT.sans }}
              >
                {creating ? 'Creating...' : `Create Trip (${selectedPlaces.length} places)`}
              </button>

              <button
                onClick={() => setStep('details')}
                className="w-full text-center text-[12px] bg-transparent border-none cursor-pointer py-3 mt-1"
                style={{ color: TEXT.secondary }}
              >
                ← Back to details
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--t-cream)' }}>
      {isDesktop ? (
        <>
          <DesktopNav />
          <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px' }}>
            <div className="flex items-center pt-6 pb-2">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer link-hover"
                style={{ color: TEXT.accent, fontFamily: FONT.sans, fontSize: 13, padding: 0 }}
              >
                ← Back to {collection?.name || 'collection'}
              </button>
            </div>
            {content}
          </div>
        </>
      ) : (
        <>
          {/* Mobile: simple back button header */}
          <div
            className="flex items-center px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--t-linen)' }}
          >
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 bg-transparent border-none cursor-pointer"
              style={{ color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 13, padding: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {collection?.name || 'Back'}
            </button>
          </div>
          {content}
        </>
      )}
    </div>
  );
}

// ─── Page wrapper with Suspense for useSearchParams ──────────────────────────
export default function FromCollectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <div className="text-[13px]" style={{ color: TEXT.secondary }}>Loading...</div>
      </div>
    }>
      <FromCollectionContent />
    </Suspense>
  );
}
