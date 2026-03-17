import { FONT } from '@/constants/theme';

export function SectionLabel({ children, color = 'var(--t-coral)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.2em] font-bold"
      style={{ color, fontFamily: FONT.mono }}
    >
      {children}
    </div>
  );
}
