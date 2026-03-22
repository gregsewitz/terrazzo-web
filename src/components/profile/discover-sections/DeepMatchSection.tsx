import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import { DeepMatchBreakdown } from '@/components/intelligence';
import type { DeepMatch as IntelDeepMatch } from '@/components/intelligence';
import { DEEP_MATCH, type DeepMatch } from '@/constants/discover';
import type { TasteDomain } from '@/types';
import { COLOR, INK } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function DeepMatchSection({ match }: { match?: DeepMatch }) {
  const m = match || DEEP_MATCH;
  const intelMatch: IntelDeepMatch = {
    name: m.name,
    location: m.location,
    matchTier: m.matchTier,
    headline: m.headline,
    signalBreakdown: m.signalBreakdown.map(s => ({
      signal: s.signal,
      domain: s.domain as TasteDomain,
      tierLabel: s.tierLabel,
      note: s.note,
    })),
    tensionResolved: m.tensionResolved,
    googlePlaceId: m.googlePlaceId,
  };
  return (
    <SafeMotionDiv
      className="px-5 py-6"
      style={{ borderBottom: `1px solid ${INK['06']}` }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mb-3"><SectionLabel color={COLOR.orange}>Deep match</SectionLabel></div>
      <DeepMatchBreakdown
        match={intelMatch}
        onPlaceTap={undefined}
        variant="mobile"
      />
    </SafeMotionDiv>
  );
}
