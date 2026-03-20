'use client';

import React from 'react';
import { COLOR } from '@/constants/theme';

/**
 * Brand color map — maps semantic color names to CSS variable values.
 * Uses the new brand palette tokens defined in globals.css.
 */
const BRAND_COLORS: Record<string, string> = {
  navy: `var(--t-navy, ${COLOR.navy})`,
  cream: `var(--t-cream, ${COLOR.cream})`,
  coral: `var(--t-coral, ${COLOR.coral})`,
  teal: `var(--t-teal, ${COLOR.teal})`,
  ochre: `var(--t-ochre, ${COLOR.ochre})`,
  olive: `var(--t-olive, ${COLOR.olive})`,
  charcoal: `var(--t-charcoal, ${COLOR.charcoal})`,
  'warm-gray': `var(--t-warm-gray, ${COLOR.warmGray})`,
  peach: `var(--t-peach, ${COLOR.peach})`,
  mint: `var(--t-mint, ${COLOR.mint})`,
  orange: `var(--t-orange, ${COLOR.orange})`,
};

/**
 * The zigzag path data extracted from the Canva-exported SVG.
 * ViewBox: 0 0 133.5 600
 * Geometry: 2-column staircase with L-shaped steps, square caps at corners.
 * This is the exact path shared across all 6 brand color variants.
 */
const ZIGZAG_PATH =
  'M 66.85 598.88 L 66.85 532.04 L 133.68 532.04 L 133.68 598.88 Z ' +
  'M 133.68 134.79 L 133.68 67.96 L 66.85 67.96 L 66.85 117.14 L 0.01 117.14 L 0.01 183.98 L 66.85 183.98 L 66.85 134.79 Z ' +
  'M 0.01 465.21 L 0.01 532.04 L 66.85 532.04 L 66.85 482.86 L 133.68 482.86 L 133.68 416.02 L 66.85 416.02 L 66.85 465.21 Z ' +
  'M 0.01 349.18 L 0.01 416.02 L 66.85 416.02 L 66.85 366.84 L 133.68 366.84 L 133.68 300 L 66.85 300 L 66.85 349.18 Z ' +
  'M 0.01 233.16 L 0.01 300 L 66.85 300 L 66.85 250.82 L 133.68 250.82 L 133.68 183.98 L 66.85 183.98 L 66.85 233.16 Z ' +
  'M 0.01 1.12 L 0.01 67.96 L 66.85 67.96 L 66.85 1.12 Z';

export interface BrandPatternProps {
  /** Brand color name or any valid CSS color string */
  color?: keyof typeof BRAND_COLORS | (string & {});
  /** Render the pattern horizontally (rotated 90°) */
  orientation?: 'vertical' | 'horizontal';
  /** Mirror horizontally (scaleX -1) — for right-side placements */
  mirror?: boolean;
  /** Flip vertically (scaleY -1) — for bottom placements */
  flip?: boolean;
  /** Number of times to repeat the pattern (stacked vertically or horizontally) */
  repeat?: number;
  /** Additional CSS class names for sizing and positioning */
  className?: string;
  /** Override aria-hidden (defaults to true since pattern is decorative) */
  'aria-hidden'?: boolean;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * BrandPattern — Terrazzo's geometric zigzag motif as an inline SVG component.
 *
 * Renders the brand's signature staircase/zigzag pattern used as decorative
 * accents throughout the UI. The pattern scales cleanly at any size via
 * SVG viewBox, works on every device, and requires no external file loading.
 *
 * @example Vertical strip on the right edge of a card
 * ```tsx
 * <div className="relative overflow-hidden">
 *   <BrandPattern color="navy" className="absolute right-0 top-0 h-full w-8" />
 *   {children}
 * </div>
 * ```
 *
 * @example Corner accent (mirrored for right side)
 * ```tsx
 * <BrandPattern color="coral" mirror className="absolute top-4 right-4 h-24 w-6" />
 * ```
 *
 * @example Horizontal divider between sections
 * ```tsx
 * <BrandPattern color="teal" orientation="horizontal" className="w-full h-6" />
 * ```
 */
export function BrandPattern({
  color = 'navy',
  orientation = 'vertical',
  mirror = false,
  flip = false,
  repeat = 1,
  className = '',
  style,
  'aria-hidden': ariaHidden = true,
}: BrandPatternProps) {
  // Resolve color — check brand map first, fall back to raw CSS value
  const resolvedColor = BRAND_COLORS[color] || color;

  // Build transform string
  const transforms: string[] = [];
  if (mirror) transforms.push('scaleX(-1)');
  if (flip) transforms.push('scaleY(-1)');

  const transformStyle = transforms.length > 0 ? transforms.join(' ') : undefined;

  // Single pattern unit dimensions
  const unitWidth = 133.5;
  const unitHeight = 600;

  // For horizontal orientation, we rotate the entire SVG
  const isHorizontal = orientation === 'horizontal';

  if (repeat <= 1) {
    // Single pattern — simple case
    const viewBox = isHorizontal
      ? `0 0 ${unitHeight} ${unitWidth}`
      : `0 0 ${unitWidth} ${unitHeight}`;

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden={ariaHidden}
        className={className}
        style={{
          ...style,
          transform: transformStyle,
          display: 'block',
        }}
      >
        <g
          transform={
            isHorizontal
              ? `rotate(90 ${unitHeight / 2} ${unitWidth / 2}) translate(${(unitHeight - unitWidth) / 2} ${(unitWidth - unitHeight) / 2})`
              : undefined
          }
        >
          <path d={ZIGZAG_PATH} fill={resolvedColor} fillRule="nonzero" />
        </g>
      </svg>
    );
  }

