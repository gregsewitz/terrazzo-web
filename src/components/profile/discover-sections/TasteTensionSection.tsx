import { TASTE_TENSION, type TasteTension } from '@/constants/discover';
import { TasteTensionCard } from '@/components/intelligence';
import type { TasteTension as IntelTasteTension } from '@/components/intelligence';

export function TasteTensionSection({ tension }: { tension?: TasteTension }) {
  const t = tension || TASTE_TENSION;
  const intelTension: IntelTasteTension = {
    title: t.title,
    stated: t.stated,
    revealed: t.revealed,
    editorial: t.editorial,
    resolvedBy: t.resolvedBy,
  };
  return (
    <div className="px-5 mb-10">
      <TasteTensionCard
        tension={intelTension}
        onPlaceTap={undefined}
        variant="mobile"
      />
    </div>
  );
}
