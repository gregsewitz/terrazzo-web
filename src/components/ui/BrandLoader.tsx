'use client';

import React from 'react';

/**
 * BrandLoader — Terrazzo's branded loading animation.
 *
 * Four identical multi-color zigzag columns that build in block-by-block,
 * one column at a time left-to-right. After all 24 blocks are placed,
 * the whole grid pulses gently. Each zigzag uses the brand color sequence:
 * coral → dark-teal → ochre → navy → olive → coral.
 */

const ZIGZAG_BLOCKS = [
  { d: 'M 0.01 1.12 L 0.01 67.96 L 66.85 67.96 L 66.85 1.12 Z', color: 'var(--t-coral)' },
  { d: 'M 133.68 134.79 L 133.68 67.96 L 66.85 67.96 L 66.85 117.14 L 0.01 117.14 L 0.01 183.98 L 66.85 183.98 L 66.85 134.79 Z', color: 'var(--t-dark-teal)' },
  { d: 'M 0.01 233.16 L 0.01 300 L 66.85 300 L 66.85 250.82 L 133.68 250.82 L 133.68 183.98 L 66.85 183.98 L 66.85 233.16 Z', color: 'var(--t-ochre)' },
  { d: 'M 0.01 349.18 L 0.01 416.02 L 66.85 416.02 L 66.85 366.84 L 133.68 366.84 L 133.68 300 L 66.85 300 L 66.85 349.18 Z', color: 'var(--t-navy)' },
  { d: 'M 0.01 465.21 L 0.01 532.04 L 66.85 532.04 L 66.85 482.86 L 133.68 482.86 L 133.68 416.02 L 66.85 416.02 L 66.85 465.21 Z', color: 'var(--t-olive)' },
  { d: 'M 66.85 598.88 L 66.85 532.04 L 133.68 532.04 L 133.68 598.88 Z', color: 'var(--t-coral)' },
];

const NUM_COLS = 4;
const BLOCKS_PER_COL = ZIGZAG_BLOCKS.length;
const BLOCK_DELAY = 0.18; // seconds between each block
const COL_PAUSE = 0.3;   // extra pause between columns
const TOTAL_ANIM = NUM_COLS * BLOCKS_PER_COL * BLOCK_DELAY + (NUM_COLS - 1) * COL_PAUSE;
const PULSE_START = TOTAL_ANIM + 0.3;

function getBlockDelay(colIdx: number, blockIdx: number): number {
  const colStart = colIdx * (BLOCKS_PER_COL * BLOCK_DELAY + COL_PAUSE);
  return colStart + blockIdx * BLOCK_DELAY;
}

export default function BrandLoader({ message }: { message?: string }) {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-5"
      style={{ background: 'var(--t-cream)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Array.from({ length: NUM_COLS }, (_, colIdx) => (
          <div key={colIdx} style={{ width: 24 }}>
            <svg
              viewBox="0 0 134 610"
              style={{ width: '100%', overflow: 'visible' }}
              aria-hidden="true"
            >
              {ZIGZAG_BLOCKS.map(({ d, color }, blockIdx) => (
                <path
                  key={blockIdx}
                  d={d}
                  fill={color}
                  fillRule="nonzero"
                  style={{
                    opacity: 0,
                    animation: `zzBlockIn 0.15s ease ${getBlockDelay(colIdx, blockIdx)}s forwards`,
                  }}
                />
              ))}
            </svg>
          </div>
        ))}
      </div>
      {message && (
        <span
          className="text-[12px]"
          style={{
            color: 'var(--t-navy)',
            fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
            opacity: 0,
            animation: `zzBlockIn 0.4s ease-out ${TOTAL_ANIM + 0.2}s forwards`,
          }}
        >
          {message}
        </span>
      )}

    </div>
  );
}
