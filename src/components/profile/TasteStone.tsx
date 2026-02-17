'use client';

import { AXIS_COLORS } from '@/constants/profile';

interface TasteStoneProps {
  data: Array<{ axis: string; value: number }>;
  size?: number;
}

/**
 * TasteStone — A terrazzo-inspired icon that replaces the radar chart.
 *
 * An organic pebble body (travertine stone) with embedded chip inclusions,
 * each colored by the user's taste domain. Chip size reflects axis strength.
 * Communicates "many inputs creating a whole" through the visual language
 * of terrazzo marble — organic forms, natural materials, material honesty.
 */

// Organic chip shapes — each is a unique pebble/chip path defined at origin,
// then positioned and scaled per-axis. These are hand-drawn bezier forms
// that feel like real stone or aggregate inclusions.
const CHIP_PATHS = [
  // Chip 0 — rounded river stone
  'M0,-1 C0.6,-1.1 1.1,-0.5 1,-0.1 C0.9,0.4 0.7,1 0.1,1.1 C-0.5,1.1 -1,0.6 -1.1,0 C-1.1,-0.5 -0.6,-1 0,-1 Z',
  // Chip 1 — elongated pebble
  'M-0.3,-1.1 C0.4,-1.2 1,-0.7 1.1,-0.1 C1.2,0.5 0.8,1 0.2,1.1 C-0.4,1.1 -1,0.5 -1.1,-0.2 C-1.1,-0.8 -0.8,-1 -0.3,-1.1 Z',
  // Chip 2 — irregular fragment
  'M0.1,-1 C0.8,-0.9 1.1,-0.2 0.9,0.4 C0.7,0.9 0,1.1 -0.5,0.9 C-1,0.6 -1.1,-0.1 -0.8,-0.7 C-0.5,-1.1 -0.1,-1.1 0.1,-1 Z',
  // Chip 3 — rounded triangle
  'M0,-1.1 C0.7,-0.8 1.1,-0.1 0.8,0.5 C0.5,1 -0.2,1.1 -0.7,0.7 C-1.1,0.2 -0.9,-0.6 -0.4,-1 C-0.2,-1.1 0,-1.1 0,-1.1 Z',
  // Chip 4 — wide flat chip
  'M-0.2,-0.9 C0.5,-1.1 1,-0.6 1.1,0 C1.1,0.6 0.6,1.1 -0.1,1 C-0.7,0.9 -1.1,0.3 -1,-0.3 C-0.9,-0.8 -0.5,-0.9 -0.2,-0.9 Z',
  // Chip 5 — small angular
  'M0.2,-1 C0.9,-0.8 1,-0.1 0.7,0.5 C0.4,1 -0.3,1.1 -0.8,0.6 C-1.1,0.1 -0.8,-0.7 -0.2,-1 C0,-1.1 0.2,-1 0.2,-1 Z',
];

// Positions for chips within the stone body (normalized 0-1 within the stone bounds).
// Laid out to feel naturally scattered like real terrazzo aggregate.
const CHIP_POSITIONS = [
  { x: 0.35, y: 0.30, rotation: -15 },   // top-left area
  { x: 0.68, y: 0.25, rotation: 30 },     // top-right
  { x: 0.22, y: 0.60, rotation: -40 },    // mid-left
  { x: 0.55, y: 0.55, rotation: 10 },     // center
  { x: 0.78, y: 0.58, rotation: -25 },    // right
  { x: 0.42, y: 0.78, rotation: 45 },     // bottom-center
];

export default function TasteStone({ data, size = 280 }: TasteStoneProps) {
  // The stone body is drawn in a viewBox of 100×70
  const vw = 100;
  const vh = 70;

  // Scale factor for chips based on axis value (0.6–1.0 range → chip scale 4–8)
  const getChipScale = (value: number) => 3.5 + value * 5;

  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Travertine gradient — warm stone body */}
        <linearGradient id="tasteStone-trav" x1="0%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#d8c8ae" />
          <stop offset="30%" stopColor="#d0bfa4" />
          <stop offset="60%" stopColor="#c8b498" />
          <stop offset="100%" stopColor="#c0ab8e" />
        </linearGradient>

        {/* Subtle stone texture pattern */}
        <pattern id="tasteStone-tex" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="none" />
          <circle cx="3" cy="5" r="0.4" fill="rgba(140,120,100,0.1)" />
          <circle cx="12" cy="3" r="0.3" fill="rgba(140,120,100,0.07)" />
          <circle cx="17" cy="10" r="0.5" fill="rgba(140,120,100,0.08)" />
          <circle cx="5" cy="15" r="0.25" fill="rgba(140,120,100,0.06)" />
          <circle cx="14" cy="17" r="0.35" fill="rgba(140,120,100,0.07)" />
          <circle cx="8" cy="9" r="0.3" fill="rgba(140,120,100,0.05)" />
        </pattern>

        {/* Soft shadow for depth */}
        <filter id="tasteStone-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#1c1a17" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* The stone body — organic Table Form silhouette */}
      <g filter="url(#tasteStone-shadow)">
        <path
          d="M18,22 C14,10 28,4 48,3 L76,5 C90,8 98,18 96,30 C94,42 84,52 68,56 C50,60 30,58 16,50 C6,42 8,30 18,22 Z"
          fill="url(#tasteStone-trav)"
        />
        <path
          d="M18,22 C14,10 28,4 48,3 L76,5 C90,8 98,18 96,30 C94,42 84,52 68,56 C50,60 30,58 16,50 C6,42 8,30 18,22 Z"
          fill="url(#tasteStone-tex)"
        />
      </g>

      {/* Embedded chip inclusions — one per taste axis */}
      {data.map((d, i) => {
        if (i >= CHIP_POSITIONS.length) return null;
        const pos = CHIP_POSITIONS[i];
        const chipPath = CHIP_PATHS[i % CHIP_PATHS.length];
        const color = AXIS_COLORS[d.axis] || '#8b6b4a';
        const scale = getChipScale(d.value);

        // Map normalized position to actual stone bounds (roughly 12-96 x, 3-58 y)
        const cx = 12 + pos.x * 82;
        const cy = 5 + pos.y * 50;

        return (
          <g key={d.axis} transform={`translate(${cx}, ${cy}) rotate(${pos.rotation}) scale(${scale})`}>
            <path
              d={chipPath}
              fill={color}
              opacity={0.75 + d.value * 0.25}
            />
            {/* Subtle highlight on each chip — catches light like polished stone */}
            <path
              d={chipPath}
              fill="white"
              opacity={0.12}
              transform="scale(0.6) translate(-0.2, -0.3)"
            />
          </g>
        );
      })}

      {/* Very subtle edge highlight — polished stone sheen */}
      <path
        d="M18,22 C14,10 28,4 48,3 L76,5 C90,8 98,18 96,30 C94,42 84,52 68,56 C50,60 30,58 16,50 C6,42 8,30 18,22 Z"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.5"
      />
    </svg>
  );
}
