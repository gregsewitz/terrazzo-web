'use client';

import { Suggestion } from '@/stores/collaborationStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';

// Stable color palette for collaborator accents
const COLLAB_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
];

function getCollaboratorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

interface CollaboratorGhostCardProps {
  suggestion: Suggestion;
  isOwner: boolean;
  onAccept: () => void;
  onReject: () => void;
  onTapDetail?: () => void;
}

export default function CollaboratorGhostCard({
  suggestion,
  isOwner,
  onAccept,
  onReject,
  onTapDetail,
}: CollaboratorGhostCardProps) {
  const isDesktop = useIsDesktop();
  const color = getCollaboratorColor(suggestion.userId);
  const userName = suggestion.user.name || suggestion.user.email.split('@')[0];

  return (
    <div
      className="relative cursor-pointer transition-all rounded-lg"
      style={{
        background: 'var(--t-cream)',
        border: `1.5px dashed ${color}`,
        padding: isDesktop ? '8px 10px' : '8px 10px',
        borderLeft: `3px solid ${color}`,
      }}
      onClick={onTapDetail}
    >
      {/* Top row: avatar + place name + action buttons inline */}
      <div className="flex items-center gap-2">
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
          style={{
            width: 28,
            height: 28,
            background: `${color}18`,
            color,
            fontSize: 11,
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="font-medium block truncate"
            style={{ color: 'var(--t-ink)', fontSize: isDesktop ? 12 : 11 }}
          >
            {suggestion.placeName}
          </span>
          {suggestion.placeType && (
            <span
              className="block truncate"
              style={{ fontFamily: FONT.mono, fontSize: 8, color: INK['50'], marginTop: 1 }}
            >
              {suggestion.placeType}
            </span>
          )}
        </div>
        {/* Action buttons or status — inline right */}
        {isOwner && suggestion.status === 'pending' ? (
          <div className="flex gap-1 flex-shrink-0 items-center">
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              className="px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-0.5 btn-hover"
              style={{
                background: 'var(--t-verde)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10,
              }}
            >
              <PerriandIcon name="check" size={10} color="white" /> Add
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all nav-hover"
              style={{
                background: INK['06'],
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <PerriandIcon name="close" size={10} color={INK['85']} />
            </button>
          </div>
        ) : suggestion.status !== 'pending' ? (
          <span
            className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: suggestion.status === 'accepted' ? 'rgba(42,122,86,0.08)' : 'rgba(200,50,50,0.06)',
              color: suggestion.status === 'accepted' ? 'var(--t-verde)' : INK['60'],
              fontFamily: FONT.mono,
              fontSize: 8,
            }}
          >
            {suggestion.status === 'accepted' ? 'Added' : 'Dismissed'}
          </span>
        ) : null}
      </div>

      {/* Collaborator badge + reason */}
      <div className="flex items-center gap-1.5 mt-1">
        <span
          className="font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"
          style={{ background: `${color}12`, color, fontSize: 8 }}
        >
          {userName}
        </span>
        {suggestion.reason && (
          <span
            className="italic truncate"
            style={{ color: INK['50'], fontSize: 9 }}
          >
            &ldquo;{suggestion.reason}&rdquo;
          </span>
        )}
      </div>
    </div>
  );
}
