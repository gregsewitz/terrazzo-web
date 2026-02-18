'use client';

/**
 * TasteAxes — now renders a Terrazzo Mosaic™ (clustered tiles)
 * instead of horizontal progress bars.
 *
 * Kept as a thin wrapper so existing imports don't break.
 */

import { TasteProfile } from '@/types';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';

interface TasteAxesProps {
  profile: TasteProfile;
  size?: 'sm' | 'md' | 'lg';
  /** Show the color legend beneath the mosaic */
  showLegend?: boolean;
}

const SIZE_MAP = { sm: 'sm', md: 'md', lg: 'lg' } as const;

export default function TasteAxes({ profile, size = 'md', showLegend = false }: TasteAxesProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <TerrazzoMosaic profile={profile} size={SIZE_MAP[size]} />
      {showLegend && <MosaicLegend profile={profile} />}
    </div>
  );
}
