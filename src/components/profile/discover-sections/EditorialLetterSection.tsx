import { SafeMotionDiv, SafeMotionSpan, SafeMotionH2, SafeMotionP } from '@/components/animations/AnimatedElements';
import { EDITORIAL_LETTER, type EditorialLetter } from '@/constants/discover';
import { FONT } from '@/constants/theme';

export function EditorialLetterSection({ letter }: { letter?: EditorialLetter }) {
  const l = letter || EDITORIAL_LETTER;
  return (
    <SafeMotionDiv

      className="px-5 pt-5 pb-6 rounded-2xl"
      style={{ background: 'var(--t-dark-teal)' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <SafeMotionDiv
            className="w-5 h-[1px]"
            style={{ background: 'var(--t-light-yellow)' }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true, margin: '-100px' }}
          />
          <SafeMotionSpan
            className="text-[9px] uppercase tracking-[0.25em]"
            style={{ color: 'var(--t-light-yellow)', fontFamily: FONT.mono }}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true, margin: '-100px' }}
          >
            A note from Terrazzo
          </SafeMotionSpan>
        </div>
        <SafeMotionH2
          className="text-[20px] leading-snug mb-4"
          style={{ fontFamily: FONT.serif, color: '#ffffff' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          {l.headline}
        </SafeMotionH2>
        <SafeMotionP
          className="text-[13px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.8)', fontFamily: FONT.sans }}
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
        <span className="text-[9px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(235,216,150,0.2)', color: 'var(--t-light-yellow)', fontFamily: FONT.mono }}>
          Sparked by: {l.signalHighlight}
        </span>
      </SafeMotionDiv>
    </SafeMotionDiv>
  );
}
