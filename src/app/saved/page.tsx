'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import SmartCollectionSheet from '@/components/SmartCollectionSheet';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';
import { useSavedStore, HistoryItem } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import { REACTIONS, PlaceType, ImportedPlace, PlaceRating, GhostSourceType, SOURCE_STYLES } from '@/types';

const PLACE_TYPES: Array<{ id: PlaceType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'bar', label: 'Bars' },
  { id: 'activity', label: 'Experiences' },
];

type SourceFilterType = GhostSourceType | 'all';

const SOURCE_FILTER_TABS: { value: SourceFilterType; label: string; icon?: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'friend', label: 'Friends', icon: '👤' },
  { value: 'maps', label: 'Maps', icon: '📍' },
  { value: 'article', label: 'Articles', icon: '📰' },
  { value: 'email', label: 'Email', icon: '✉' },
  { value: 'manual', label: 'Added', icon: '✎' },
];

const HISTORY_TYPES: Array<{ id: PlaceType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'bar', label: 'Bars' },
];

// Type-based thumbnail gradients (matching wireframe style)
const THUMB_GRADIENTS: Record<string, string> = {
  restaurant: 'linear-gradient(135deg, #d8c8ae, #c0ab8e)',
  hotel: 'linear-gradient(135deg, #d0c8d8, #b8b0c0)',
  bar: 'linear-gradient(135deg, #c0d0c8, #a8c0b0)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0)',
};

// Type-based emoji icons for history cards
const TYPE_ICONS: Record<string, string> = {
  restaurant: '🍽',
  hotel: '🏨',
  bar: '🍸',
  cafe: '☕',
  museum: '🎨',
  activity: '🎫',
  neighborhood: '📍',
  shop: '🛍',
};

// Source tag styling (matching wireframe tag colors)
function getSourceTag(place: ImportedPlace): { label: string; bg: string; color: string } | null {
  if (place.friendAttribution) {
    return {
      label: `👤 ${place.friendAttribution.name}`,
      bg: 'rgba(42,122,86,0.1)',
      color: 'var(--t-verde)',
    };
  }
  if (place.matchScore && place.matchScore >= 80) {
    return {
      label: `${place.matchScore}% match`,
      bg: 'rgba(200,146,58,0.1)',
      color: 'var(--t-honey)',
    };
  }
  if (place.ghostSource === 'maps') {
    return {
      label: '📍 Maps',
      bg: 'rgba(232,115,58,0.08)',
      color: 'var(--t-panton-orange)',
    };
  }
  if (place.ghostSource === 'article') {
    return {
      label: `📄 ${place.source?.name || 'Article'}`,
      bg: 'rgba(200,146,58,0.1)',
      color: 'var(--t-honey)',
    };
  }
  return null;
}

