import { StretchPickAxis } from '@/components/intelligence';
import type { StretchPick as IntelStretchPick } from '@/components/intelligence';
import { STRETCH_PICK } from '@/constants/discover';
import type { TasteDomain } from '@/types';
import { INK, COLOR } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function StretchPickSection({ stretch }: { stretch?: typeof STRETCH_PICK }) {
  const s = stretch || STRETCH_PICK;
  const intelStretch: IntelStretchPick = {
    name: s.name,
    location: s.location,
    matchTier: s.matchTier,
    type: s.type,
    strongAxis: s.strongAxis as TasteDomain,
    strongTier: s.strongTier,
    weakAxis: s.weakAxis as TasteDomain,
    weakTier: s.weakTier,
    why: s.why,
    tension: s.tension,
    googlePlaceId: s.googlePlaceId,
  };
  return (
    <div className="px-5 py-6" style={{ borderBottom: `1px solid ${INK['06']}` }}>
      <SectionLabel color={COLOR.mint} dotColor={COLOR.darkTeal}>Stretch Pick</SectionLabel>
      <StretchPickAxis
        pick={intelStretch}
        onPlaceTap={undefined}
        variant="mobile"
      />
    </div>
  );
}
