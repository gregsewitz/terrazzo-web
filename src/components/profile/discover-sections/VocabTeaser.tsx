import { SafeMotionDiv, SafeMotionSpan } from '@/components/animations/AnimatedElements';
import { TASTE_PROFILE, DIMENSION_COLORS } from '@/constants/profile';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { SectionLabel } from './SectionLabel';

export function VocabTeaser({ profile }: { profile: typeof TASTE_PROFILE }) {
  const domains = Object.entries(profile.microTasteSignals).slice(0, 4);
  const allTerms: Array<{ term: string; domain: string }> = [];
  domains.forEach(([domain, terms]) => { terms.slice(0, 2).forEach(term => allTerms.push({ term, domain })); });
  const rejections = profile.microTasteSignals['Rejection']?.slice(0, 2) || [];
  rejections.forEach(term => allTerms.push({ term, domain: 'Rejection' }));

  return (
    <SafeMotionDiv
      className="px-5 py-6"
      style={{ borderBottom: `1px solid ${INK['06']}` }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      <SectionLabel color={COLOR.olive}>Your taste vocabulary</SectionLabel>
      <SafeMotionDiv
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {allTerms.map(({ term, domain }, idx) => {
            const color = DIMENSION_COLORS[domain] || '#413800';
            const isRejection = domain === 'Rejection';
            const randomDelay = Math.random() * 0.3;
            return (
              <SafeMotionSpan
                key={term}
                className="text-[14px] px-2.5 py-1 rounded-full"
                style={{ background: isRejection ? 'rgba(200,100,100,0.08)' : `${color}12`, color: isRejection ? 'rgba(200,100,100,0.8)' : color, fontFamily: FONT.sans }}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: randomDelay }}
                viewport={{ once: true, margin: '-100px' }}
              >
                {term}
              </SafeMotionSpan>
            );
          })}
          <SafeMotionSpan
            className="text-[14px] px-2.5 py-1 rounded-full"
            style={{ background: INK['04'], color: TEXT.secondary }}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            viewport={{ once: true, margin: '-100px' }}
          >
            +{Object.values(profile.microTasteSignals).flat().length - allTerms.length} more
          </SafeMotionSpan>
        </div>
      </SafeMotionDiv>
    </SafeMotionDiv>
  );
}
