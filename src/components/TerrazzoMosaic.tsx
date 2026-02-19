'use client';

import React, { useMemo } from 'react';
import { TasteDomain, TasteProfile, DOMAIN_COLORS } from '@/types';
import { FONT, INK } from '@/constants/theme';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MosaicSize = 'xs' | 'sm' | 'md' | 'lg';

interface TerrazzoMosaicProps {
  profile: TasteProfile;
  size?: MosaicSize;
  /** Optional className for the outer wrapper */
  className?: string;
  /** Optional inline style for the outer wrapper */
  style?: React.CSSProperties;
}

interface MosaicLegendProps {
  profile: TasteProfile;
  className?: string;
  style?: React.CSSProperties;
  /** Use light text for dark backgrounds */
  dark?: boolean;
}

// ─── Size presets ──────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<MosaicSize, { grid: number; tile: number; gap: number; radius: number }> = {
  lg: { grid: 8, tile: 20, gap: 2, radius: 16 },
  md: { grid: 6, tile: 16, gap: 2, radius: 12 },
  sm: { grid: 5, tile: 12, gap: 1, radius: 8 },
  xs: { grid: 4, tile: 7, gap: 1, radius: 6 },
};

// ─── Seeded PRNG (deterministic per-profile) ──────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Simple numeric hash from profile values for stable rendering */
function profileSeed(profile: TasteProfile): number {
  const DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];
  let hash = 7;
  DOMAINS.forEach(d => {
    hash = hash * 31 + Math.round((profile[d] ?? 0) * 1000);
  });
  return Math.abs(hash) || 42;
}

// ─── Tile generation ───────────────────────────────────────────────────────────

interface Tile {
  color: string;
  domain: string;
  opacity: number;
}

function generateClusteredGrid(
  profile: TasteProfile,
  gridSize: number,
  seed: number,
): Tile[] {
  const DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];
  const totalCells = gridSize * gridSize;
  const totalScore = DOMAINS.reduce((sum, d) => sum + (profile[d] ?? 0), 0) || 1;

  // Sort domains by score descending — largest regions first
  const sorted = DOMAINS
    .map(d => ({ domain: d, color: DOMAIN_COLORS[d], score: profile[d] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // Allocate tile counts proportionally
  let allocated = 0;
  const allocations = sorted.map((d, i) => {
    let count: number;
    if (i === sorted.length - 1) {
      count = totalCells - allocated;
    } else {
      count = Math.round((d.score / totalScore) * totalCells);
    }
    count = Math.max(1, Math.min(count, totalCells - allocated));
    allocated += count;
    return { ...d, count };
  });

  // Build snake-order indices (boustrophedon) for contiguous clustering
  const snakeOrder: number[] = [];
  for (let row = 0; row < gridSize; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < gridSize; col++) snakeOrder.push(row * gridSize + col);
    } else {
      for (let col = gridSize - 1; col >= 0; col--) snakeOrder.push(row * gridSize + col);
    }
  }

  // Fill grid in snake order
  const grid: (Tile | null)[] = new Array(totalCells).fill(null);
  const rand = seededRandom(seed);
  let idx = 0;

  allocations.forEach(alloc => {
    for (let i = 0; i < alloc.count && idx < totalCells; i++, idx++) {
      grid[snakeOrder[idx]] = {
        color: alloc.color,
        domain: alloc.domain,
        opacity: 0.83 + rand() * 0.17,
      };
    }
  });

  // Fill any remaining cells (shouldn't happen, but safety)
  return grid.map(cell => cell ?? { color: '#ddd5c5', domain: '', opacity: 1 });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function TerrazzoMosaic({ profile, size = 'md', className, style }: TerrazzoMosaicProps) {
  const config = SIZE_CONFIG[size];
  const seed = profileSeed(profile);

  const tiles = useMemo(
    () => generateClusteredGrid(profile, config.grid, seed),
    [profile, config.grid, seed],
  );

  const totalPx = config.grid * config.tile + (config.grid - 1) * config.gap;

  return (
    <div
      className={className}
      style={{
        display: 'inline-block',
        borderRadius: config.radius,
        overflow: 'hidden',
        background: '#ddd5c5', // grout / travertine
        boxShadow: `inset 0 0 0 1px ${INK['04']}`,
        width: totalPx,
        height: totalPx,
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${config.grid}, ${config.tile}px)`,
          gap: config.gap,
        }}
      >
        {tiles.map((tile, i) => (
          <div
            key={i}
            title={tile.domain || undefined}
            style={{
              width: config.tile,
              height: config.tile,
              borderRadius: 2,
              background: tile.color,
              opacity: tile.opacity,
              transition: 'transform 0.2s ease, filter 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.06)';
              (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.08)';
              (e.currentTarget as HTMLDivElement).style.zIndex = '1';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = '';
              (e.currentTarget as HTMLDivElement).style.filter = '';
              (e.currentTarget as HTMLDivElement).style.zIndex = '';
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────────

export function MosaicLegend({ profile, className, style, dark = false }: MosaicLegendProps) {
  const DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

  const sorted = DOMAINS
    .map(d => ({ domain: d, color: DOMAIN_COLORS[d], score: profile[d] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, auto)',
        gap: '6px 16px',
        justifyContent: 'center',
        ...style,
      }}
    >
      {sorted.map(d => (
        <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: '0.03em',
              color: dark ? 'rgba(245,240,230,0.6)' : INK['70'],
              whiteSpace: 'nowrap',
            }}
          >
            {d.domain}
          </span>
        </div>
      ))}
    </div>
  );
}

export default TerrazzoMosaic;
