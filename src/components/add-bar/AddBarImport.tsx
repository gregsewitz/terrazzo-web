'use client';

import { FONT, INK } from '@/constants/theme';
import { SectionHeader } from './AddBarShared';

interface AddBarImportProps {
  importProgress: number;
  importLabel: string;
}

export default function AddBarImport({ importProgress, importLabel }: AddBarImportProps) {
  return (
    <div className="py-6">
      <SectionHeader label="Importing" />
      <div className="flex items-center gap-3 py-4">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36, height: 36,
            background: 'var(--t-linen)',
            position: 'relative',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--t-travertine)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="14" fill="none"
              stroke="var(--t-honey)" strokeWidth="3"
              strokeDasharray={`${(importProgress / 100) * 87.96} 87.96`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-ink)', position: 'relative', zIndex: 1 }}>
            {Math.round(importProgress)}%
          </span>
        </div>
        <div>
          <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
            Extracting places from link...
          </p>
          <p style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['60'], margin: '2px 0 0' }}>
            {importLabel || 'Working...'}
          </p>
        </div>
      </div>
    </div>
  );
}
