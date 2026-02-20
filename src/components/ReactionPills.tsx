'use client';

import { Reaction } from '@/stores/collaborationStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface ReactionPillsProps {
  reactions: Reaction[];
  /** Compact mode shows only counts, not names */
  compact?: boolean;
}

export default function ReactionPills({ reactions, compact = false }: ReactionPillsProps) {
  if (reactions.length === 0) return null;

  const loves = reactions.filter(r => r.reaction === 'love');
  const notForMe = reactions.filter(r => r.reaction === 'not_for_me');

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {loves.length > 0 && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px]"
          style={{
            background: 'rgba(239,68,68,0.06)',
            color: '#dc2626',
            fontFamily: FONT.mono,
          }}
          title={loves.map(r => r.user.name || r.user.email.split('@')[0]).join(', ')}
        >
          <PerriandIcon name="loveReaction" size={12} color="#dc2626" accent="#dc2626" />
          {compact ? (
            <span>{loves.length}</span>
          ) : (
            loves.map(r => r.user.name?.split(' ')[0] || r.user.email.split('@')[0]).join(', ')
          )}
        </span>
      )}
      {notForMe.length > 0 && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px]"
          style={{
            background: INK['05'],
            color: INK['60'],
            fontFamily: FONT.mono,
          }}
          title={notForMe.map(r => r.user.name || r.user.email.split('@')[0]).join(', ')}
        >
          <PerriandIcon name="unsure" size={12} color={INK['60']} accent={INK['60']} />
          {compact ? (
            <span>{notForMe.length}</span>
          ) : (
            notForMe.map(r => r.user.name?.split(' ')[0] || r.user.email.split('@')[0]).join(', ')
          )}
        </span>
      )}
    </div>
  );
}
