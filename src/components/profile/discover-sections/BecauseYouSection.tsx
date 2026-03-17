import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import ScoreArc from '@/components/profile/ScoreArc';
import PlaceLink from '@/components/place/PlaceLink';
import { BECAUSE_YOU_CARDS, type BecauseYouCard } from '@/constants/discover';
import { DIMENSION_COLORS } from '@/constants/profile';
import { COLOR, FONT } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function BecauseYouSection({ cards }: { cards?: BecauseYouCard[] }) {
  const displayCards = cards || BECAUSE_YOU_CARDS;
  return (
    <SafeMotionDiv

      className="mt-4 mb-10 px-5"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mb-3">
        <SectionLabel color={COLOR.coral}>Because you...</SectionLabel>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {displayCards.map((card, idx) => {
          const domainColor = DIMENSION_COLORS[card.signalDomain] || '#413800';
          return (
            <PlaceLink key={card.place} name={card.place} location={card.location} googlePlaceId={card.googlePlaceId}>
              <SafeMotionDiv
                className="flex-shrink-0 p-5 rounded-2xl flex flex-col justify-between"
                style={{ background: 'linear-gradient(145deg, rgba(238,113,109,0.06) 0%, rgba(238,113,109,0.12) 100%)', border: '1px solid var(--t-coral)', width: 280, minHeight: 230, scrollSnapAlign: 'start' }}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true, margin: '-100px' }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <PerriandIcon name="sparkle" size={12} color={domainColor} />
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${domainColor}18`, color: domainColor, fontFamily: FONT.mono }}>
                      {card.signalDomain}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed mb-1" style={{ color: COLOR.navy, fontFamily: FONT.sans }}>
                    Because you love
                  </p>
                  <p className="text-[16px] font-semibold mb-4 italic" style={{ color: COLOR.darkTeal, fontFamily: FONT.serif }}>
                    &ldquo;{card.signal}&rdquo;
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <ScoreArc score={card.score} size={34} color="var(--t-coral)" />
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: COLOR.darkTeal }}>{card.place}</div>
                      <div className="text-[11px]" style={{ color: COLOR.navy }}>{card.location}</div>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: COLOR.navy }}>{card.why}</p>
                </div>
              </SafeMotionDiv>
            </PlaceLink>
          );
        })}
      </div>
    </SafeMotionDiv>
  );
}