function SavedPlaceCard({ place, onTap, onArchive, fromHistory }: { place: ImportedPlace; onTap: () => void; onArchive?: (id: string) => void; fromHistory?: boolean }) {
  const rating = place.rating;
  const reaction = rating ? REACTIONS.find((r) => r.id === rating.reaction) : null;
  const sourceTag = getSourceTag(place);

  // Swipe state
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [archived, setArchived] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    // Only allow left swipe (negative)
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -120));
    }
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (swipeOffset < -80 && onArchive) {
      // Animate out
      setArchived(true);
      setTimeout(() => onArchive(place.id), 300);
    } else {
      setSwipeOffset(0);
    }
  }, [swipeOffset, onArchive, place.id]);

  if (archived) {
    return (
      <div
        className="rounded-xl overflow-hidden transition-all duration-300"
        style={{ maxHeight: 0, opacity: 0, margin: 0, padding: 0 }}
      />
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Archive reveal behind card */}
      {swipeOffset < -10 && (
        <div
          className="absolute inset-0 flex items-center justify-end pr-4 rounded-xl"
          style={{ background: 'var(--t-ghost)' }}
        >
          <span className="text-white text-[11px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Archive →
          </span>
        </div>
      )}
      <div
        onClick={swipeOffset === 0 ? onTap : undefined}
        onTouchStart={onArchive ? handleTouchStart : undefined}
        onTouchMove={onArchive ? handleTouchMove : undefined}
        onTouchEnd={onArchive ? handleTouchEnd : undefined}
        className="flex gap-2.5 p-3 rounded-xl cursor-pointer relative"
        style={{
          background: 'white',
          border: '1px solid var(--t-linen)',
          transform: `translateX(${swipeOffset}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {/* Thumbnail gradient */}
        <div
          className="w-12 h-12 rounded-[10px] flex-shrink-0"
          style={{ background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
              {place.name}
            </div>
            {fromHistory && (
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: 'rgba(107,139,154,0.1)', color: 'var(--t-ghost)', fontFamily: "'Space Mono', monospace" }}
              >
                from history
              </span>
            )}
            {!fromHistory && rating && reaction && (
              <span style={{ fontSize: '14px', color: reaction.color }}>{reaction.icon}</span>
            )}
          </div>
          <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
            {place.location} · {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
          </div>
          {sourceTag && (
            <div className="flex gap-1 mt-1">
              <span
                className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: sourceTag.bg, color: sourceTag.color }}
              >
                {sourceTag.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ item, onPromote }: { item: HistoryItem; onPromote: (id: string) => void }) {
  const icon = TYPE_ICONS[item.type] || '📍';

  return (
    <div
      className="flex gap-2.5 items-center p-3 rounded-xl"
      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
    >
      {/* Type icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: 'rgba(107,139,154,0.08)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium" style={{ color: 'var(--t-ink)' }}>
          {item.name}
        </div>
        <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
          {item.location} · {item.detectedDate} · {item.detectedFrom}
        </div>
      </div>
      {/* Promote button */}
      <button
        onClick={() => onPromote(item.id)}
        className="text-sm px-1 flex-shrink-0"
        style={{ color: 'rgba(28,26,23,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ♡
      </button>
    </div>
  );
}

function LocationCluster({ city, count, onTap }: { city: string; count: number; onTap: () => void }) {
  return (
    <div
      onClick={onTap}
      className="p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
    >
      <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
        {city}
      </div>
      <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
        {count} place{count !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default function SavedPage() {
  const router = useRouter();
  const viewMode = useSavedStore(s => s.viewMode);
  const typeFilter = useSavedStore(s => s.typeFilter);
  const searchQuery = useSavedStore(s => s.searchQuery);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const history = useSavedStore(s => s.history);
  const setViewMode = useSavedStore(s => s.setViewMode);
  const setTypeFilter = useSavedStore(s => s.setTypeFilter);
  const setSearchQuery = useSavedStore(s => s.setSearchQuery);
  const promoteFromHistory = useSavedStore(s => s.promoteFromHistory);
  const archiveToHistory = useSavedStore(s => s.archiveToHistory);
  const addCollection = useSavedStore(s => s.addCollection);
  const ratePlace = useSavedStore(s => s.ratePlace);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);

  const trips = useTripStore(s => s.trips);

  const [showSearch, setShowSearch] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<PlaceType | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');
  const [showMapView, setShowMapView] = useState(false);
  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [ratingItem, setRatingItem] = useState<ImportedPlace | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setSearchQuery(value);
  };

  const handleRate = (rating: PlaceRating) => {
    if (ratingItem) {
      ratePlace(ratingItem.id, rating);
      setDetailItem(prev => prev?.id === ratingItem.id ? { ...prev, rating } : prev);
      // Star → Ghost candidacy: inject into trip planner if rated highly
      if (rating.reaction === 'myPlace' || rating.reaction === 'enjoyed') {
        injectGhostCandidates([{ ...ratingItem, rating }]);
      }
      setRatingItem(null);
    }
  };

  // Source counts for filter tab badges
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    myPlaces.forEach(place => {
      const src = place.ghostSource || 'manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [myPlaces]);

  // Filter places (type + search + source)
  const filteredPlaces = useMemo(() => {
    return myPlaces.filter((place) => {
      const matchesType = typeFilter === 'all' || place.type === typeFilter;
      const matchesSearch = searchQuery === ''
        || place.name.toLowerCase().includes(searchQuery.toLowerCase())
        || place.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = sourceFilter === 'all' || place.ghostSource === sourceFilter;
      return matchesType && matchesSearch && matchesSource;
    });
  }, [myPlaces, typeFilter, searchQuery, sourceFilter]);

  // Dynamic trip banners — match myPlaces against each trip's destinations
  const tripBanners = useMemo(() => {
    const emojiMap: Record<string, string> = {
      japan: '🇯🇵', tokyo: '🇯🇵', kyoto: '🇯🇵', osaka: '🇯🇵',
      france: '🇫🇷', paris: '🇫🇷',
      italy: '🇮🇹', venice: '🇮🇹', rome: '🇮🇹', puglia: '🇮🇹',
      uk: '🇬🇧', london: '🇬🇧', england: '🇬🇧',
      usa: '🇺🇸', 'new york': '🇺🇸', nyc: '🇺🇸',
      spain: '🇪🇸', mexico: '🇲🇽', greece: '🇬🇷', portugal: '🇵🇹',
      thailand: '🇹🇭', australia: '🇦🇺', germany: '🇩🇪',
    };
    return trips.map(trip => {
      const destLower = (trip.destinations || [trip.location?.split(',')[0]?.trim()].filter(Boolean))
        .map(d => d.toLowerCase());
      const matchingPlaces = myPlaces.filter(p =>
        destLower.some(dest => p.location.toLowerCase().includes(dest))
      );
      const starredCount = matchingPlaces.filter(p =>
        p.rating?.reaction === 'myPlace' || p.rating?.reaction === 'enjoyed'
      ).length;
      // Find emoji
      const tripNameLower = trip.name.toLowerCase();
      const allTerms = [...destLower, tripNameLower];
      let emoji = '✈️';
      for (const term of allTerms) {
        for (const [key, flag] of Object.entries(emojiMap)) {
          if (term.includes(key)) { emoji = flag; break; }
        }
        if (emoji !== '✈️') break;
      }
      return {
        id: trip.id,
        name: trip.name,
        emoji,
        matchCount: matchingPlaces.length,
        starredCount,
      };
    }).filter(b => b.matchCount > 0);
  }, [trips, myPlaces]);

  // Map markers — group filtered places by city for cluster view
  const mapMarkers: MapMarker[] = useMemo(() => {
    const byCity: Record<string, ImportedPlace[]> = {};
    filteredPlaces.forEach(p => {
      if (!byCity[p.location]) byCity[p.location] = [];
      byCity[p.location].push(p);
    });
    return Object.entries(byCity).map(([city, places]) => {
      const starred = places.filter(p =>
        p.rating?.reaction === 'myPlace' || p.rating?.reaction === 'enjoyed'
      ).length;
      return {
        id: `cluster-${city}`,
        name: city,
        location: city,
        count: places.length,
        starred,
        onClick: () => {
          setSearchInput(city);
          setSearchQuery(city);
          setShowSearch(true);
          setShowMapView(false);
        },
      };
    });
  }, [filteredPlaces, setSearchQuery]);

  // History items matching search (shown with "from history" label)
  const matchingHistoryPlaces = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return history
      .filter(h => {
        const matchesType = typeFilter === 'all' || h.type === typeFilter;
        const matchesSearch = h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q);
        return matchesType && matchesSearch;
      })
      .map(h => ({
        id: h.id,
        name: h.name,
        type: h.type,
        location: h.location,
        source: { type: 'email' as const, name: h.detectedFrom },
        matchScore: 0,
        matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
        tasteNote: `Detected ${h.detectedDate} via ${h.detectedFrom}`,
        status: 'available' as const,
        ghostSource: h.ghostSource,
        _fromHistory: true,
      } as ImportedPlace & { _fromHistory: boolean }));
  }, [history, searchQuery, typeFilter]);

  // Location clusters (top 4 for 2x2 grid)
  const locationClusters = useMemo(() => {
    const grouped: Record<string, number> = {};
    myPlaces.forEach((place) => {
      grouped[place.location] = (grouped[place.location] || 0) + 1;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [myPlaces]);

  // Group history by month
  const historyByMonth = useMemo(() => {
    const filtered = historyTypeFilter === 'all'
      ? history
      : history.filter(h => h.type === historyTypeFilter);
    const grouped: Record<string, typeof history> = {};
    filtered.forEach((item) => {
      const monthKey = item.detectedDate;
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(item);
    });
    return Object.entries(grouped).sort((a, b) => {
      const monthOrder = ['Feb', 'Jan', 'Dec', 'Nov', 'Oct', 'Sep'];
      const aMonth = a[0].split(' ')[0];
      const bMonth = b[0].split(' ')[0];
      return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
    });
  }, [history, historyTypeFilter]);

  // ─── HISTORY VIEW ───
  if (viewMode === 'history') {
    return (
      <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
        <div className="px-5 pt-6">
          {/* Header with back arrow */}
          <div className="flex items-center gap-2.5 mb-3">
            <button
              onClick={() => setViewMode('myPlaces')}
              className="text-base"
              style={{ color: 'rgba(28,26,23,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ←
            </button>
            <div>
              <h1
                className="text-xl"
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontStyle: 'italic',
                  color: 'var(--t-ghost)',
                }}
              >
                History
              </h1>
              <p className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                {history.length} places detected from email
              </p>
            </div>
          </div>

          {/* Info box */}
          <div
            className="text-[11px] leading-relaxed mb-3.5 px-3 py-2.5 rounded-[10px]"
            style={{ color: 'rgba(28,26,23,0.5)', background: 'rgba(107,139,154,0.05)' }}
          >
            These are places we found in your email. They feed your taste profile but don&apos;t appear in trip planning unless you promote them.
          </div>

          {/* Ghost-colored filter chips */}
          <div className="flex gap-1.5 mb-3.5 overflow-x-auto">
            {HISTORY_TYPES.map((type) => {
              const isActive = historyTypeFilter === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setHistoryTypeFilter(type.id as PlaceType | 'all')}
                  className="px-3 py-1.5 rounded-2xl text-[11px] font-medium whitespace-nowrap"
                  style={{
                    background: isActive ? 'var(--t-ghost)' : 'rgba(107,139,154,0.08)',
                    color: isActive ? 'white' : 'var(--t-ghost)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {type.label}
                </button>
              );
            })}
          </div>

          {/* Month groups */}
          <div className="flex flex-col gap-3">
            {historyByMonth.map(([month, items]) => (
              <div key={month}>
                <div
                  className="text-[10px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--t-ghost)', fontFamily: "'Space Mono', monospace" }}
                >
                  {month}
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((item) => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      onPromote={promoteFromHistory}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <TabBar />
      </div>
    );
  }

  // ─── MY PLACES VIEW ───
  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-5 pt-6">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1
              className="text-[24px]"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontStyle: 'italic',
                color: 'var(--t-ink)',
              }}
            >
              My Places
            </h1>
            <div className="text-[11px] mt-0.5" style={{ color: 'rgba(28,26,23,0.5)' }}>
              {myPlaces.length} places ·{' '}
              <button
                onClick={() => setViewMode('history')}
                className="underline"
                style={{
                  color: 'var(--t-ghost)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: 0,
                }}
              >
                {history.length} in history
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewCollection(true)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full"
              style={{
                background: 'var(--t-ink)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Collection
            </button>
            <button
              onClick={() => setShowMapView(!showMapView)}
              className="text-[11px] font-medium px-2 py-1.5 rounded-full"
              style={{
                background: showMapView ? 'var(--t-ink)' : 'rgba(28,26,23,0.06)',
                color: showMapView ? 'white' : 'var(--t-ink)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showMapView ? '☰ List' : '🗺 Map'}
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="text-xl"
              style={{ color: 'rgba(28,26,23,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              🔍
            </button>
          </div>
        </div>

        {/* Expandable search */}
        {showSearch && (
          <input
            type="text"
            placeholder="Search places, people, cities..."
            value={searchInput}
            onChange={handleSearchChange}
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg border mb-4 text-[12px]"
            style={{
              background: 'white',
              borderColor: 'var(--t-linen)',
              color: 'var(--t-ink)',
              outline: 'none',
            }}
          />
        )}

        {/* Filter chips — dark active / linen inactive */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto">
          {PLACE_TYPES.map((type) => {
            const isActive = typeFilter === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setTypeFilter(type.id as PlaceType | 'all')}
                className="px-3 py-1.5 rounded-2xl text-[11px] whitespace-nowrap"
                style={{
                  background: isActive ? 'var(--t-ink)' : 'var(--t-linen)',
                  color: isActive ? 'white' : 'var(--t-ink)',
                  fontWeight: isActive ? 600 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Source filter tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-0.5">
          {SOURCE_FILTER_TABS.map((tab) => {
            const isActive = sourceFilter === tab.value;
            const count = tab.value === 'all' ? myPlaces.length : (sourceCounts[tab.value] || 0);
            if (tab.value !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.value}
                onClick={() => setSourceFilter(tab.value)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-2xl text-[10px] whitespace-nowrap"
                style={{
                  background: isActive
                    ? (tab.value === 'all' ? 'var(--t-ink)' : (SOURCE_STYLES[tab.value as GhostSourceType]?.bg || 'rgba(28,26,23,0.06)'))
                    : 'rgba(28,26,23,0.04)',
                  color: isActive
                    ? (tab.value === 'all' ? 'white' : (SOURCE_STYLES[tab.value as GhostSourceType]?.color || 'var(--t-ink)'))
                    : 'rgba(28,26,23,0.5)',
                  fontWeight: isActive ? 600 : 400,
                  border: isActive && tab.value !== 'all'
                    ? `1px solid ${SOURCE_STYLES[tab.value as GhostSourceType]?.color || 'transparent'}`
                    : '1px solid transparent',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
                <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic trip banners */}
        {tripBanners.map(banner => (
          <div
            key={banner.id}
            onClick={() => router.push(`/trips/${banner.id}`)}
            className="flex items-center gap-3 p-3.5 rounded-[14px] mb-4 cursor-pointer transition-all hover:scale-[1.01]"
            style={{ background: 'linear-gradient(135deg, #e8edf2, #f2ede8)' }}
          >
            <div className="text-2xl">{banner.emoji}</div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                {banner.name}
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                {banner.matchCount} place{banner.matchCount !== 1 ? 's' : ''} match{banner.matchCount === 1 ? 'es' : ''}
                {banner.starredCount > 0 && ` · ${banner.starredCount} starred`}
              </div>
            </div>
            <div
              className="text-[12px] font-medium"
              style={{ color: 'var(--t-honey)' }}
            >
              View →
            </div>
          </div>
        ))}

        {/* Map View */}
        {showMapView ? (
          <div className="mb-8">
            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-2"
              style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}
            >
              {filteredPlaces.length} place{filteredPlaces.length !== 1 ? 's' : ''}
              {sourceFilter !== 'all' && ` from ${SOURCE_FILTER_TABS.find(t => t.value === sourceFilter)?.label || sourceFilter}`}
            </div>
            <GoogleMapView
              markers={mapMarkers}
              height={360}
            />
          </div>
        ) : (
          <>
            {/* By Location — 2x2 grid */}
            {locationClusters.length > 0 && !searchQuery && (
              <div className="mb-4">
                <div
                  className="text-[10px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}
                >
                  By location
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {locationClusters.map(([city, count]) => (
                    <LocationCluster
                      key={city}
                      city={city}
                      count={count}
                      onTap={() => {
                        setSearchInput(city);
                        setSearchQuery(city);
                        setShowSearch(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recently saved */}
            <div className="mb-8">
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}
              >
                {searchQuery ? 'Results' : 'Recently saved'}
              </div>
              <div className="text-[10px] mb-2" style={{ color: 'rgba(28,26,23,0.35)' }}>
                Swipe left to archive
              </div>
              {filteredPlaces.length > 0 || matchingHistoryPlaces.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {filteredPlaces.map((place) => (
                    <SavedPlaceCard
                      key={place.id}
                      place={place}
                      onTap={() => setDetailItem(place)}
                      onArchive={archiveToHistory}
                    />
                  ))}
                  {/* History items matching search */}
                  {matchingHistoryPlaces.length > 0 && (
                    <>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mt-2 mb-1"
                        style={{ color: 'var(--t-ghost)', fontFamily: "'Space Mono', monospace" }}
                      >
                        From history
                      </div>
                      {matchingHistoryPlaces.map((place) => (
                        <SavedPlaceCard
                          key={place.id}
                          place={place}
                          onTap={() => setDetailItem(place)}
                          fromHistory
                        />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-2xl mb-3 block">◇</span>
                  <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
                    No places match your filters
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Place Detail Sheet */}
      {detailItem && (
        <PlaceDetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRate={() => setRatingItem(detailItem)}
          siblingPlaces={detailItem.importBatchId
            ? myPlaces.filter(p => p.importBatchId === detailItem.importBatchId && p.id !== detailItem.id)
            : undefined}
        />
      )}

      {/* Rating Sheet */}
      {ratingItem && (
        <RatingSheet
          item={ratingItem}
          onClose={() => setRatingItem(null)}
          onSave={handleRate}
        />
      )}

      {/* Smart Collection Sheet */}
      <SmartCollectionSheet
        isOpen={showNewCollection}
        onClose={() => setShowNewCollection(false)}
        onCreate={(collection) => {
          const emojiMap: Record<string, string> = {
            hotel: '🏨', restaurant: '🍽', bar: '🍷', museum: '🎨',
            cafe: '☕', sarah: '👤', tokyo: '🗼',
          };
          let emoji = '✨';
          for (const [key, value] of Object.entries(emojiMap)) {
            if (collection.query.toLowerCase().includes(key)) { emoji = value; break; }
          }
          const query = collection.query.toLowerCase();
          const filterTags: string[] = [];
          if (query.includes('hotel')) filterTags.push('type: hotel');
          if (query.includes('restaurant')) filterTags.push('type: restaurant');
          if (query.includes('bar')) filterTags.push('type: bar');
          if (query.includes('europe')) filterTags.push('location: Europe');
          if (query.includes('tokyo')) filterTags.push('location: Tokyo');
          if (query.includes('sarah')) { filterTags.push('person: Sarah'); filterTags.push('source: friend'); }
          if (query.includes('favorite')) filterTags.push('reaction: ♡');
          addCollection({
            name: collection.name,
            count: Math.floor(Math.random() * 5) + 5,
            emoji,
            isSmartCollection: true,
            query: collection.query,
            filterTags: filterTags.length > 0 ? filterTags : undefined,
          });
        }}
      />

      <TabBar />
    </div>
  );
}
