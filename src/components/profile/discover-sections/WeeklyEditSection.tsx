import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import ScoreArc from '@/components/profile/ScoreArc';
import PlacePhoto from '@/components/place/PlacePhoto';
import PlaceLink from '@/components/place/PlaceLink';
import { WEEKLY_COLLECTION, type CollectionPlace } from '@/constants/discover';
import { getPlaceImage } from '@/constants/placeImages';
import { DIMENSION_COLORS } from '@/constants/profile';
import { COLOR, FONT, INK } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function WeeklyEditSection({ collection: propCollection }: { collection?: { title: string; subtitle: string; places: CollectionPlace[] } }) {
  const collection = propCollection || WEEKLY_COLLECTION;
  return (
    <SafeMotionDiv
      className="px-5 py-6"
      style={{ borderBottom: `1px solid ${INK['06']}` }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mb-1"><SectionLabel color={COLOR.darkTeal}>This week&apos;s edit</SectionLabel></div>
      <div className="mb-3">
        <h3 className="text-[22px] leading-snug mb-1" style={{ fontFamily: FONT.serif, color: COLOR.navy }}>{collection.title}</h3>
        <p className="text-[13px]" style={{ color: COLOR.navy, fontFamily: FONT.mono }}>{collection.subtitle}</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5" style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
        {collection.places.map((place, idx) => {
          const domainColor = DIMENSION_COLORS[place.signalDomain] || '#413800';
          const imageUrl = getPlaceImage(place.name);
          return (
            <PlaceLink key={place.name} name={place.name} location={place.location} googlePlaceId={place.googlePlaceId}>
              <SafeMotionDiv
                className="flex-shrink-0 rounded-xl flex flex-col overflow-hidden"
                style={{ background: 'white', border: '1px solid var(--t-linen)', width: 240, scrollSnapAlign: 'start' }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true, margin: '-100px' }}
              >
                {imageUrl && (
                  <div style={{ height: 100, overflow: 'hidden', position: 'relative' }}>
                    <PlacePhoto src={imageUrl} alt={place.name} fill sizes="240px" />
                  </div>
                )}
                <div className="p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[16px] font-semibold" style={{ color: COLOR.darkTeal }}>{place.name}</div>
                      <div className="text-[13px]" style={{ color: COLOR.navy }}>{place.location}</div>
                    </div>
                    <ScoreArc score={place.score} size={38} color={COLOR.darkTeal} />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {(Array.isArray(place.signals) ? place.signals : []).map(s => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${COLOR.darkTeal}12`, color: COLOR.darkTeal, fontFamily: FONT.sans }}>{s}</span>
                    ))}
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: COLOR.navy }}>{place.note}</p>
                </div>
              </SafeMotionDiv>
            </PlaceLink>
          );
        })}
      </div>
    </SafeMotionDiv>
  );
}
