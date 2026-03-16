'use client';

import { useState, useRef } from 'react';
import type { PropertyAnchor } from '@/types';

const SENTIMENT_LABELS: Record<string, string> = {
  love: 'loved',
  like: 'liked',
  visited: 'visited',
  dislike: 'disliked',
};

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  love: { bg: 'rgba(200, 146, 58, 0.15)', text: 'var(--t-honey-text)' },
  like: { bg: 'rgba(58, 128, 136, 0.12)', text: 'var(--t-dark-teal)' },
  visited: { bg: 'rgba(232, 220, 200, 0.5)', text: 'var(--t-navy)' },
  dislike: { bg: 'rgba(214, 48, 32, 0.10)', text: 'var(--t-signal-red)' },
};

interface AnchorVerificationCardProps {
  anchor: PropertyAnchor;
  onConfirm: (googlePlaceId: string) => void;
  onDismiss: (googlePlaceId: string) => void;
  /** Called when user types a corrected place name after dismissing */
  onClarify?: (name: string) => void;
}

export default function AnchorVerificationCard({
  anchor,
  onConfirm,
  onDismiss,
  onClarify,
}: AnchorVerificationCardProps) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'dismissed' | 'clarifying'>('pending');
  const [clarifyText, setClarifyText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sentiment = SENTIMENT_COLORS[anchor.sentiment] || SENTIMENT_COLORS.visited;

  const handleConfirm = () => {
    setStatus('confirmed');
    onConfirm(anchor.googlePlaceId);
  };

  const handleDismiss = () => {
    if (onClarify) {
      // Show text input for correction instead of removing immediately
      setStatus('clarifying');
      onDismiss(anchor.googlePlaceId);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setStatus('dismissed');
      onDismiss(anchor.googlePlaceId);
    }
  };

  const handleClarifySubmit = () => {
    const name = clarifyText.trim();
    if (name && onClarify) {
      onClarify(name);
      setStatus('dismissed');
    }
  };

  const handleClarifyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleClarifySubmit();
    }
    if (e.key === 'Escape') {
      setStatus('dismissed');
    }
  };

  if (status === 'dismissed') return null;

  // Show text input for typing the correct name
  if (status === 'clarifying') {
    return (
      <div
        className="rounded-xl px-3.5 py-3 mt-2 transition-all duration-300"
        style={{ backgroundColor: 'var(--t-peach)', border: '1px solid rgba(28, 26, 23, 0.06)' }}
      >
        <p
          className="text-[12px] mb-2"
          style={{ color: 'var(--t-navy)' }}
        >
          What was the place you meant?
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={clarifyText}
            onChange={(e) => setClarifyText(e.target.value)}
            onKeyDown={handleClarifyKeyDown}
            placeholder="Type the name..."
            className="flex-1 text-[14px] bg-transparent outline-none text-[var(--t-navy)] placeholder:text-[var(--t-navy)]/30"
            style={{ fontFamily: 'var(--font-sans)' }}
          />
          <button
            onClick={handleClarifySubmit}
            disabled={!clarifyText.trim()}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-20"
            style={{ backgroundColor: 'var(--t-navy)', color: 'var(--t-cream)' }}
          >
            Search
          </button>
          <button
            onClick={() => setStatus('dismissed')}
            className="text-[12px] transition-all"
            style={{ color: 'var(--t-navy)', opacity: 0.3 }}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        flex items-center gap-3 rounded-xl px-3.5 py-2.5 mt-2
        transition-all duration-300
        ${status === 'confirmed' ? 'opacity-60' : ''}
      `}
      style={{ backgroundColor: 'var(--t-travertine)', border: '1px solid rgba(28, 26, 23, 0.06)' }}
    >
      {/* Property info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] leading-tight truncate"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--t-navy)' }}
        >
          {anchor.propertyName}
        </p>
        {anchor.placeType && (
          <p
            className="text-[11px] tracking-wide uppercase mt-0.5 truncate"
            style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--t-navy)' }}
          >
            {anchor.placeType}
          </p>
        )}
      </div>

      {/* Sentiment pill */}
      <span
        className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: sentiment.bg, color: sentiment.text }}
      >
        {SENTIMENT_LABELS[anchor.sentiment] || anchor.sentiment}
      </span>

      {/* Actions */}
      {status === 'pending' ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleConfirm}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'rgba(58, 128, 136, 0.12)', color: 'var(--t-dark-teal)' }}
          >
            Yes
          </button>
          <button
            onClick={handleDismiss}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'rgba(214, 48, 32, 0.08)', color: 'var(--t-signal-red)' }}
          >
            Wrong
          </button>
        </div>
      ) : (
        <span
          className="text-[11px] shrink-0"
          style={{ color: 'var(--t-dark-teal)', opacity: 0.7 }}
        >
          confirmed
        </span>
      )}
    </div>
  );
}
