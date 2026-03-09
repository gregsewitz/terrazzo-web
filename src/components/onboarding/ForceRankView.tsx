'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal, ForceRankItem } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';

interface ForceRankViewProps {
  onComplete: () => void;
  items: ForceRankItem[];
}

/**
 * ForceRankView — user selects their top 3 items in order of importance.
 * Tap to rank: first tap = #1 (most important), second = #2, third = #3.
 * Tap a ranked item to un-rank it. Submit when 3 are ranked.
 *
 * Signal emission: #1 gets confidence 0.95, #2 gets 0.82, #3 gets 0.68.
 * Unranked items emit weak anti-signals at 0.3.
 */
export default function ForceRankView({ onComplete, items }: ForceRankViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  // Ordered array of selected item IDs (index 0 = rank 1)
  const [ranked, setRanked] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const MAX_RANK = 3;

  const handleTap = useCallback((itemId: string) => {
    if (submitted) return;

    setRanked((prev) => {
      const idx = prev.indexOf(itemId);
      if (idx !== -1) {
        // Un-rank: remove and shift others up
        const next = prev.filter((id) => id !== itemId);
        setCurrentPhaseProgress(next.length / MAX_RANK);
        return next;
      }
      if (prev.length >= MAX_RANK) return prev; // already full
      const next = [...prev, itemId];
      setCurrentPhaseProgress(next.length / MAX_RANK);
      return next;
    });
  }, [submitted, setCurrentPhaseProgress]);

  const handleSubmit = useCallback(() => {
    if (submitted || ranked.length < MAX_RANK) return;
    setSubmitted(true);

    const RANK_CONFIDENCE = [0.95, 0.82, 0.68];
    const signals: TasteSignal[] = [];
    const certaintyUpdates: Record<string, number> = {};

    // Ranked items get strong signals
    ranked.forEach((id, rank) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const conf = RANK_CONFIDENCE[rank];
      for (const tag of item.signals) {
        signals.push({ tag, cat: item.domain, confidence: conf });
      }
      certaintyUpdates[item.domain] = (certaintyUpdates[item.domain] || 0) + (1 - rank * 0.2) * 12;
    });

    // Unranked items get weak anti-signals (they matter less to this user)
    items.forEach((item) => {
      if (ranked.includes(item.id)) return;
      for (const tag of item.signals) {
        signals.push({ tag: `Low-priority:${tag}`, cat: item.domain, confidence: 0.3 });
      }
    });

    if (signals.length > 0) addSignals(signals);
    if (Object.keys(certaintyUpdates).length > 0) updateCertainties(certaintyUpdates);

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 500);
  }, [submitted, ranked, items, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px 40px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Instruction */}
        <p style={{
          color: T.ink,
          fontSize: 14,
          margin: '0 0 20px',
          textAlign: 'center',
          fontFamily: FONT.sans,
          letterSpacing: '0.01em',
        }}>
          Tap your top 3 in order of importance
        </p>

        {/* Items */}
        {items.map((item, i) => {
          const rankIdx = ranked.indexOf(item.id);
          const isRanked = rankIdx !== -1;
          const rankNum = rankIdx + 1;
          const isFull = ranked.length >= MAX_RANK;

          return (
            <button
              key={item.id}
              onClick={() => handleTap(item.id)}
              disabled={submitted}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 18px',
                background: isRanked
                  ? 'rgba(42, 122, 86, 0.06)'
                  : 'rgba(28, 26, 23, 0.02)',
                borderRadius: 14,
                border: isRanked
                  ? '1.5px solid rgba(42, 122, 86, 0.25)'
                  : '1px solid rgba(28, 26, 23, 0.06)',
                cursor: submitted ? 'default' : (isFull && !isRanked) ? 'default' : 'pointer',
                opacity: submitted ? 0.6 : (isFull && !isRanked) ? 0.35 : 1,
                transition: 'all 0.25s ease',
                animation: `fadeInUp 0.35s ease ${i * 0.06}s both`,
                textAlign: 'left',
                width: '100%',
              }}
            >
              {/* Rank badge */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isRanked ? T.verde : 'rgba(28, 26, 23, 0.04)',
                color: isRanked ? T.cream : T.ink,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONT.mono,
                transition: 'all 0.25s ease',
              }}>
                {isRanked ? rankNum : ''}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 15,
                  fontFamily: FONT.serif,
                  color: T.ink,
                  margin: 0,
                  lineHeight: 1.3,
                }}>
                  {item.label}
                </p>
                {item.description && (
                  <p style={{
                    fontSize: 12,
                    color: T.ink,
                    fontFamily: FONT.sans,
                    margin: '3px 0 0',
                    lineHeight: 1.35,
                  }}>
                    {item.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitted || ranked.length < MAX_RANK}
          className="btn-hover"
          style={{
            marginTop: 24,
            padding: '15px 40px',
            background: (submitted || ranked.length < MAX_RANK) ? T.travertine : T.ink,
            color: (submitted || ranked.length < MAX_RANK) ? T.ink : T.cream,
            border: 'none',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: (submitted || ranked.length < MAX_RANK) ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            opacity: ranked.length < MAX_RANK ? 0.4 : submitted ? 0.6 : 1,
            alignSelf: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {submitted ? 'Noted' : ranked.length < MAX_RANK ? `Pick ${MAX_RANK - ranked.length} more` : 'Continue'}
        </button>
      </div>
    </div>
  );
}
