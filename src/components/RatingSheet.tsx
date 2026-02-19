'use client';

import { useState } from 'react';
import {
  ImportedPlace,
  PlaceRating,
  ReactionId,
  ReturnIntent,
  REACTIONS,
  STANDOUT_TAGS,
  CONTEXT_TAGS,
} from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface RatingSheetProps {
  item: ImportedPlace;
  onClose: () => void;
  onSave: (rating: PlaceRating) => void;
  initialStep?: RatingStep;
}

type RatingStep = 'gut' | 'details' | 'note';

export default function RatingSheet({ item, onClose, onSave, initialStep }: RatingSheetProps) {
  const [step, setStep] = useState<RatingStep>(initialStep || 'gut');
  const [reaction, setReaction] = useState<ReactionId | null>(item.rating?.reaction || null);
  const [selectedTags, setSelectedTags] = useState<string[]>(item.rating?.tags || []);
  const [contextTags, setContextTags] = useState<string[]>(item.rating?.contextTags || []);
  const [returnIntent, setReturnIntent] = useState<ReturnIntent | null>(item.rating?.returnIntent || null);
  const [personalNote, setPersonalNote] = useState(item.rating?.personalNote || '');

  const standoutOptions = STANDOUT_TAGS[item.type] || STANDOUT_TAGS.restaurant;
  const selectedReaction = REACTIONS.find(r => r.id === reaction);

  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  };

  const handleGutReaction = (id: ReactionId) => {
    setReaction(id);
    // Auto-advance to details after a moment
    setTimeout(() => setStep('details'), 300);
  };

  const handleSave = () => {
    if (!reaction) return;
    onSave({
      reaction,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      contextTags: contextTags.length > 0 ? contextTags : undefined,
      returnIntent: returnIntent || undefined,
      personalNote: personalNote.trim() || undefined,
      ratedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] overflow-y-auto rounded-t-2xl"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '90vh',
          background: 'var(--t-cream)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-4 pb-8">
          {/* Place context header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 min-w-0">
              <h2
                className="text-lg truncate"
                style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}
              >
                {item.name}
              </h2>
              <p className="text-[11px]" style={{ color: INK['95'] }}>
                {item.location}
              </p>
            </div>
            {selectedReaction && step !== 'gut' && (
              <button
                onClick={() => setStep('gut')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-none cursor-pointer"
                style={{
                  background: `${selectedReaction.color}15`,
                  color: selectedReaction.color,
                  fontFamily: FONT.mono,
                  fontSize: '12px',
                }}
              >
                <PerriandIcon name={selectedReaction.icon} size={16} color={selectedReaction.color} />
                {selectedReaction.label}
              </button>
            )}
          </div>

          {/* Step 1: Gut Reaction */}
          {step === 'gut' && (
            <div className="flex flex-col items-center gap-6">
              <h3
                className="text-sm font-medium"
                style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
              >
                How did it feel?
              </h3>

              <div className="flex gap-3 w-full justify-center">
                {REACTIONS.map(r => {
                  const isSelected = reaction === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleGutReaction(r.id as ReactionId)}
                      className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border-2 cursor-pointer transition-all"
                      style={{
                        background: isSelected ? `${r.color}12` : 'white',
                        borderColor: isSelected ? r.color : 'var(--t-linen)',
                        minWidth: 72,
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <PerriandIcon name={r.icon} size={28} color={r.color} />
                      <span
                        className="text-[10px] font-medium whitespace-nowrap"
                        style={{
                          color: isSelected ? r.color : INK['90'],
                          fontFamily: FONT.mono,
                        }}
                      >
                        {r.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Details (tags + return intent) */}
          {step === 'details' && selectedReaction && (
            <div className="flex flex-col gap-6">
              {/* What stood out? */}
              <div>
                <h3
                  className="text-[10px] uppercase tracking-wider font-bold mb-3"
                  style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}
                >
                  What stood out?
                </h3>
                <div className="flex flex-wrap gap-2">
                  {standoutOptions.map(tag => {
                    const isActive = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag, selectedTags, setSelectedTags)}
                        className="px-3 py-1.5 rounded-full border cursor-pointer transition-all text-[11px]"
                        style={{
                          background: isActive ? `${selectedReaction.color}12` : 'white',
                          borderColor: isActive ? selectedReaction.color : 'var(--t-linen)',
                          color: isActive ? selectedReaction.color : INK['90'],
                          fontFamily: FONT.sans,
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Perfect for... */}
              <div>
                <h3
                  className="text-[10px] uppercase tracking-wider font-bold mb-3"
                  style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}
                >
                  Perfect for...
                </h3>
                <div className="flex flex-wrap gap-2">
                  {CONTEXT_TAGS.map(tag => {
                    const isActive = contextTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag, contextTags, setContextTags)}
                        className="px-3 py-1.5 rounded-full border cursor-pointer transition-all text-[11px]"
                        style={{
                          background: isActive ? 'var(--t-ink)' : 'white',
                          borderColor: isActive ? 'var(--t-ink)' : 'var(--t-linen)',
                          color: isActive ? 'var(--t-cream)' : INK['90'],
                          fontFamily: FONT.sans,
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Would you return? */}
              <div>
                <h3
                  className="text-[10px] uppercase tracking-wider font-bold mb-3"
                  style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}
                >
                  Would you return?
                </h3>
                <div className="flex gap-2">
                  {([
                    { id: 'absolutely', label: 'Absolutely' },
                    { id: 'maybe', label: 'Maybe' },
                    { id: 'probably_not', label: 'Probably not' },
                  ] as { id: ReturnIntent; label: string }[]).map(opt => {
                    const isActive = returnIntent === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setReturnIntent(opt.id)}
                        className="flex-1 py-2.5 rounded-lg border cursor-pointer transition-all text-[12px] font-medium"
                        style={{
                          background: isActive ? selectedReaction.color : 'white',
                          borderColor: isActive ? selectedReaction.color : 'var(--t-linen)',
                          color: isActive ? 'white' : INK['90'],
                          fontFamily: FONT.sans,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStep('note')}
                  className="flex-1 py-3 rounded-xl border cursor-pointer text-[12px] font-medium transition-all"
                  style={{
                    background: 'white',
                    borderColor: 'var(--t-linen)',
                    color: INK['90'],
                    fontFamily: FONT.sans,
                  }}
                >
                  + Add a note
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl border-none cursor-pointer text-[12px] font-semibold transition-all"
                  style={{
                    background: selectedReaction.color,
                    color: 'white',
                    fontFamily: FONT.sans,
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Personal Note */}
          {step === 'note' && selectedReaction && (
            <div className="flex flex-col gap-4">
              <h3
                className="text-[10px] uppercase tracking-wider font-bold"
                style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}
              >
                Personal note
              </h3>
              <p className="text-[11px] -mt-2" style={{ color: INK['95'] }}>
                What would you tell a friend about this place?
              </p>
              <textarea
                value={personalNote}
                onChange={e => setPersonalNote(e.target.value)}
                placeholder="The back courtyard after 5pm is another world entirely..."
                className="w-full p-3 rounded-xl border text-[13px] leading-relaxed resize-none"
                style={{
                  background: 'white',
                  borderColor: 'var(--t-linen)',
                  color: 'var(--t-ink)',
                  fontFamily: FONT.sans,
                  minHeight: 120,
                  outline: 'none',
                }}
                rows={5}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 py-3 rounded-xl border cursor-pointer text-[12px] font-medium"
                  style={{
                    background: 'white',
                    borderColor: 'var(--t-linen)',
                    color: INK['90'],
                    fontFamily: FONT.sans,
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl border-none cursor-pointer text-[12px] font-semibold"
                  style={{
                    background: selectedReaction.color,
                    color: 'white',
                    fontFamily: FONT.sans,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
