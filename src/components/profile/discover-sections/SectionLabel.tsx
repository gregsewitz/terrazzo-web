import { COLOR, FONT } from '@/constants/theme';

export function SectionLabel({ children, color = COLOR.coral, dotColor }: { children: React.ReactNode; color?: string; dotColor?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1"
      style={{
        background: `${color}14`,
        color,
        fontFamily: FONT.display,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '1px',
        textTransform: 'uppercase' as const,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor || color, flexShrink: 0 }} />
      {children}
    </div>
  );
}
