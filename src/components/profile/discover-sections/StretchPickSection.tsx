import { StretchPickAxis } from '@/components/intelligence';
import type { StretchPick as IntelStretchPick } from '@/components/intelligence';
import { STRETCH_PICK } from '@/constants/discover';
import type { TasteDomain } from '@/types';

export function StretchPickSection({ stretch }: { stretch?: typeof STRETCH_PICK }) {
  const s = stretch || STRETCH_PICK;
  const intelStretch: IntelStretchPick = {
    name: s.name,
    location: s.location,
    score: s.score,
    type: s.type,
    strongAxis: s.strongAxis as TasteDomain,
    strongScore: s.strongScore,
    weakAxis: s.weakAxis as TasteDomain,
    weakScore: s.weakScore,
    why: s.why,
    tension: s.tension,
    googlePlaceId: s.googlePlaceId,
  };
  return (
    <div className="px-5 mb-10">
      <StretchPickAxis
        pick={intelStretch}
        onPlaceTap={undefined}
        variant="mobile"
      />
    </div>
  );
}
