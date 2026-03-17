import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import { DeepMatchBreakdown } from '@/components/intelligence';
import type { DeepMatch as IntelDeepMatch } from '@/components/intelligence';
import { DEEP_MATCH, type DeepMatch } from '@/constants/discover';
import type { TasteDomain } from '@/types';
import { SectionLabel } from './SectionLabel';

export function DeepMatchSection({ match }: { match?: DeepMatch }) {
  const m = match || DEEP_MATCH;
  const intelMatch: IntelDeepMatch = {
    name: m.name,
    location: m.location,
    score: m.score,
    headline: m.headline,
    signalBreakdown: m.signalBreakdown.map(s => ({
      signal: s.signal,
      domain: s.domain as TasteDomain,
      strength: s.strength,
      note: s.note,
    })),
    tensionResolved: m.tensionResolved,
    googlePlaceId: m.googlePlaceId,
  };
  return (
    <SafeMotionDiv
      className="px-5 py-6 mb-10 rounded-2xl"
      style={{ background: 'var(--t-dark-teal)' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mb-3"><SectionLabel color="var(--t-light-yellow)">Deep match</SectionLabel></div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff' }}>
        <DeepMatchBreakdown
          match={intelMatch}
          onPlaceTap={undefined}
          variant="mobile"
        />
      </div>
    </SafeMotionDiv>
  );
}
