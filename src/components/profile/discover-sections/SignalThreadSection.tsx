import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import PlaceLink from '@/components/PlaceLink';
import { SIGNAL_THREAD, type SignalThread } from '@/constants/discover';
import { DIMENSION_COLORS } from '@/constants/profile';
import { COLOR, FONT, INK } from '@/constants/theme';
import type { PerriandIconName } from '@/types';
import { SectionLabel } from './SectionLabel';

const TYPE_ICONS: Record<string, string> = { hotel: 'hotel', restaurant: 'restaurant', bar: 'bar', cafe: 'cafe', neighborhood: 'neighborhood' };

export function SignalThreadSection({ thread }: { thread?: SignalThread }) {
  const t = thread || SIGNAL_THREAD;
  const domainColor = DIMENSION_COLORS[t.domain] || '#413800';

  return (
    <SafeMotionDiv
      className="px-5 py-6 mb-10 rounded-2xl"
      style={{ background: 'var(--t-dark-teal)' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <SectionLabel color="var(--t-light-yellow)">The thread</SectionLabel>
      <SafeMotionDiv
        className="mt-3 p-5 rounded-2xl"
        style={{ background: '#ffffff', border: 'none' }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{ background: `${COLOR.ochre}12`, color: COLOR.ochre, fontFamily: FONT.mono }}>
            {t.signal}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: COLOR.navy, fontFamily: FONT.sans }}>
          {t.thread}
        </p>
        {/* Vertical thread line connecting places */}
        <div className="flex flex-col gap-0">
          {t.places.map((place, i) => (
            <PlaceLink key={place.name} name={place.name} location={place.location} googlePlaceId={place.googlePlaceId}>
              <SafeMotionDiv
                className="flex gap-3"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                viewport={{ once: true, margin: '-100px' }}
              >
                {/* Thread line */}
                <div className="flex flex-col items-center" style={{ width: 20 }}>
                  <SafeMotionDiv
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: domainColor, marginTop: 4 }}
                    initial={{ scale: 0.95 }}
                    whileInView={{ scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                    viewport={{ once: true, margin: '-100px' }}
                  />
                  {i < t.places.length - 1 && (
                    <SafeMotionDiv
                      className="w-[1px] flex-1"
                      style={{ background: INK['10'] }}
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                      viewport={{ once: true, margin: '-100px' }}
                    />
                  )}
                </div>
                {/* Place card */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <PerriandIcon name={(TYPE_ICONS[place.type] || 'discover') as PerriandIconName} size={12} color={COLOR.darkTeal} />
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: COLOR.darkTeal, fontFamily: FONT.mono }}>{place.type}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: COLOR.ochre }}>{place.name}</span>
                    <span className="text-[10px]" style={{ color: COLOR.navy }}>{place.location}</span>
                    <span className="text-[10px] font-bold ml-auto" style={{ color: COLOR.ochre, fontFamily: FONT.mono }}>{Math.round(place.score)}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: COLOR.navy }}>{place.connection}</p>
                </div>
              </SafeMotionDiv>
            </PlaceLink>
          ))}
        </div>
      </SafeMotionDiv>
    </SafeMotionDiv>
  );
}
