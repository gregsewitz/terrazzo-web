'use client';

import { useState } from 'react';
import type { PropertyAnchor } from '@/types';

const SENTIMENT_LABELS: Record<string, string> = {
  love: 'loved',
  like: 'liked',
  visited: 'visited',
  dislike: 'disliked',
};

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  love: { bg: 'rgba(200, 146, 58, 0.15)', text: 'var(--t-honey-text)' },
  like: { bg: 'rgba(42, 122, 86, 0.12)', text: 'var(--t-verde)' },
  visited: { bg: 'rgba(232, 220, 200, 0.5)', text: 'var(--t-ink)' },
  dislike: { bg: 'rgba(214, 48, 32, 0.10)', text: 'var(--t-signal-red)' },
};

interface AnchorVerificationCardProps {
  anchor: PropertyAnchor;
  onConfirm: (googlePlaceId: string) => void;
  onDismiss: (googlePlaceId: string) => void;
}

export default function AnchorVerificationCard({
  anchor,
  onConfirm,
  onDismiss,
}: AnchorVerificationCardProps) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'dismissed'>('pending');
  const sentiment = SENTIMENT_COLORS[anchor.sentiment] || SENTIMENT_COLORS.visited;

  const handleConfirm = () => {
    setStatus('confirmed');
    onConfirm(anchor.googlePlaceId);
  };

  const handleDismiss = () => {
    setStatus('dismissed');
    onDismiss(anchor.googlePlaceId);
  };

  if (status === 'dismissed') return null;

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
          style={{ fontFamily: 'var(--font-serif, Georgia, serif)', color: 'var(--t-ink)' }}
        >
          {anchor.propertyName}
        </p>
        {anchor.placeType && (
          <p
            className="text-[11px] tracking-wide uppercase mt-0.5 truncate"
            style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--t-ink)', opacity: 0.5 }}
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
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'rgba(42, 122, 86, 0.12)' }}
            aria-label={`Confirm ${anchor.propertyName}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5L6.5 12L13 4" stroke="var(--t-verde)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'rgba(214, 48, 32, 0.08)' }}
            aria-label={`Dismiss ${anchor.propertyName}`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="var(--t-signal-red)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : (
        <span
          className="text-[11px] shrink-0"
          style={{ color: 'var(--t-verde)', opacity: 0.7 }}
        >
          ✓
        </span>
      )}
    </div>
  );
}
