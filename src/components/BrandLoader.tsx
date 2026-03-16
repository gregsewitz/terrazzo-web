'use client';

import React from 'react';

/**
 * BrandLoader — Terrazzo's branded loading animation.
 *
 * A small square containing the zigzag pattern that draws in with
 * a staggered reveal, then pulses gently while loading continues.
 * Renders centered on a cream background by default.
 */

// Simplified zigzag blocks — 6 L-shaped steps that form the staircase.
// Each block is positioned in the 4×9 grid (unitWidth=133.5, unitHeight=600).
// We animate each block appearing one at a time.
const ZIGZAG_BLOCKS = [
  // Top cap (row 0)
  'M 0.01 1.12 L 0.01 67.96 L 66.85 67.96 L 66.85 1.12 Z',
  // Step 1 (L-shape)
  'M 133.68 134.79 L 133.68 67.96 L 66.85 67.96 L 66.85 117.14 L 0.01 117.14 L 0.01 183.98 L 66.85 183.98 L 66.85 134.79 Z',
  // Step 2
  'M 0.01 233.16 L 0.01 300 L 66.85 300 L 66.85 250.82 L 133.68 250.82 L 133.68 183.98 L 66.85 183.98 L 66.85 233.16 Z',
  // Step 3
  'M 0.01 349.18 L 0.01 416.02 L 66.85 416.02 L 66.85 366.84 L 133.68 366.84 L 133.68 300 L 66.85 300 L 66.85 349.18 Z',
  // Step 4
  'M 0.01 465.21 L 0.01 532.04 L 66.85 532.04 L 66.85 482.86 L 133.68 482.86 L 133.68 416.02 L 66.85 416.02 L 66.85 465.21 Z',
  // Bottom cap
  'M 66.85 598.88 L 66.85 532.04 L 133.68 532.04 L 133.68 598.88 Z',
];

const BRAND_COLORS = [
  'var(--t-coral)',
  'var(--t-dark-teal)',
  'var(--t-ochre)',
  'var(--t-navy)',
  'var(--t-teal)',
  'var(--t-coral)',
];

export default function BrandLoader({ message }: { message?: string }) {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-5"
      style={{ background: 'var(--t-cream)' }}
    >
      <div style={{ width: 48, height: 48 }}>
        <svg
          viewBox="0 0 133.5 600"
          style={{ width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          {ZIGZAG_BLOCKS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={BRAND_COLORS[i]}
              fillRule="nonzero"
              style={{
                opacity: 0,
                animation: `zigzagFadeIn 0.3s ease-out ${i * 0.12}s forwards, zigzagPulse 2s ease-in-out ${0.72 + i * 0.12}s infinite`,
              }}
            />
          ))}
        </svg>
      </div>
      {message && (
        <span
          className="text-[12px]"
          style={{
            color: 'var(--t-navy)',
            fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
            opacity: 0,
            animation: 'zigzagFadeIn 0.4s ease-out 0.6s forwards',
          }}
        >
          {message}
        </span>
      )}

      <style>{`
        @keyframes zigzagFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes zigzagPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
