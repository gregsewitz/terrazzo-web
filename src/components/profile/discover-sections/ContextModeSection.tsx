import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import ScoreArc from '@/components/profile/ScoreArc';
import PlacePhoto from '@/components/place/PlacePhoto';
import PlaceLink from '@/components/place/PlaceLink';
import { SUMMER_RECS, type ContextRec } from '@/constants/discover';
import { getPlaceImage } from '@/constants/placeImages';
import { COLOR, FONT, INK } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function ContextModeSection({ recs, contextLabel }: { recs?: ContextRec[]; contextLabel?: string }) {
  const displayRecs = recs || SUMMER_RECS;
  const label = contextLabel || 'Summer';
  return (
    <SafeMotionDiv
      className="px-5 py-6"
      style={{ borderBottom: `1px solid ${INK['06']}` }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <SectionLabel color={COLOR.warmGray}>Context mode</SectionLabel>
      <SafeMotionDiv
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true, margin: '-100px' }}
      >
      <div className="flex items-center gap-2 mb-1">
        <PerriandIcon name="summer" size={16} color="var(--t-ink)" />
        <span className="text-[18px] font-semibold" style={{ fontFamily: FONT.serif, color: COLOR.darkTeal }}>
          If you&apos;re traveling this {label.toLowerCase()}...
        </span>
      </div>
      <p className="text-[15px] mb-4" style={{ color: COLOR.navy, fontFamily: FONT.mono }}>
        {displayRecs.length > 0
          ? displayRecs.slice(0, 3).map(r => r.name).join(' · ')
          : 'Curated for your moment'}
      </p>
      <div className="flex flex-col gap-2.5">
          {displayRecs.map((rec, idx) => {
            const imageUrl = getPlaceImage(rec.name);
            return (
              <PlaceLink key={rec.name} name={rec.name} location={rec.location} googlePlaceId={rec.googlePlaceId}>
                <SafeMotionDiv
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + idx * 0.05 }}
                  viewport={{ once: true, margin: '-100px' }}
                >
                  {imageUrl ? (
                    <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                      <PlacePhoto src={imageUrl} alt={rec.name} fill sizes="36px" />
                    </div>
                  ) : (
                    <ScoreArc matchTier={rec.matchTier} size={36} color={COLOR.periwinkle} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[16px] font-semibold" style={{ color: COLOR.periwinkle }}>{rec.name}</span>
                      <span className="text-[14px]" style={{ color: COLOR.navy }}>{rec.location}</span>
                    </div>
                    <p className="text-[14px] leading-snug" style={{ color: COLOR.navy }}>{rec.whyFits}</p>
                  </div>
                </SafeMotionDiv>
              </PlaceLink>
            );
          })}
      </div>
      </SafeMotionDiv>
    </SafeMotionDiv>
  );
}
