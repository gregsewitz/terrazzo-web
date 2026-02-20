'use client';

import { Suggestion } from '@/stores/collaborationStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

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
  const color = getCollaboratorColor(suggestion.userId);
  const userName = suggestion.user.name || suggestion.user.email.split('@')[0];

  return (
    <div
      className="relative cursor-pointer transition-all rounded-lg flex items-center gap-2"
      style={{
        background: 'var(--t-cream)',
        border: `1.5px dashed ${color}`,
        padding: '8px 10px',
        borderLeft: `3px solid ${color}`,
      }}
      onClick={onTapDetail}
    >
      {/* Left: collaborator avatar circle */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
        style={{ background: `${color}18`, color }}
      >
        {userName.charAt(0).toUpperCase()}
      </div>

      {/* Middle: name + place + reason */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[12px] font-medium truncate"
            style={{ color: 'var(--t-ink)' }}
          >
            {suggestion.placeName}
          </span>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: `${color}12`, color }}
          >
            {userName}
          </span>
        </div>
        {suggestion.reason && (
          <div
            className="text-[10px] italic truncate mt-0.5"
            style={{ color: INK['85'] }}
          >
            &ldquo;{suggestion.reason}&rdquo;
          </div>
        )}
      </div>

      {/* Right: owner actions or status */}
      {isOwner && suggestion.status === 'pending' ? (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1"
            style={{
              background: 'var(--t-verde)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.sans,
            }}
          >
            <PerriandIcon name="check" size={12} color="white" /> Add
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{
              background: INK['06'],
              color: INK['85'],
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <PerriandIcon name="close" size={12} color={INK['85']} />
          </button>
        </div>
      ) : suggestion.status !== 'pending' ? (
        <span
          className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: suggestion.status === 'accepted' ? 'rgba(42,122,86,0.08)' : 'rgba(200,50,50,0.06)',
            color: suggestion.status === 'accepted' ? 'var(--t-verde)' : INK['60'],
            fontFamily: FONT.mono,
          }}
        >
          {suggestion.status === 'accepted' ? 'Added' : 'Dismissed'}
        </span>
      ) : null}
    </div>
  );
}