  // Repeated pattern — stack multiple units
  const totalHeight = unitHeight * repeat;
  const viewBox = isHorizontal
    ? `0 0 ${totalHeight} ${unitWidth}`
    : `0 0 ${unitWidth} ${totalHeight}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden={ariaHidden}
      className={className}
      style={{
        ...style,
        transform: transformStyle,
        display: 'block',
      }}
    >
      {Array.from({ length: repeat }, (_, i) => (
        <g
          key={i}
          transform={
            isHorizontal
              ? `rotate(90 ${totalHeight / 2} ${unitWidth / 2}) translate(${(totalHeight - unitWidth) / 2 + i * unitHeight} ${(unitWidth - totalHeight) / 2})`
              : `translate(0 ${i * unitHeight})`
          }
        >
          <path d={ZIGZAG_PATH} fill={resolvedColor} fillRule="nonzero" />
        </g>
      ))}
    </svg>
  );
}

/**
 * BrandPatternStrip — A common layout: multi-color zigzag strip.
 * Stacks multiple BrandPattern units with alternating colors.
 *
 * @example Right edge of a poster/hero section (like the Canva poster)
 * ```tsx
 * <BrandPatternStrip
 *   colors={['navy', 'coral', 'navy', 'coral']}
 *   className="absolute right-0 top-0 h-full w-8"
 * />
 * ```
 */
export interface BrandPatternStripProps {
  /** Array of brand color names, one per segment */
  colors: Array<keyof typeof BRAND_COLORS | (string & {})>;
  /** Orientation of the strip */
  orientation?: 'vertical' | 'horizontal';
  /** Mirror the entire strip */
  mirror?: boolean;
  /** Flip the entire strip */
  flip?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

export function BrandPatternStrip({
  colors,
  orientation = 'vertical',
  mirror = false,
  flip = false,
  className = '',
  style,
}: BrandPatternStripProps) {
  const isHorizontal = orientation === 'horizontal';

  const transforms: string[] = [];
  if (mirror) transforms.push('scaleX(-1)');
  if (flip) transforms.push('scaleY(-1)');
  const transformStyle = transforms.length > 0 ? transforms.join(' ') : undefined;

  return (
    <div
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}
      style={{ ...style, transform: transformStyle }}
      aria-hidden="true"
    >
      {colors.map((color, i) => (
        <BrandPattern
          key={i}
          color={color}
          orientation={orientation}
          className={isHorizontal ? 'h-full flex-1' : 'w-full flex-1'}
        />
      ))}
    </div>
  );
}

export default BrandPattern;
