'use client';

import { useState, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore } from '@/stores/poolStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, GhostSourceType, SOURCE_STYLES } from '@/types';

interface PoolTrayProps {
  onTapDetail: (item: ImportedPlace) => void;
  onOpenImport: () => void;
  onOpenExport?: () => void;
}

type SourceFilterType = GhostSourceType | 'all';

const SOURCE_FILTER_TABS: { value: SourceFilterType; label: string; icon?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'friend', label: 'Friends', icon: '👤' },
  { value: 'maps', label: 'Maps', icon: '📍' },
  { value: 'article', label: 'Articles', icon: '📰' },
  { value: 'email', label: 'Email', icon: '✉' },
  { value: 'manual', label: 'Added', icon: '✎' },
];

export default function PoolTray({ onTapDetail, onOpenImport, onOpenExport }: PoolTrayProps) {
  const tripDestinations = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.destinations || [trip?.location?.split(',')[0]?.trim()].filter(Boolean);
  });
  const { isExpanded, setExpanded } = usePoolStore();
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');

  // Starred places from savedStore, geo-filtered to trip destinations
  const myPlaces = useSavedStore(s => s.myPlaces);
  const starredPlaces = useMemo(() => {
    if (!tripDestinations || tripDestinations.length === 0) return [];
    const destLower = (tripDestinations as string[]).map(d => d.toLowerCase());
    return myPlaces.filter(place => {
      // Must be starred
      if (place.rating?.reaction !== 'myPlace') return false;
      // Must match trip destinations
      return destLower.some(dest => place.location.toLowerCase().includes(dest));
    });
  }, [myPlaces, tripDestinations]);

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') return starredPlaces;
    return starredPlaces.filter(item => (item.ghostSource || 'manual') === sourceFilter);
  }, [starredPlaces, sourceFilter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => b.matchScore - a.matchScore);
  }, [filteredItems]);

  // Count per source for tab labels
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    starredPlaces.forEach(item => {
      const src = item.ghostSource || 'manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [starredPlaces]);

  if (!isExpanded) {
    // Collapsed state — thin bar
    return (
      <div
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 52,
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-all"
          style={{
            background: 'white',
            borderTop: '1px solid var(--t-linen)',
            border: 'none',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderTopColor: 'var(--t-linen)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--t-ink)',
              }}
            >
              Everywhere you want to go
            </span>
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: 'rgba(200,146,58,0.12)',
                color: 'var(--t-honey)',
                padding: '2px 8px',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {starredPlaces.length}
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(28,26,23,0.4)' }}>▲</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenImport(); }}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
            style={{
              background: 'transparent',
              color: 'var(--t-panton-orange)',
              borderColor: 'var(--t-panton-orange)',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            + Import
          </button>
        </button>
      </div>
    );
  }

  // Expanded state — full bottom sheet
  return (
    <div
      className="fixed left-0 right-0 z-40"
      style={{
        bottom: 52,
        maxWidth: 480,
        margin: '0 auto',
        maxHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Sheet with rounded top */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          background: 'white',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.1)',
          maxHeight: '75vh',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div
            style={{
              width: 40,
              height: 4,
              background: 'var(--t-linen)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--t-ink)',
            }}
          >
            Everywhere you want to go
            <span style={{ fontSize: '10px', color: 'rgba(28,26,23,0.4)' }}>▼</span>
          </button>
          <div className="flex items-center gap-2">
            {onOpenExport && starredPlaces.length > 0 && (
              <button
                onClick={onOpenExport}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
                style={{
                  background: 'transparent',
                  color: 'var(--t-honey)',
                  borderColor: 'var(--t-honey)',
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                📍 Export
              </button>
            )}
            <button
              onClick={onOpenImport}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
              style={{
                background: 'transparent',
                color: 'var(--t-panton-orange)',
                borderColor: 'var(--t-panton-orange)',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              + Import
            </button>
          </div>
        </div>

        {/* Subtitle */}
        <div
          className="px-4 pb-3 text-xs"
          style={{ color: 'rgba(28,26,23,0.5)' }}
        >
          {starredPlaces.length} starred place{starredPlaces.length !== 1 ? 's' : ''} · tap to assign to a day
        </div>

        {/* Filter Tabs */}
        <div
          className="flex overflow-x-auto"
          style={{
            borderBottom: '1px solid var(--t-linen)',
            scrollbarWidth: 'none',
          }}
        >
          {SOURCE_FILTER_TABS.map(tab => {
            const isActive = sourceFilter === tab.value;
            const count = tab.value === 'all' ? starredPlaces.length : (sourceCounts[tab.value] || 0);

            // Skip tabs with 0 count (except 'all')
            if (tab.value !== 'all' && count === 0) return null;

            return (
              <button
                key={tab.value}
                onClick={() => setSourceFilter(tab.value)}
                className="flex-1 min-w-fit px-4 py-3 text-xs font-medium whitespace-nowrap cursor-pointer transition-all"
                style={{
                  background: 'transparent',
                  color: isActive ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--t-ink)' : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tab.icon && <span className="mr-1">{tab.icon}</span>}
                {tab.label} · {count}
              </button>
            );
          })}
        </div>

        {/* Items List */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{ scrollbarWidth: 'thin' }}
        >
          {sortedItems.map(item => {
            const sourceStyle = SOURCE_STYLES[item.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
            const note = item.ghostSource === 'friend' ? item.friendAttribution?.note
              : item.ghostSource === 'maps' ? item.savedDate
              : undefined;

            return (
              <div
                key={item.id}
                className="flex justify-between items-start rounded-lg mb-2.5 p-3 cursor-pointer transition-all"
                style={{
                  background: 'var(--t-cream)',
                  border: '1.5px solid var(--t-linen)',
                  borderLeft: '3px solid var(--t-verde)',
                }}
                onClick={() => onTapDetail(item)}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div
                    className="text-[13px] font-medium mb-1"
                    style={{ color: 'var(--t-ink)' }}
                  >
                    {item.name}
                  </div>
                  <div
                    className="text-[11px] mb-1"
                    style={{ color: 'rgba(28,26,23,0.5)' }}
                  >
                    {sourceStyle.icon} {item.ghostSource === 'friend'
                      ? item.friendAttribution?.name
                      : item.ghostSource === 'maps' ? 'Google Maps'
                      : item.source?.name || sourceStyle.label}
                  </div>
                  {note && (
                    <div
                      className="text-[11px] italic"
                      style={{ color: 'rgba(28,26,23,0.5)' }}
                    >
                      {item.ghostSource === 'friend' ? `"${note}"` : note}
                    </div>
                  )}
                </div>

                {/* Match score */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(42,122,86,0.08)',
                      color: 'var(--t-verde)',
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {item.matchScore}%
                  </span>
                </div>
              </div>
            );
          })}

          {sortedItems.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-10 text-center"
              style={{ color: 'rgba(28,26,23,0.5)' }}
            >
              <span className="text-2xl mb-3">★</span>
              <p
                className="text-[12px] mb-1"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {sourceFilter !== 'all'
                  ? 'No starred places from this source'
                  : 'No starred places yet'}
              </p>
              <p
                className="text-[11px]"
                style={{ color: 'rgba(28,26,23,0.35)' }}
              >
                Star places in My Places or Collect to add them here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
