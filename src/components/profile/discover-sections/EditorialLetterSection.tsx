import { SafeMotionDiv, SafeMotionSpan, SafeMotionH2, SafeMotionP } from '@/components/animations/AnimatedElements';
import { EDITORIAL_LETTER, type EditorialLetter } from '@/constants/discover';
import { COLOR, FONT, INK } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function EditorialLetterSection({ letter }: { letter?: EditorialLetter }) {
  const l = letter || EDITORIAL_LETTER;
  return (
    <SafeMotionDiv
      className="px-5 py-6"
      style={{ borderBottom: `1px solid ${INK['06']}` }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <SectionLabel color={COLOR.navy}>A note from Terrazzo</SectionLabel>
      <div className="mb-4">
        <SafeMotionH2
          className="text-[24px] leading-snug mb-4"
          style={{ fontFamily: FONT.serif, color: COLOR.navy }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          {l.headline}
        </SafeMotionH2>
        <SafeMotionP
          className="text-[15px] leading-relaxed"
          style={{ color: COLOR.navy, fontFamily: FONT.sans }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          {l.body}
        </SafeMotionP>
      </div>
      <SafeMotionDiv
        className="flex items-center gap-2"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: `${COLOR.navy}10`, color: COLOR.navy, fontFamily: FONT.mono }}>
          Sparked by: {l.signalHighlight}
        </span>
      </SafeMotionDiv>
    </SafeMotionDiv>
  );
}
