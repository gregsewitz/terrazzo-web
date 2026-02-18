'use client';

import { ImportedPlace, T, DOMAIN_COLORS } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';

interface PoolItemCardProps {
  item: ImportedPlace;
  onTapDetail: (item: ImportedPlace) => void;
  compact?: boolean;
}

const TYPE_ICONS: Record<string, PerriandIconName> = {
  restaurant: 'restaurant',
  museum: 'museum',
  activity: 'activity',
  hotel: 'hotel',
  neighborhood: 'neighborhood',
  bar: 'bar',
  cafe: 'cafe',
  shop: 'shop',
};

const SOURCE_ICONS: Record<string, PerriandIconName> = {
  'CN Traveller': 'article',
  'YOLO Journal': 'manual',
  "Lizzie's List": 'friend',
  'Google Maps': 'location',
  'Gmail': 'email',
};

export default function PoolItemCard({ item, onTapDetail, compact = false }: PoolItemCardProps) {
  const hasWarning = item.enrichment?.closedDays && item.enrichment.closedDays.length > 0;

  return (
    <div
      onClick={() => onTapDetail(item)}
      className="relative cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: item.status === 'placed' ? 'white' : 'rgba(107,139,154,0.06)',
        border: item.status === 'placed'
          ? `1.5px solid var(--t-verde)`
          : '1.5px dashed var(--t-travertine)',
        borderRadius: 12,
        padding: compact ? '8px 10px' : '10px 12px',
        minWidth: compact ? 160 : 180,
        maxWidth: compact ? 180 : 220,
        flexShrink: 0,
      }}
    >
      {/* Match score badge */}
      <div
        className="absolute top-2 right-2 text-[10px] font-bold rounded-full px-1.5 py-0.5"
        style={{
          background: `rgba(200,146,58,0.15)`,
          color: 'var(--t-amber)',
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {item.matchScore}%
      </div>

      {/* Type icon + Name */}
      <div className="flex items-start gap-1.5 pr-8">
        <div className="text-xs mt-0.5">
          <PerriandIcon name={TYPE_ICONS[item.type] || 'location'} size={12} />
        </div>
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold leading-tight truncate"
            style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}
          >
            {item.name}
          </div>
          <div
            className="text-[9px] uppercase tracking-wider mt-0.5"
            style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}
          >
            {item.type}
          </div>
        </div>
      </div>

      {/* Taste note */}
      {!compact && item.tasteNote && (
        <div
          className="text-[10px] mt-1.5 leading-snug line-clamp-2"
          style={{ color: 'rgba(28,26,23,0.9)', fontStyle: 'italic' }}
        >
          "{item.tasteNote}"
        </div>
      )}

      {/* Google rating */}
      {item.google?.rating && (
        <div className="flex items-center gap-1 mt-1.5">
          <PerriandIcon name="star" size={10} color="var(--t-chrome-yellow)" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--t-ink)' }}>
            {item.google.rating}
          </span>
          {item.google.reviewCount && (
            <span className="text-[9px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
              ({item.google.reviewCount.toLocaleString()})
            </span>
          )}
        </div>
      )}

      {/* Bottom row: source + enrichment */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {/* Source badge */}
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{
            background: 'rgba(28,26,23,0.06)',
            color: 'rgba(28,26,23,0.95)',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          <PerriandIcon name={SOURCE_ICONS[item.source.name] || 'location'} size={10} />
          {item.source.name}
        </span>

        {/* Warning badge */}
        {hasWarning && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(232,104,48,0.1)',
              color: 'var(--t-panton-orange)',
            }}
          >
            ⚠ Closed {item.enrichment!.closedDays![0]}s
          </span>
        )}
      </div>
    </div>
  );
}
