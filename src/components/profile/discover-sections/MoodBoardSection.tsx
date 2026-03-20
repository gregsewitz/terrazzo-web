import { SafeMotionDiv } from '@/components/animations/AnimatedElements';
import ScoreArc from '@/components/profile/ScoreArc';
import PlacePhoto from '@/components/place/PlacePhoto';
import PlaceLink from '@/components/place/PlaceLink';
import { MOOD_BOARDS, type MoodBoard } from '@/constants/discover';
import { getPlaceImage } from '@/constants/placeImages';
import { COLOR, FONT, INK } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function MoodBoardSection({ boards }: { boards?: MoodBoard[] }) {
  const displayBoards = boards || MOOD_BOARDS;
  return (
    <SafeMotionDiv
      className="px-5 py-6"
      style={{ borderBottom: `1px solid ${INK['06']}` }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <SectionLabel color={COLOR.olive}>Travel Moods</SectionLabel>
      <div className="flex flex-col gap-0">
        {displayBoards.map((board, idx) => (
          <SafeMotionDiv
            key={board.mood}
            className="py-3"
            style={{ borderBottom: `1px solid ${INK['04']}` }}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            viewport={{ once: true, margin: '-100px' }}
          >
            <h4 className="text-[14px] font-semibold mb-1" style={{ fontFamily: FONT.serif, color: COLOR.darkTeal }}>{board.mood}</h4>
            <p className="text-[11px] mb-4" style={{ color: COLOR.navy, fontFamily: FONT.sans }}>{board.description}</p>
            <div className="flex flex-col gap-2">
              {board.places.map((p, pIdx) => {
                const imageUrl = getPlaceImage(p.name);
                return (
                  <PlaceLink key={p.name} name={p.name} location={p.location} googlePlaceId={p.googlePlaceId}>
                    <SafeMotionDiv
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.1 + pIdx * 0.05 }}
                      viewport={{ once: true, margin: '-100px' }}
                    >
                      {imageUrl ? (
                        <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                          <PlacePhoto src={imageUrl} alt={p.name} fill sizes="40px" />
                        </div>
                      ) : (
                        <ScoreArc score={p.score} size={40} color={board.color} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] font-semibold" style={{ color: COLOR.darkTeal }}>{p.name}</span>
                          <span className="text-[10px]" style={{ color: COLOR.navy }}>{p.location}</span>
                        </div>
                        <p className="text-[10px] italic" style={{ color: COLOR.navy }}>{p.vibe}</p>
                      </div>
                      <span className="text-[10px] font-bold flex-shrink-0" style={{ color: board.color, fontFamily: FONT.mono }}>{Math.round(p.score)}</span>
                    </SafeMotionDiv>
                  </PlaceLink>
                );
              })}
            </div>
          </SafeMotionDiv>
        ))}
      </div>
    </SafeMotionDiv>
  );
}
