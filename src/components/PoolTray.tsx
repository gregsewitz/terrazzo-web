'use client';

import { useState, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore, SortMode } from '@/stores/poolStore';
import { ImportedPlace } from '@/types';
import PoolItemCard from './PoolItemCard';

interface PoolTrayProps {
  onTapDetail: (item: ImportedPlace) => void;
  onOpenImport: () => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'match', label: 'Best Match' },
  { value: 'type', label: 'By Type' },
  { value: 'source', label: 'By Source' },
];

const TYPE_LABELS: Record<string, string> = {
  restaurant: '🍽 Restaurants',
  museum: '🏛 Museums',
  activity: '⚡ Activities',
  hotel: '🏨 Hotels',
  neighborhood: '🏘 Neighborhoods',
  bar: '🍸 Bars',
  cafe: '☕ Cafes',
  shop: '🛍 Shops',
};

export default function PoolTray({ onTapDetail, onOpenImport }: PoolTrayProps) {
  const poolItems = useTripStore(s => s.poolItems());
  const { sortMode, setSortMode, isExpanded, setExpanded } = usePoolStore();

  const sortedGroups = useMemo(() => {
    const items = [...poolItems];

    if (sortMode === 'match') {
      return [{ key: 'all', label: '', items: items.sort((a, b) => b.matchScore - a.matchScore) }];
    }

    if (sortMode === 'type') {
      const grouped: Record<string, ImportedPlace[]> = {};
      items.forEach(item => {
        if (!grouped[item.type]) grouped[item.type] = [];
        grouped[item.type].push(item);
      });
      return Object.entries(grouped).map(([type, items]) => ({
        key: type,
        label: TYPE_LABELS[type] || type,
        items: items.sort((a, b) => b.matchScore - a.matchScore),
      }));
    }

    // By source
    const grouped: Record<string, ImportedPlace[]> = {};
    items.forEach(item => {
      const key = item.source.name;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped).map(([source, items]) => ({
      key: source,
      label: source,
      items: items.sort((a, b) => b.matchScore - a.matchScore),
    }));
  }, [poolItems, sortMode]);

  return (
    <div
      className="fixed left-0 right-0 z-40 transition-all duration-300"
      style={{
        bottom: 52,
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--t-cream)',
        borderTop: '1px solid var(--t-linen)',
        maxHeight: isExpanded ? '60vh' : 220,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!isExpanded)}
            className="text-[10px] font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--t-ink)', fontFamily: "'Space Mono', monospace" }}
          >
            Available ({poolItems.length}) {isExpanded ? '▼' : '▲'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              className="text-[10px] px-3 py-1 rounded-full border-none cursor-pointer transition-colors"
              style={{
                background: sortMode === opt.value ? 'var(--t-ink)' : 'rgba(28,26,23,0.06)',
                color: sortMode === opt.value ? 'var(--t-cream)' : 'rgba(28,26,23,0.5)',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: sortMode === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenImport}
          className="text-[10px] font-semibold px-3 py-1 rounded-full border-none cursor-pointer"
          style={{
            background: 'var(--t-panton-orange)',
            color: 'white',
          }}
        >
          + Import
        </button>
      </div>

      {/* Items */}
      <div
        className="px-3 pb-2 overflow-y-auto"
        style={{ maxHeight: isExpanded ? 'calc(60vh - 44px)' : 170 }}
      >
        {sortedGroups.map(group => (
          <div key={group.key}>
            {group.label && (
              <div
                className="text-[10px] font-bold uppercase tracking-wider py-1.5 mt-1 mb-1 border-b"
                style={{
                  color: 'var(--t-amber)',
                  borderColor: 'var(--t-linen)',
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                {group.label}
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {group.items.map(item => (
                <PoolItemCard key={item.id} item={item} onTapDetail={onTapDetail} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
