'use client';

import { FONT, INK } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import PlacePhoto from '@/components/PlacePhoto';
import type { ImportedPlace } from '@/types';

// ─── Type badge color ───────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
  restaurant: 'var(--t-honey)',
  hotel: 'var(--t-verde)',
  bar: '#C87B6B',
  cafe: '#B8956A',
  museum: '#8B7EC8',
  activity: '#6BA5C8',
  shop: '#C8A56B',
  neighborhood: '#7EC88B',
};

// ─── Library search helpers ──────────────────────────────────────────────────

export function searchLibrary(places: ImportedPlace[], query: string): ImportedPlace[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return places
    .filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      p.type.toLowerCase().includes(q)
    )
    .slice(0, 8);
}

export function searchLibraryByDestination(places: ImportedPlace[], destination: string): ImportedPlace[] {
  if (!destination) return [];
  const d = destination.toLowerCase();
  return places.filter(p => p.location && p.location.toLowerCase().includes(d)).slice(0, 12);
}

export function getRecentSaves(places: ImportedPlace[]): ImportedPlace[] {
  return [...places]
    .sort((a, b) => {
      const da = a.savedDate ? new Date(a.savedDate).getTime() : 0;
      const db = b.savedDate ? new Date(b.savedDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 5);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className="pt-4 pb-1.5"
      style={{
        fontFamily: FONT.mono,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: INK['40'],
        margin: 0,
      }}
    >
      {label}
    </p>
  );
}

export function PlaceRow({
  place,
  inLibrary,
  matchScore,
  collections,
  onTap,
  action,
  compact,
}: {
  place: ImportedPlace;
  inLibrary?: boolean;
  matchScore?: number;
  collections?: Array<{ name: string }>;
  onTap: () => void;
  action?: 'save';
  compact?: boolean;
}) {
  const typeColor = TYPE_COLORS[place.type] || INK['40'];

  return (
    <button
      onClick={onTap}
      className="flex items-center gap-3 w-full px-3 rounded-xl cursor-pointer transition-all text-left"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
        padding: compact ? '8px 12px' : '10px 12px',
        marginTop: 4,
      }}
    >
      {/* Type dot */}
      <div
        className="rounded-full flex-shrink-0"
        style={{ width: 8, height: 8, background: typeColor }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{
          fontFamily: FONT.sans,
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          color: 'var(--t-ink)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {inLibrary && <span style={{ color: 'var(--t-verde)', marginRight: 4, fontSize: 11 }}>&#10003;</span>}
          {place.name}
        </p>
        <p style={{
          fontFamily: FONT.mono,
          fontSize: 9,
          color: INK['50'],
          margin: '1px 0 0',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {place.type}
          {place.location ? ` \u00B7 ${place.location}` : ''}
          {(matchScore ?? place.matchScore) ? ` \u00B7 ${matchScore ?? place.matchScore}%` : ''}
        </p>
        {collections && collections.length > 0 && (
          <p style={{
            fontFamily: FONT.sans,
            fontSize: 10,
            color: INK['40'],
            margin: '2px 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            in: {collections.map(c => c.name).join(', ')}
          </p>
        )}
      </div>

      {/* Action */}
      {action === 'save' ? (
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 28, height: 28, background: INK['06'] }}
        >
          <PerriandIcon name="add" size={14} color="var(--t-verde)" />
        </div>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
