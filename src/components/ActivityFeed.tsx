'use client';

import { useState } from 'react';
import type { Activity } from '@/stores/collaborationStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import type { PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// ─── Activity type → PerriandIcon + color mapping ───
const ACTIVITY_CONFIG: Record<string, { icon: PerriandIconName; color: string; accent: string; bg: string }> = {
  collaborator_invited: { icon: 'invite',        color: '#6366f1', accent: '#6366f1', bg: 'rgba(99,102,241,0.06)' },
  collaborator_joined:  { icon: 'wave',          color: '#2a7a56', accent: '#2a7a56', bg: 'rgba(42,122,86,0.06)' },
  suggestion_added:     { icon: 'lightbulb',     color: '#c8923a', accent: '#eeb420', bg: 'rgba(200,146,58,0.06)' },
  suggestion_accepted:  { icon: 'acceptCircle',  color: '#2a7a56', accent: '#2a7a56', bg: 'rgba(42,122,86,0.06)' },
  suggestion_rejected:  { icon: 'rejectCircle',  color: '#d63020', accent: '#d63020', bg: 'rgba(214,48,32,0.06)' },
  reaction_added:       { icon: 'loveReaction',  color: '#e87080', accent: '#e87080', bg: 'rgba(232,112,128,0.06)' },
  note_added:           { icon: 'chatBubble',    color: '#8b5cf6', accent: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
  place_moved:          { icon: 'swap',          color: '#6366f1', accent: '#6366f1', bg: 'rgba(99,102,241,0.06)' },
};

const FALLBACK_CONFIG = { icon: 'sparkle' as PerriandIconName, color: INK['60'], accent: INK['60'], bg: INK['05'] };

type FilterType = 'all' | 'suggestions' | 'reactions' | 'notes';

interface ActivityFeedProps {
  activities: Activity[];
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function matchesFilter(type: string, filter: FilterType): boolean {
  if (filter === 'all') return true;
  if (filter === 'suggestions') return type.startsWith('suggestion_');
  if (filter === 'reactions') return type === 'reaction_added';
  if (filter === 'notes') return type === 'note_added';
  return true;
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = activities.filter(a => matchesFilter(a.type, filter));

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'reactions', label: 'Reactions' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="px-4 py-3" style={{ background: 'var(--t-cream)' }}>
      {/* Filter chips */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all"
            style={{
              background: filter === f.key ? 'var(--t-ink)' : 'white',
              color: filter === f.key ? 'white' : INK['70'],
              border: filter === f.key ? 'none' : `1px solid ${INK['15']}`,
              cursor: 'pointer',
              fontFamily: FONT.sans,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-12"
          style={{ color: INK['50'], fontFamily: FONT.sans, fontSize: 13 }}
        >
          {filter === 'all'
            ? 'No activity yet. Invite collaborators to get started!'
            : `No ${filter} yet.`}
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: 15,
              width: 1,
              background: INK['10'],
            }}
          />

          {filtered.map((activity, idx) => {
            const config = ACTIVITY_CONFIG[activity.type] || FALLBACK_CONFIG;

            // Group header for date changes
            const prevDate = idx > 0
              ? new Date(filtered[idx - 1].createdAt).toDateString()
              : null;
            const thisDate = new Date(activity.createdAt).toDateString();
            const showDateHeader = idx === 0 || thisDate !== prevDate;
            const isToday = thisDate === new Date().toDateString();
            const isYesterday =
              thisDate === new Date(Date.now() - 86400000).toDateString();

            return (
              <div key={activity.id}>
                {showDateHeader && (
                  <div
                    className="pl-9 pb-1.5 pt-2"
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      fontWeight: 600,
                      color: INK['50'],
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {isToday
                      ? 'Today'
                      : isYesterday
                        ? 'Yesterday'
                        : new Date(activity.createdAt).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                  </div>
                )}

                <div className="relative flex items-start gap-3 pb-3 pl-0">
                  {/* Timeline dot with PerriandIcon */}
                  <div
                    className="relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center"
                    style={{ background: config.bg }}
                  >
                    <PerriandIcon
                      name={config.icon}
                      size={16}
                      color={config.color}
                      accent={config.accent}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div
                      className="text-[12px] leading-relaxed"
                      style={{
                        color: INK['80'],
                        fontFamily: FONT.sans,
                      }}
                    >
                      {activity.summary}
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{
                        color: INK['40'],
                        fontFamily: FONT.mono,
                      }}
                    >
                      {getTimeAgo(activity.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
