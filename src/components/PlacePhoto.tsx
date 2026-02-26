'use client';

import Image from 'next/image';

interface PlacePhotoProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Optimized place photo component using next/image.
 * Provides automatic lazy loading, responsive sizing, and format negotiation (WebP/AVIF).
 * Falls back to a gradient placeholder when no photo URL is available.
 */
export default function PlacePhoto({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes = '(max-width: 768px) 100vw, 400px',
  priority = false,
  className,
  style,
}: PlacePhotoProps) {
  if (!src) {
    return (
      <div
        className={className}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          background: 'linear-gradient(135deg, var(--t-linen) 0%, rgba(200,146,58,0.12) 100%)',
          ...style,
        }}
        role="img"
        aria-label={alt}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        style={{ objectFit: 'cover', ...style }}
        unoptimized={src.startsWith('data:')} // skip optimization for data URIs
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 400}
      height={height || 300}
      sizes={sizes}
      priority={priority}
      className={className}
      style={{ objectFit: 'cover', ...style }}
      unoptimized={src.startsWith('data:')}
    />
  );
}
