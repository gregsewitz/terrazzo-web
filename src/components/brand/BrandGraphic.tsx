'use client';

import React from 'react';
import Image from 'next/image';

/**
 * Available brand graphic variants:
 * - geometric: Bold Bauhaus-style rectangles and blocks (Brand Cover)
 * - fields: Flowing organic curves and color fields (Color Fields)
 * - palette: Sweeping abstract shapes (Color Palette)
 */
export type BrandGraphicVariant = 'geometric' | 'fields' | 'palette';

const GRAPHIC_SRCS: Record<BrandGraphicVariant, string> = {
  geometric: '/brand-graphic-geometric.svg',
  fields: '/brand-graphic-fields.svg',
  palette: '/brand-graphic-palette.svg',
};

export interface BrandGraphicProps {
  /** Which graphic to use */
  variant: BrandGraphicVariant;
  /** Opacity (0-1). Defaults to 0.12 for subtle overlay */
  opacity?: number;
  /** CSS blend mode. Defaults to 'normal' */
  blendMode?: React.CSSProperties['mixBlendMode'];
  /** Which part of the graphic to show. Defaults to 'cover' */
  objectFit?: 'cover' | 'contain';
  /** Object position. Defaults to 'center' */
  objectPosition?: string;
  /** Mirror horizontally */
  mirror?: boolean;
  /** Additional className for the container */
  className?: string;
  /** Override inline styles on the container */
  style?: React.CSSProperties;
}

/**
 * BrandGraphic — Large decorative SVG background overlay.
 *
 * Uses the Terrazzo brand art as bold, splashy section backgrounds.
 * Position this absolutely within a relative parent to create a
 * dramatic background effect.
 *
 * @example Full-section background overlay
 * ```tsx
 * <section className="relative overflow-hidden">
 *   <BrandGraphic variant="fields" opacity={0.1} />
 *   <div className="relative z-10">{content}</div>
 * </section>
 * ```
 *
 * @example Section transition strip
 * ```tsx
 * <BrandGraphic variant="geometric" opacity={0.8} className="h-32 relative" />
 * ```
 */
export function BrandGraphic({
  variant,
  opacity = 0.12,
  blendMode = 'normal',
  objectFit = 'cover',
  objectPosition = 'center',
  mirror = false,
  className = '',
  style,
}: BrandGraphicProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={{
        opacity,
        mixBlendMode: blendMode,
        transform: mirror ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    >
      <Image
        src={GRAPHIC_SRCS[variant]}
        alt=""
        fill
        style={{
          objectFit,
          objectPosition,
        }}
        priority={false}
      />
    </div>
  );
}

/**
 * BrandGraphicTransition — A full-width decorative strip between sections.
 * Shows a cropped slice of the brand graphic at higher opacity.
 */
export function BrandGraphicTransition({
  variant = 'fields',
  height = 120,
  opacity = 0.85,
  objectPosition = 'center 40%',
  mirror = false,
  className = '',
}: {
  variant?: BrandGraphicVariant;
  height?: number;
  opacity?: number;
  objectPosition?: string;
  mirror?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden w-full ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <BrandGraphic
        variant={variant}
        opacity={opacity}
        objectPosition={objectPosition}
        mirror={mirror}
      />
    </div>
  );
}

export default BrandGraphic;
