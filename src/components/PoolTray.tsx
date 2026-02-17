'use client';

import { useState, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore } from '@/stores/poolStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, GhostSourceType, SOURCE_STYLES } from '@/types';

interface PoolTrayProps {
  onTapDetail: (item: ImportedPlace) => void;
  onOpenImport: () => void;
  onOpenTriage?: () => void;
  onOpenExport?: () => void;
}

type SourceFilterType = GhostSourceType | 'all';

const SOURCE_FILTER_TABS: { value: SourceFilterType; label: string; icon?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'friend', label: 'Friends', icon: '👤' },
  { value: 'maps', label: 'Maps', icon: '📍' },
  { value: 'ai', label: 'AI', icon: '✦' },
  { value: 'article', label: 'Articles', icon: '📰' },
  { value: 'email', label: 'Email', icon: '✉' },
];

export default function PoolTray({ onTapDetail, onOpenImport, onOpenTriage, onOpenExport }: PoolTrayProps) {
  const pool = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.pool;
  });
  const tripDestinations = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.destinations || [trip?.location?.split(',')[0]?.trim()].filter(Boolean);
  });
  const addToPool = useTripStore(s => s.addToPool);
  const poolItems = useMemo(() => pool?.filter(p => p.status === 'available') ?? [], [pool]);
  const { isExpanded, setExpanded } = usePoolStore();
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');

  // Geo-filtered: My Places that match this trip's destinations but aren't in the pool
  const myPlaces = useSavedStore(s => s.myPlaces);
  const geoMatchedPlaces = useMemo(() => {
    if (!tripDestinations || tripDestinations.length === 0) return [];
    const poolNames = new Set(poolItems.map(p => p.name.toLowerCase()));
    const destLower = (tripDestinations as string[]).map(d => d.toLowerCase());
    return myPlaces.filter(place => {
      if (poolNames.has(place.name.toLowerCase())) return false;
      return destLower.some(dest => place.location.toLowerCase().includes(dest));
    });
  }, [myPlaces, tripDestinations, poolItems]);

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') {
      return poolItems;
    }
    return poolItems.filter(item => item.ghostSource === sourceFilter);
  }, [poolItems, sourceFilter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => b.matchScore - a.matchScore);
  }, [filteredItems]);

  // Count per source for tab labels
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    poolItems.forEach(item => {
      const src = item.ghostSource || 'manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [poolItems]);

  if (!isExpanded) {
    // Collapsed state — just a thin bar
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
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--t-ink)',
              }}
            >
              Unsorted
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
              {poolItems.length}
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
            Unsorted Places
            <span style={{ fontSize: '10px', color: 'rgba(28,26,23,0.4)' }}>▼</span>
          </button>
          <div className="flex items-center gap-2">
            {onOpenTriage && poolItems.length > 0 && (
              <button
                onClick={onOpenTriage}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
                style={{
                  background: 'transparent',
                  color: 'var(--t-verde)',
                  borderColor: 'var(--t-verde)',
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                ✦ Triage
              </button>
            )}
            {onOpenExport && poolItems.length > 0 && (
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
          {poolItems.length} places · tap to assign to a day
        </div>

        {/* Filter Tabs — underline style like wireframe */}
        <div
          className="flex overflow-x-auto"
          style={{
            borderBottom: '1px solid var(--t-linen)',
            scrollbarWidth: 'none',
          }}
        >
          {SOURCE_FILTER_TABS.map(tab => {
            const isActive = sourceFilter === tab.value;
            const count = tab.value === 'all' ? poolItems.length : (sourceCounts[tab.value] || 0);

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

        {/* Items List — card-based like wireframe */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{ scrollbarWidth: 'thin' }}
        >
          {sortedItems.map(item => {
            const sourceStyle = SOURCE_STYLES[item.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
            const note = item.ghostSource === 'friend' ? item.friendAttribution?.note
              : item.ghostSource === 'ai' ? item.aiReasoning?.rationale
              : item.ghostSource === 'maps' ? item.savedDate
              : undefined;

            return (
              <div
                key={item.id}
                className="flex justify-between items-start rounded-lg mb-2.5 p-3 cursor-pointer transition-all"
                style={{
                  background: 'var(--t-cream)',
                  border: '1.5px solid var(--t-linen)',
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
                      : item.ghostSource === 'ai' ? 'AI suggestion'
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

                {/* Match score + assign button */}
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
              className="flex items-center justify-center py-8 text-center"
              style={{
                color: 'rgba(28,26,23,0.5)',
                fontFamily: "'Space Mono', monospace",
                fontSize: '12px',
              }}
            >
              No items found for this source
            </div>
          )}

          {/* Geo-filtered: From My Places */}
          {geoMatchedPlaces.length > 0 && sourceFilter === 'all' && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--t-linen)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}>
                    From My Places
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
                    {geoMatchedPlaces.length} match{geoMatchedPlaces.length !== 1 ? 'es' : ''} in {(tripDestinations as string[]).join(', ')}
                  </span>
                </div>
              </div>
              {geoMatchedPlaces.map(place => (
                <div
                  key={place.id}
                  className="flex justify-between items-center rounded-lg mb-2 p-3 cursor-pointer transition-all"
                  style={{
                    background: 'rgba(42,122,86,0.04)',
                    border: '1.5px solid rgba(42,122,86,0.15)',
                  }}
                >
                  <div className="flex-1 min-w-0 mr-3" onClick={() => onTapDetail(place)}>
                    <div className="text-[13px] font-medium mb-0.5" style={{ color: 'var(--t-ink)' }}>
                      {place.name}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                      {place.location} · {place.type} · saved in My Places
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToPool([{ ...place, id: `from-saved-${place.id}` }]);
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer"
                    style={{ background: 'var(--t-verde)', color: 'white' }}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
