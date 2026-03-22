'use client';

import React, { useMemo } from 'react';
import { TasteDomain, TasteProfile, DOMAIN_COLORS, CORE_TASTE_DOMAINS } from '@/types';
import { FONT, INK, TEXT } from '@/constants/theme';
import { formatDomain } from '@/constants/profile';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OverlapMosaicProps {
  /** User's taste profile (0-1 per domain) */
  userProfile: TasteProfile;
  /** Place's signal profile (0-1 per domain) */
  placeProfile: TasteProfile;
  /** Overall match score 0-100 */
  matchScore?: number;
  /** Chart size — md (default) or lg */
  size?: 'md' | 'lg';
  /** Label for user shape */
  userLabel?: string;
  /** Label for place shape */
  placeLabel?: string;
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DOMAINS = CORE_TASTE_DOMAINS;

const SIZE_CONFIG: Record<'md' | 'lg', { svgSize: number; maxR: number; labelR: number }> = {
  md: { svgSize: 200, maxR: 72, labelR: 88 },
  lg: { svgSize: 260, maxR: 96, labelR: 114 },
};

// User fill and stroke
const USER_FILL = 'rgba(196,121,107,0.14)';
const USER_STROKE = 'rgba(196,121,107,0.55)';

// Place fill and stroke
const PLACE_FILL = 'rgba(107,138,90,0.14)';
const PLACE_STROKE = 'rgba(107,138,90,0.55)';

// Overlap intersection tint
const OVERLAP_FILL = 'rgba(180,155,80,0.16)';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function polarToCart(cx: number, cy: number, angle: number, r: number): [number, number] {
  return [cx + r * Math.cos(angle - Math.PI / 2), cy + r * Math.sin(angle - Math.PI / 2)];
}

function makePolygonPoints(
  cx: number,
  cy: number,
  maxR: number,
  profile: TasteProfile,
  angleStep: number,
): string {
  return DOMAINS.map((d, i) => {
    const value = Math.max(profile[d] ?? 0, 0.08); // min radius so shape is always visible
    const [x, y] = polarToCart(cx, cy, i * angleStep, value * maxR);
    return `${x},${y}`;
  }).join(' ');
}

function makeSmoothPath(
  cx: number,
  cy: number,
  maxR: number,
  profile: TasteProfile,
  angleStep: number,
): string {
  const points = DOMAINS.map((d, i) => {
    const value = Math.max(profile[d] ?? 0, 0.08);
    return polarToCart(cx, cy, i * angleStep, value * maxR);
  });

  // Catmull-Rom to cubic bezier for smooth curves
  const n = points.length;
  let path = `M ${points[0][0]},${points[0][1]}`;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const tension = 0.3;
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }

  return path + ' Z';
}

// ─── Component ──────────────────────────────────────────────────────────────────

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
  const { svgSize, maxR, labelR } = config;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const n = DOMAINS.length;
  const angleStep = (2 * Math.PI) / n;

  // Build overlap polygon (min of both profiles per domain)
  const overlapProfile = useMemo<TasteProfile>(() => {
    const p: Partial<TasteProfile> = {};
    DOMAINS.forEach(d => {
      (p as Record<string, number>)[d] = Math.min(userProfile[d] ?? 0, placeProfile[d] ?? 0);
    });
    return p as TasteProfile;
  }, [userProfile, placeProfile]);

  // Identify strongest overlap domains
  const topOverlapDomains = useMemo(() => {
    return DOMAINS
      .map(d => ({ domain: d, overlap: Math.min(userProfile[d] ?? 0, placeProfile[d] ?? 0) }))
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3)
      .filter(d => d.overlap > 0.1);
  }, [userProfile, placeProfile]);

  // Ring guides
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className={className}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          style={{ overflow: 'visible' }}
        >
          {/* Background rings */}
          {rings.map(r => (
            <circle
              key={r}
              cx={cx}
              cy={cy}
              r={maxR * r}
              fill="none"
              stroke={INK['04']}
              strokeWidth={0.75}
            />
          ))}

          {/* Axis lines + domain labels */}
          {DOMAINS.map((d, i) => {
            const angle = i * angleStep;
            const [lx, ly] = polarToCart(cx, cy, angle, maxR);
            const [tx, ty] = polarToCart(cx, cy, angle, labelR);
            const color = DOMAIN_COLORS[d];
            return (
              <g key={d}>
                <line x1={cx} y1={cy} x2={lx} y2={ly} stroke={INK['04']} strokeWidth={0.75} />
                {/* Domain dot */}
                <circle cx={lx} cy={ly} r={2.5} fill={color} opacity={0.7} />
                {/* Domain label */}
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={8}
                  fontFamily="'Space Mono', monospace"
                  fontWeight={600}
                  opacity={0.8}
                >
                  {formatDomain(d).slice(0, 4).toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* User shape */}
          <path
            d={makeSmoothPath(cx, cy, maxR, userProfile, angleStep)}
            fill={USER_FILL}
            stroke={USER_STROKE}
            strokeWidth={1.5}
          />

          {/* Place shape */}
          <path
            d={makeSmoothPath(cx, cy, maxR, placeProfile, angleStep)}
            fill={PLACE_FILL}
            stroke={PLACE_STROKE}
            strokeWidth={1.5}
          />

          {/* Overlap zone — min of both */}
          <path
            d={makeSmoothPath(cx, cy, maxR, overlapProfile, angleStep)}
            fill={OVERLAP_FILL}
            stroke="none"
          />
        </svg>
      </div>

      {/* Legend row */}
      <div
        className="flex items-center justify-center gap-4 mt-2"
        style={{ fontFamily: FONT.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 }}
      >
        <div className="flex items-center gap-1.5">
          <div style={{ width: 10, height: 10, borderRadius: 2, background: USER_STROKE, opacity: 0.6 }} />
          <span style={{ color: TEXT.secondary }}>{userLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 10, height: 10, borderRadius: 2, background: PLACE_STROKE, opacity: 0.6 }} />
          <span style={{ color: TEXT.secondary }}>{placeLabel}</span>
        </div>
      </div>

      {/* Strongest overlap domains */}
      {topOverlapDomains.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 justify-center">
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
          >
            Strongest overlap:
          </span>
          {topOverlapDomains.map(({ domain }) => (
            <span
              key={domain}
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
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
