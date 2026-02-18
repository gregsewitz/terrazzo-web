'use client';

import { TasteDomain, TasteProfile, DOMAIN_COLORS, DOMAIN_ICONS } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

const DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

interface TasteAxesProps {
  profile: TasteProfile;
  size?: 'sm' | 'md' | 'lg';
}

export default function TasteAxes({ profile, size = 'md' }: TasteAxesProps) {
  const barHeight = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const fontSize = size === 'sm' ? 9 : size === 'md' ? 10 : 11;

  return (
    <div className="flex flex-col gap-1.5">
      {DOMAINS.map(domain => (
        <div key={domain} className="flex items-center gap-2">
          <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PerriandIcon name={DOMAIN_ICONS[domain]} size={fontSize + 2} color={DOMAIN_COLORS[domain]} />
          </div>
          <span
            style={{
              fontSize,
              width: size === 'sm' ? 52 : 64,
              color: 'var(--t-ink)',
              fontFamily: "'Space Mono', monospace",
              fontWeight: 500,
            }}
          >
            {domain}
          </span>
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: barHeight, background: 'rgba(28,26,23,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(profile[domain] ?? 0) * 100}%`,
                background: DOMAIN_COLORS[domain],
              }}
            />
          </div>
          <span
            style={{
              fontSize: fontSize - 1,
              width: 24,
              textAlign: 'right',
              color: 'rgba(28,26,23,0.9)',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {Math.round((profile[domain] ?? 0) * 100)}
          </span>
        </div>
      ))}
    </div>
  );
}
