'use client';

import React, { useMemo } from 'react';
import { TasteDomain, TasteProfile, DOMAIN_COLORS, CORE_TASTE_DOMAINS } from '@/types';
import { FONT, INK, TEXT } from '@/constants/theme';
import { formatDomain } from '@/constants/profile';

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

const SIZE_CONFIG: Record<MosaicSize, { svgSize: number; maxR: number; showLabels: boolean }> = {
  lg: { svgSize: 200, maxR: 72, showLabels: true },
  md: { svgSize: 140, maxR: 50, showLabels: true },
  sm: { svgSize: 80, maxR: 30, showLabels: false },
  xs: { svgSize: 44, maxR: 16, showLabels: false },
};

// ─── Shared domains ────────────────────────────────────────────────────────────

const DOMAINS = CORE_TASTE_DOMAINS;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function polarToCart(cx: number, cy: number, angle: number, r: number): [number, number] {
  return [cx + r * Math.cos(angle - Math.PI / 2), cy + r * Math.sin(angle - Math.PI / 2)];
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

// ─── Component ─────────────────────────────────────────────────────────────────

export function TerrazzoMosaic({ profile, size = 'md', className, style }: TerrazzoMosaicProps) {
  const config = SIZE_CONFIG[size];
  const { svgSize, maxR, showLabels } = config;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const n = DOMAINS.length;
  const angleStep = (2 * Math.PI) / n;
  const labelR = maxR + (size === 'lg' ? 18 : 14);

  // Guide rings
  const rings = showLabels ? [0.5, 1.0] : [1.0];

  // Per-domain gradient segments for the fill
  const segments = useMemo(() => {
    return DOMAINS.map((d, i) => {
      const value = Math.max(profile[d] ?? 0, 0.08);
      const color = DOMAIN_COLORS[d];
      const [x, y] = polarToCart(cx, cy, i * angleStep, value * maxR);
      return { domain: d, color, x, y, value };
    });
  }, [profile, cx, cy, maxR, angleStep]);

  return (
    <div className={className} style={{ display: 'inline-flex', flexShrink: 0, ...style }}>
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

        {/* Axis lines + domain dots/labels */}
        {DOMAINS.map((d, i) => {
          const angle = i * angleStep;
          const [lx, ly] = polarToCart(cx, cy, angle, maxR);
          const [tx, ty] = polarToCart(cx, cy, angle, labelR);
          const color = DOMAIN_COLORS[d];
          return (
            <g key={d}>
              <line x1={cx} y1={cy} x2={lx} y2={ly} stroke={INK['04']} strokeWidth={0.5} />
              <circle cx={lx} cy={ly} r={showLabels ? 2 : 1.5} fill={color} opacity={0.7} />
              {showLabels && (
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={size === 'lg' ? 8 : 7}
                  fontFamily="'Space Mono', monospace"
                  fontWeight={600}
                  opacity={0.8}
                >
                  {formatDomain(d).slice(0, 4).toUpperCase()}
                </text>
              )}
            </g>
          );
        })}

        {/* Profile shape — gradient-like using per-segment colors */}
        <defs>
          {/* Radial gradient from center for each segment */}
          {segments.map((seg, i) => {
            const nextSeg = segments[(i + 1) % segments.length];
            return (
              <linearGradient
                key={seg.domain}
                id={`petal-grad-${seg.domain}`}
                x1={cx}
                y1={cy}
                x2={seg.x}
                y2={seg.y}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={seg.color} stopOpacity={0.08} />
                <stop offset="100%" stopColor={seg.color} stopOpacity={0.35} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Main shape fill — averaged color approach */}
        <path
          d={makeSmoothPath(cx, cy, maxR, profile, angleStep)}
          fill={`${DOMAIN_COLORS[DOMAINS[0]]}18`}
          stroke="none"
        />

        {/* Per-domain wedge fills for color variation */}
        {segments.map((seg, i) => {
          const nextSeg = segments[(i + 1) % segments.length];
          const wedgePath = `M ${cx},${cy} L ${seg.x},${seg.y} L ${nextSeg.x},${nextSeg.y} Z`;
          return (
            <path
              key={seg.domain}
              d={wedgePath}
              fill={seg.color}
              opacity={0.15 + seg.value * 0.15}
              style={{ mixBlendMode: 'multiply' }}
            />
          );
        })}

        {/* Profile shape outline */}
        <path
          d={makeSmoothPath(cx, cy, maxR, profile, angleStep)}
          fill="none"
          stroke={DOMAIN_COLORS[DOMAINS[0]]}
          strokeWidth={1.5}
          opacity={0.4}
        />
      </svg>
    </div>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────────

export function MosaicLegend({ profile, className, style, dark = false }: MosaicLegendProps) {
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
              color: dark ? 'rgba(245,240,230,0.6)' : TEXT.secondary,
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
