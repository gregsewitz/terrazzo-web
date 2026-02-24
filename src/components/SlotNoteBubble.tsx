'use client';

import { useState } from 'react';
import { SlotNoteItem } from '@/stores/collaborationStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface SlotNoteBubbleProps {
  notes: SlotNoteItem[];
  onAddNote?: (content: string) => void;
  canAdd?: boolean;
}

export default function SlotNoteBubble({ notes, onAddNote, canAdd = false }: SlotNoteBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const [newNote, setNewNote] = useState('');

  if (notes.length === 0 && !canAdd) return null;

  const handleSubmit = () => {
    if (!newNote.trim() || !onAddNote) return;
    onAddNote(newNote.trim());
    setNewNote('');
  };

  // Collapsed: just show count badge
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-all"
        style={{
          background: notes.length > 0 ? 'rgba(200,146,58,0.08)' : INK['05'],
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT.mono,
          fontSize: 9,
          color: notes.length > 0 ? '#8a6a2a' : INK['60'],
        }}
      >
        <PerriandIcon name="chatBubble" size={11} color={notes.length > 0 ? '#8a6a2a' : INK['60']} accent={notes.length > 0 ? '#c8923a' : INK['60']} />
        {notes.length > 0 ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Add note'}
      </button>
    );
  }

  // Expanded: show all notes + add input
  return (
    <div
      className="rounded-lg overflow-hidden mt-1"
      style={{
        background: 'var(--t-cream)',
        border: '1px solid var(--t-linen)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ borderBottom: notes.length > 0 ? '1px solid var(--t-linen)' : 'none' }}
      >
        <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['60'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Notes
        </span>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: INK['50'] }}
        >
          &times;
        </button>
      </div>

      {/* Notes list */}
      {notes.map(note => {
        const name = note.user.name?.split(' ')[0] || note.user.email.split('@')[0];
        const timeAgo = getTimeAgo(note.createdAt);
        return (
          <div
            key={note.id}
            className="flex gap-2 px-2.5 py-2"
            style={{ borderBottom: '1px solid var(--t-linen)' }}
          >
            <div
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold mt-0.5"
              style={{ background: INK['08'], color: INK['60'] }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, color: 'var(--t-ink)' }}>
                  {name}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['60'] }}>
                  {timeAgo}
                </span>
              </div>
              <div style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['80'], marginTop: 1, lineHeight: 1.4 }}>
                {note.content}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add note input */}
      {canAdd && onAddNote && (
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Add a note..."
            className="flex-1 text-[11px] px-2 py-1.5 rounded-md"
            style={{
              background: 'white',
              border: '1px solid var(--t-linen)',
              outline: 'none',
              fontFamily: FONT.sans,
              color: 'var(--t-ink)',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newNote.trim()}
            className="px-2.5 py-1.5 rounded-md text-[10px] font-semibold"
            style={{
              background: newNote.trim() ? 'var(--t-ink)' : INK['10'],
              color: newNote.trim() ? 'white' : INK['50'],
              border: 'none',
              cursor: newNote.trim() ? 'pointer' : 'default',
              fontFamily: FONT.sans,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}
