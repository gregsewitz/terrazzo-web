'use client';

import React from 'react';
import Image from 'next/image';
import { COLOR } from '@/constants/theme';

/**
 * Brand color map for inline SVG fills (icon variant only).
 */
const BRAND_COLORS: Record<string, string> = {
  navy: `var(--t-navy, ${COLOR.navy})`,
  cream: `var(--t-cream, ${COLOR.cream})`,
  coral: `var(--t-coral, ${COLOR.coral})`,
  teal: `var(--t-teal, ${COLOR.teal})`,
  ochre: `var(--t-ochre, ${COLOR.ochre})`,
  olive: `var(--t-olive, ${COLOR.olive})`,
  mint: `var(--t-mint, ${COLOR.mint})`,
  orange: `var(--t-orange, ${COLOR.orange})`,
};

/**
 * Background colors that are considered "dark" — wordmark should use light (cream) variant.
 * Everything else gets the dark (navy) variant.
 */
const DARK_BACKGROUNDS = new Set([
  'navy', 'charcoal', 'coral', 'olive',
  COLOR.navy, COLOR.charcoal, COLOR.coral, COLOR.olive,
]);

/**
 * Zigzag icon mark path data (shared with BrandPattern).
 * Small enough to inline — avoids an image request for this common element.
 */
const ICON_PATH =
  'M 66.85 598.88 L 66.85 532.04 L 133.68 532.04 L 133.68 598.88 Z ' +
  'M 133.68 134.79 L 133.68 67.96 L 66.85 67.96 L 66.85 117.14 L 0.01 117.14 L 0.01 183.98 L 66.85 183.98 L 66.85 134.79 Z ' +
  'M 0.01 465.21 L 0.01 532.04 L 66.85 532.04 L 66.85 482.86 L 133.68 482.86 L 133.68 416.02 L 66.85 416.02 L 66.85 465.21 Z ' +
  'M 0.01 349.18 L 0.01 416.02 L 66.85 416.02 L 66.85 366.84 L 133.68 366.84 L 133.68 300 L 66.85 300 L 66.85 349.18 Z ' +
  'M 0.01 233.16 L 0.01 300 L 66.85 300 L 66.85 250.82 L 133.68 250.82 L 133.68 183.98 L 66.85 183.98 L 66.85 233.16 Z ' +
  'M 0.01 1.12 L 0.01 67.96 L 66.85 67.96 L 66.85 1.12 Z';

export interface LogoProps {
  /** Logo variant: wordmark (full "TERRAZZO" text) or icon (zigzag mark) */
  variant: 'wordmark' | 'icon';
  /**
   * Font style for wordmark variant. Default: 'pixellance'.
   * - pixellance: Pixel/bitmap style (current default)
   * - aperture: Geometric/angular style
   * Ignored for icon variant.
   */
  font?: 'pixellance' | 'aperture';
  /**
   * Theme controls light/dark variant selection.
   * - 'dark': Navy fill (for light backgrounds like cream, peach, ochre)
   * - 'light': Cream fill (for dark backgrounds like navy, coral, charcoal)
   * - 'auto': Automatically selects based on `onBackground` prop
   * Default: 'dark' (navy on cream — the most common case)
   */
  theme?: 'dark' | 'light' | 'auto';
  /**
   * When theme='auto', pass the background color name or hex to auto-detect.
   * Dark backgrounds → light logo. Light backgrounds → dark logo.
   */
  onBackground?: string;
  /**
   * Color override for icon variant (any brand color or CSS string).
   * Wordmark variants use theme-based SVG files and ignore this prop.
   */
  color?: keyof typeof BRAND_COLORS | (string & {});
  /** Additional CSS class names for sizing */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * Logo — Terrazzo brand logo component.
 *
 * Two variants:
 * - `wordmark`: Full "TERRAZZO" text in either Pixellance (pixel) or Aperture (geometric) font.
 *   Renders as `<Image>` from `/public/brand/` SVG files for exact fidelity.
 * - `icon`: Vertical zigzag mark. Renders as inline SVG for dynamic color control.
 *
 * @example Default usage (Pixellance, navy on cream)
 * ```tsx
 * <Logo variant="wordmark" className="h-8 w-auto" alt="Terrazzo" />
 * ```
 *
 * @example Light variant on dark background
 * ```tsx
 * <div className="bg-navy">
 *   <Logo variant="wordmark" theme="light" className="h-8 w-auto" alt="Terrazzo" />
 * </div>
 * ```
 *
 * @example Auto-detect theme from background
 * ```tsx
 * <Logo variant="wordmark" theme="auto" onBackground="coral" className="h-8 w-auto" />
 * ```
 *
 * @example Aperture font variant
 * ```tsx
 * <Logo variant="wordmark" font="aperture" className="h-8 w-auto" alt="Terrazzo" />
 * ```
 *
 * @example Icon mark with custom color
 * ```tsx
 * <Logo variant="icon" color="coral" className="h-12 w-auto" />
 * ```
 */
export function Logo({
  variant,
  font = 'pixellance',
  theme = 'dark',
  onBackground,
  color,
  className = '',
  alt = 'Terrazzo',
  style,
}: LogoProps) {
  // Resolve theme when set to 'auto'
  const resolvedTheme =
    theme === 'auto'
      ? DARK_BACKGROUNDS.has(onBackground || '') ? 'light' : 'dark'
      : theme;

  if (variant === 'wordmark') {
    // Build path to the correct SVG file in /public/brand/
    const colorSuffix = resolvedTheme === 'light' ? 'cream' : 'navy';
    const src = `/brand/logo-${font}-${colorSuffix}.svg`;

    // Both font variants have viewBox 0 0 2250 375 → aspect ratio 6:1
    return (
      <Image
        src={src}
        alt={alt}
        width={2250}
        height={375}
        className={className}
        style={{ display: 'block', height: 'auto', ...style }}
        priority
        unoptimized // SVGs don't need image optimization
      />
    );
  }

  // Icon variant — inline SVG for dynamic color
  const resolvedColor = color
    ? (BRAND_COLORS[color] || color)
    : resolvedTheme === 'light'
      ? BRAND_COLORS.cream
      : BRAND_COLORS.navy;

  const isDecorative = !alt;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 133.5 600"
      preserveAspectRatio="xMidYMid meet"
      role={isDecorative ? 'presentation' : 'img'}
      aria-label={alt || undefined}
      aria-hidden={isDecorative}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <path fill={resolvedColor} d={ICON_PATH} fillRule="nonzero" />
    </svg>
  );
}

export default Logo;
