'use client';

import React, { useMemo } from 'react';
import { TasteDomain, TasteProfile, DOMAIN_COLORS, CORE_TASTE_DOMAINS } from '@/types';
import { FONT, INK, TEXT } from '@/constants/theme';
import { formatDomain } from '@/constants/profile';
import { getMatchTier } from '@/lib/match-tier';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OverlapMosaicProps {
  /** User's taste profile (0-1 per domain) */
  userProfile: TasteProfile;
  /** Place's signal profile (0-1 per domain) */
  placeProfile: TasteProfile;
  /** Overall match score 0-100 */
  matchScore?: number;
  /** Grid size — 6x6 (default) or 8x8 */
  size?: 'md' | 'lg';
  /** Label under user mosaic */
  userLabel?: string;
  /** Label under place mosaic */
  placeLabel?: string;
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<'md' | 'lg', { grid: number; tile: number; gap: number; radius: number }> = {
  md: { grid: 6, tile: 14, gap: 2, radius: 10 },
  lg: { grid: 8, tile: 16, gap: 2, radius: 14 },
};

// Shared domain order for consistent comparison
const DOMAINS = CORE_TASTE_DOMAINS;

// ─── Tile generation (shared with TerrazzoMosaic) ───────────────────────────────

interface Tile {
  color: string;
  domain: TasteDomain;
  opacity: number;
  /** Index in the grid for overlap comparison */
  index: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function profileSeed(profile: TasteProfile): number {
  let hash = 7;
  DOMAINS.forEach(d => {
    hash = hash * 31 + Math.round((profile[d] ?? 0) * 1000);
  });
  return Math.abs(hash) || 42;
}

function generateGrid(profile: TasteProfile, gridSize: number, seed: number): Tile[] {
  const totalCells = gridSize * gridSize;
  const totalScore = DOMAINS.reduce((sum, d) => sum + (profile[d] ?? 0), 0) || 1;

  const sorted = DOMAINS
    .map(d => ({ domain: d, color: DOMAIN_COLORS[d], score: profile[d] ?? 0 }))
    .sort((a, b) => b.score - a.score);

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

  // Snake order for clustering
  const snakeOrder: number[] = [];
  for (let row = 0; row < gridSize; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < gridSize; col++) snakeOrder.push(row * gridSize + col);
    } else {
      for (let col = gridSize - 1; col >= 0; col--) snakeOrder.push(row * gridSize + col);
    }
  }

  const grid: (Tile | null)[] = new Array(totalCells).fill(null);
  const rand = seededRandom(seed);
  let idx = 0;

  allocations.forEach(alloc => {
    for (let i = 0; i < alloc.count && idx < totalCells; i++, idx++) {
      const cellIndex = snakeOrder[idx];
      grid[cellIndex] = {
        color: alloc.color,
        domain: alloc.domain as TasteDomain,
        opacity: 0.85 + rand() * 0.15,
        index: cellIndex,
      };
    }
  });

  return grid.map((cell, i) => cell ?? { color: '#ddd5c5', domain: 'Design' as TasteDomain, opacity: 0.6, index: i });
}

// ─── Overlap computation ────────────────────────────────────────────────────────

/** Find tiles where user and place share the same domain assignment */
function computeOverlap(userTiles: Tile[], placeTiles: Tile[]): Set<number> {
  const overlap = new Set<number>();
  for (let i = 0; i < userTiles.length; i++) {
    if (userTiles[i].domain === placeTiles[i].domain) {
      overlap.add(i);
    }
  }
  return overlap;
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function MosaicGrid({
  tiles,
  config,
  overlapIndices,
  isPlace,
}: {
  tiles: Tile[];
  config: typeof SIZE_CONFIG.md;
  overlapIndices: Set<number>;
  isPlace?: boolean;
}) {
  const totalPx = config.grid * config.tile + (config.grid - 1) * config.gap;

  return (
    <div
      style={{
        display: 'inline-block',
        borderRadius: config.radius,
        overflow: 'hidden',
        background: '#ddd5c5',
        boxShadow: `inset 0 0 0 1px ${INK['04']}`,
        width: totalPx,
        height: totalPx,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${config.grid}, ${config.tile}px)`,
          gap: config.gap,
        }}
      >
        {tiles.map((tile, i) => {
          const isOverlap = overlapIndices.has(i);
          return (
            <div
              key={i}
              style={{
                width: config.tile,
                height: config.tile,
                borderRadius: 2,
                background: tile.color,
                opacity: isOverlap ? tile.opacity : tile.opacity * 0.35,
                transition: 'opacity 0.4s ease, transform 0.2s ease',
                // Subtle glow on overlap tiles
                boxShadow: isOverlap ? `0 0 0 0.5px ${tile.color}40` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function OverlapMosaic({
  userProfile,
  placeProfile,
  matchScore,
  size = 'md',
  userLabel = 'Your taste',
  placeLabel = 'This place',
  className,
}: OverlapMosaicProps) {
  const config = SIZE_CONFIG[size];

  const userSeed = profileSeed(userProfile);
  const placeSeed = profileSeed(placeProfile);

  const userTiles = useMemo(
    () => generateGrid(userProfile, config.grid, userSeed),
    [userProfile, config.grid, userSeed],
  );

  const placeTiles = useMemo(
    () => generateGrid(placeProfile, config.grid, placeSeed),
    [placeProfile, config.grid, placeSeed],
  );

  const overlapIndices = useMemo(
    () => computeOverlap(userTiles, placeTiles),
    [userTiles, placeTiles],
  );

  // Compute which domains overlap most strongly
  const overlapDomains = useMemo(() => {
    const counts: Partial<Record<TasteDomain, number>> = {};
    overlapIndices.forEach(i => {
      const d = userTiles[i].domain;
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([domain]) => domain as TasteDomain);
  }, [overlapIndices, userTiles]);

  const overlapPercent = Math.round((overlapIndices.size / userTiles.length) * 100);

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        {/* User mosaic */}
        <div className="flex flex-col items-center gap-1.5">
          <MosaicGrid
            tiles={userTiles}
            config={config}
            overlapIndices={overlapIndices}
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
          >
            {userLabel}
          </span>
        </div>

        {/* Connection indicator */}
        <div className="flex flex-col items-center gap-1 px-1">
          {/* Overlap dots showing shared domains */}
          <div className="flex flex-col items-center gap-1">
            {overlapDomains.map(domain => (
              <div
                key={domain}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: DOMAIN_COLORS[domain],
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
          {matchScore !== undefined && (() => {
            const tier = getMatchTier(matchScore);
            return (
              <span
                className="text-[11px] font-bold mt-0.5"
                style={{ color: tier.color, fontFamily: FONT.mono, textTransform: 'uppercase', letterSpacing: 0.2 }}
              >
                {tier.shortLabel}
              </span>
            );
          })()}
        </div>

        {/* Place mosaic */}
        <div className="flex flex-col items-center gap-1.5">
          <MosaicGrid
            tiles={placeTiles}
            config={config}
            overlapIndices={overlapIndices}
            isPlace
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
          >
            {placeLabel}
          </span>
        </div>
      </div>

      {/* Shared domains legend */}
      {overlapDomains.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 justify-center">
          <span
            className="text-[11px] uppercase tracking-wider"
            style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
          >
            Strongest overlap:
          </span>
          {overlapDomains.map(domain => (
            <span
              key={domain}
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: `${DOMAIN_COLORS[domain]}10`,
                color: DOMAIN_COLORS[domain],
                fontFamily: FONT.mono,
              }}
            >
              {formatDomain(domain)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default OverlapMosaic;
