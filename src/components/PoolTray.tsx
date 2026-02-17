'use client';

import { useState, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore } from '@/stores/poolStore';
import { ImportedPlace, GhostSourceType, SOURCE_STYLES } from '@/types';
import PoolItemCard from './PoolItemCard';

interface PoolTrayProps {
  onTapDetail: (item: ImportedPlace) => void;
  onOpenImport: () => void;
}

type SourceFilterType = GhostSourceType | 'all';

const SOURCE_FILTER_TABS: { value: SourceFilterType; label: string; icon?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'friend', label: 'Friends', icon: '👤' },
  { value: 'article', label: 'Articles', icon: '📰' },
  { value: 'maps', label: 'Maps', icon: '📍' },
  { value: 'email', label: 'Email', icon: '✉' },
  { value: 'ai', label: 'AI', icon: '✦' },
];

export default function PoolTray({ onTapDetail, onOpenImport }: PoolTrayProps) {
  const poolItems = useTripStore(s => s.poolItems());
  const { isExpanded, setExpanded } = usePoolStore();
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') {
      return poolItems;
    }
    return poolItems.filter(item => item.ghostSource === sourceFilter);
  }, [poolItems, sourceFilter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => b.matchScore - a.matchScore);
  }, [filteredItems]);

  return (
    <div
      className="fixed left-0 right-0 z-40 transition-all duration-500 ease-out"
      style={{
        bottom: 52,
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--t-cream)',
        borderTop: '1px solid var(--t-linen)',
        maxHeight: isExpanded ? '80vh' : 220,
        overflow: 'hidden',
      }}
    >
      {/* Header with Title and Import Button */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--t-linen)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!isExpanded)}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer transition-transform duration-300"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--t-ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Unsorted
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
            <span style={{ fontSize: '12px', marginLeft: '4px' }}>
              {isExpanded ? '▼' : '▲'}
            </span>
          </button>
        </div>

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

      {/* Source Filter Tabs */}
      <div
        className="flex gap-2 px-3 py-2 overflow-x-auto border-b"
        style={{
          borderColor: 'var(--t-linen)',
          scrollbarWidth: 'none',
        }}
      >
        {SOURCE_FILTER_TABS.map(tab => {
          const isActive = sourceFilter === tab.value;
          const styles = tab.value !== 'all' ? SOURCE_STYLES[tab.value as GhostSourceType] : null;

          return (
            <button
              key={tab.value}
              onClick={() => setSourceFilter(tab.value)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-none cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive
                  ? tab.value === 'all'
                    ? 'var(--t-ink)'
                    : styles?.bg || 'transparent'
                  : 'rgba(28,26,23,0.04)',
                color: isActive
                  ? tab.value === 'all'
                    ? 'var(--t-cream)'
                    : styles?.color || 'var(--t-ink)'
                  : 'rgba(28,26,23,0.5)',
                fontFamily: "'Space Mono', monospace",
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                borderColor: 'transparent',
              }}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Items Container */}
      <div
        className="px-3 pb-2 overflow-y-auto transition-all duration-300"
        style={{
          maxHeight: isExpanded ? 'calc(80vh - 130px)' : 140,
          scrollbarWidth: 'thin',
        }}
      >
        {isExpanded ? (
          // Grid view when expanded
          <div className="grid grid-cols-2 gap-2 pt-2">
            {sortedItems.map(item => (
              <div key={item.id} className="relative">
                <PoolItemCard item={item} onTapDetail={onTapDetail} />
                {item.ghostSource && item.ghostSource !== 'manual' && (
                  <div
                    className="absolute top-2 right-2 flex items-center justify-center rounded-full"
                    style={{
                      width: '28px',
                      height: '28px',
                      background: SOURCE_STYLES[item.ghostSource]?.bg || 'rgba(28,26,23,0.06)',
                      border: `1.5px solid ${SOURCE_STYLES[item.ghostSource]?.color || 'var(--t-ink)'}`,
                      fontSize: '12px',
                    }}
                    title={SOURCE_STYLES[item.ghostSource]?.label}
                  >
                    {SOURCE_STYLES[item.ghostSource]?.icon}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Horizontal scroll when collapsed
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1" style={{ scrollbarWidth: 'thin' }}>
            {sortedItems.map(item => (
              <div key={item.id} className="relative flex-shrink-0">
                <PoolItemCard item={item} onTapDetail={onTapDetail} />
                {item.ghostSource && item.ghostSource !== 'manual' && (
                  <div
                    className="absolute top-2 right-2 flex items-center justify-center rounded-full"
                    style={{
                      width: '24px',
                      height: '24px',
                      background: SOURCE_STYLES[item.ghostSource]?.bg || 'rgba(28,26,23,0.06)',
                      border: `1.5px solid ${SOURCE_STYLES[item.ghostSource]?.color || 'var(--t-ink)'}`,
                      fontSize: '10px',
                    }}
                    title={SOURCE_STYLES[item.ghostSource]?.label}
                  >
                    {SOURCE_STYLES[item.ghostSource]?.icon}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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
      </div>
    </div>
  );
}
