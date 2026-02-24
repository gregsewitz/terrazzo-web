'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MOSAIC_QUESTIONS, MOSAIC_SECTIONS, type MosaicQuestion } from '@/constants/mosaic-questions';
import { FONT, INK } from '@/constants/theme';
import { useOnboardingStore } from '@/stores/onboardingStore';

// ─── Selection Engine ───

function pickNextQuestion(
  answered: Set<number>,
  lastSection: string | null,
  lastType: string | null,
): MosaicQuestion | null {
  const eligible = MOSAIC_QUESTIONS.filter(q => {
    if (answered.has(q.id)) return false;
    if (q.minAnswered && answered.size < q.minAnswered) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  // Avoid same section and same type back-to-back
  const preferred = eligible.filter(q => q.section !== lastSection && q.type !== lastType);
  const pool = preferred.length > 0 ? preferred : eligible;

  // Weighted random: boost under-represented domains
  const domainCounts: Record<string, number> = {};
  for (const id of answered) {
    const q = MOSAIC_QUESTIONS.find(mq => mq.id === id);
    if (q) domainCounts[q.domain] = (domainCounts[q.domain] || 0) + 1;
  }

  const weights = pool.map(q => {
    const count = domainCounts[q.domain] || 0;
    return 1 / (1 + count); // less-answered domains get higher weight
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ─── Domain Progress ───

const DOMAIN_LABELS: Record<string, string> = {
  hotel: 'Hotels', restaurant: 'Restaurants', bar: 'Bars',
  activity: 'Activities', shopping: 'Shopping', neighborhood: 'Neighborhoods',
  'cross-domain': 'Cross-Domain', identity: 'Identity',
};

function computeDomainProgress(answered: Set<number>) {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const q of MOSAIC_QUESTIONS) {
    totals[q.domain] = (totals[q.domain] || 0) + 1;
  }
  for (const id of answered) {
    const q = MOSAIC_QUESTIONS.find(mq => mq.id === id);
    if (q) counts[q.domain] = (counts[q.domain] || 0) + 1;
  }
  return Object.entries(totals).map(([domain, total]) => ({
    domain,
    label: DOMAIN_LABELS[domain] || domain,
    answered: counts[domain] || 0,
    total,
    pct: Math.round(((counts[domain] || 0) / total) * 100),
  })).sort((a, b) => b.total - a.total);
}

// ─── Main Component ───

interface ExpandMosaicViewProps {
  onClose: () => void;
}

export default function ExpandMosaicView({ onClose }: ExpandMosaicViewProps) {
  // ─── Store connection ───
  const mosaicAnswers = useOnboardingStore(s => s.mosaicAnswers);
  const recordMosaicAnswer = useOnboardingStore(s => s.recordMosaicAnswer);

  // Derive answered IDs from store (resume support)
  const answeredFromStore = useMemo(
    () => new Set(mosaicAnswers.map(a => a.questionId)),
    [mosaicAnswers],
  );

  const [answered, setAnswered] = useState<Set<number>>(answeredFromStore);
  const [current, setCurrent] = useState<MosaicQuestion | null>(
    () => pickNextQuestion(answeredFromStore, null, null),
  );
  const [phase, setPhase] = useState<'question' | 'transition'>('question');
  const [lastSignals, setLastSignals] = useState<string[]>([]);
  const [showProgress, setShowProgress] = useState(false);
  const lastSectionRef = useRef<string | null>(null);
  const lastTypeRef = useRef<string | null>(null);

  // Sync from store on mount (handles hydration timing)
  useEffect(() => {
    if (answeredFromStore.size > 0 && answered.size === 0) {
      setAnswered(answeredFromStore);
      setCurrent(pickNextQuestion(answeredFromStore, null, null));
    }
  }, [answeredFromStore]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalQuestions = MOSAIC_QUESTIONS.length;
  const completionPct = Math.round((answered.size / totalQuestions) * 100);

  const domainProgress = useMemo(() => computeDomainProgress(answered), [answered]);

  const handleAnswer = useCallback((signals: string[], axes?: Record<string, number>) => {
    if (!current) return;
    setLastSignals(signals);
    setPhase('transition');

    const newAnswered = new Set(answered);
    newAnswered.add(current.id);
    setAnswered(newAnswered);
    lastSectionRef.current = current.section;
    lastTypeRef.current = current.type;

    // Persist to store → localStorage + fire-and-forget DB save
    recordMosaicAnswer(current.id, axes || {}, signals);

    // Brief pause for the satisfying transition
    setTimeout(() => {
      const next = pickNextQuestion(newAnswered, lastSectionRef.current, lastTypeRef.current);
      setCurrent(next);
      setPhase('question');
    }, 600);
  }, [current, answered, recordMosaicAnswer]);

  const sectionMeta = current ? MOSAIC_SECTIONS[current.section] : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--t-cream)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ─── Top Bar ─── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${INK['08']}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: FONT.sans, fontSize: 13, color: INK['60'],
            padding: '4px 0',
          }}
        >
          ← Done
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['50'], textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Expand Your Mosaic
          </div>
        </div>
        <button
          onClick={() => setShowProgress(!showProgress)}
          style={{
            background: showProgress ? INK['10'] : 'none',
            border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 10px',
            fontFamily: FONT.mono, fontSize: 11, color: INK['60'],
          }}
        >
          {completionPct}%
        </button>
      </div>

      {/* ─── Progress Drawer ─── */}
      {showProgress && (
        <div
          style={{
            padding: '16px 20px 20px',
            borderBottom: `1px solid ${INK['08']}`,
            background: 'white',
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Domain coverage
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {domainProgress.map(d => (
              <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 80, fontFamily: FONT.sans, fontSize: 11, color: INK['70'] }}>{d.label}</div>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: INK['06'] }}>
                  <div style={{ width: `${d.pct}%`, height: '100%', borderRadius: 2, background: d.pct > 50 ? '#2a7a56' : d.pct > 20 ? '#c8923a' : INK['20'], transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['45'], width: 36, textAlign: 'right' }}>{d.answered}/{d.total}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Main Question Area ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', opacity: phase === 'transition' ? 0.3 : 1, transition: 'opacity 0.25s ease', overflow: 'auto' }}>
        {current ? (
          <>
            {/* Section badge */}
            {sectionMeta && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <span
                  style={{
                    fontFamily: FONT.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em',
                    color: sectionMeta.color, background: `${sectionMeta.color}12`,
                    padding: '4px 12px', borderRadius: 20,
                  }}
                >
                  {sectionMeta.label}
                </span>
              </div>
            )}

            {/* Render by type */}
            {(current.type === 'ab' || current.type === 'scene') && (
              <ABQuestion question={current} onAnswer={handleAnswer} />
            )}
            {current.type === 'slider' && (
              <SliderQuestion question={current} onAnswer={handleAnswer} />
            )}
            {current.type === 'rank' && (
              <RankQuestion question={current} onAnswer={handleAnswer} />
            )}
            {current.type === 'micro' && (
              <MicroQuestion question={current} onAnswer={handleAnswer} />
            )}
          </>
        ) : (
          <CompletionState onClose={onClose} answered={answered.size} total={totalQuestions} />
        )}
      </div>

      {/* ─── Bottom: Signal flash + count ─── */}
      <div style={{ padding: '12px 20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['35'] }}>
          {answered.size} of {totalQuestions} answered
        </div>
        {phase === 'transition' && lastSignals.length > 0 && (
          <div style={{ display: 'flex', gap: 4, animation: 'fadeIn 0.2s ease' }}>
            {lastSignals.slice(0, 2).map(s => (
              <span
                key={s}
                style={{
                  fontFamily: FONT.mono, fontSize: 9, color: '#2a7a56',
                  background: 'rgba(42,122,86,0.08)', padding: '3px 8px', borderRadius: 12,
                }}
              >
                +{s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// AB / Scene Question
// ═══════════════════════════════════════

function ABQuestion({ question, onAnswer }: { question: MosaicQuestion; onAnswer: (signals: string[], axes?: Record<string, number>) => void }) {
  const [selected, setSelected] = useState<'a' | 'b' | null>(null);

  const handlePick = (side: 'a' | 'b') => {
    setSelected(side);
    const option = side === 'a' ? question.optionA : question.optionB;
    setTimeout(() => {
      const axes: Record<string, number> = {};
      if (option?.axes) {
        for (const [k, v] of Object.entries(option.axes)) {
          if (v !== undefined) axes[k] = v;
        }
      }
      onAnswer(option?.signals || [], axes);
      setSelected(null);
    }, 300);
  };

  const isScene = question.type === 'scene';

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
      {/* Prompt */}
      <h2 style={{
        fontFamily: FONT.serif, fontSize: isScene ? 20 : 26, lineHeight: 1.25,
        color: 'var(--t-ink)', textAlign: 'center', marginBottom: isScene ? 24 : 32,
        fontWeight: 400,
      }}>
        {question.prompt}
      </h2>

      {/* Two options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(['a', 'b'] as const).map(side => {
          const opt = side === 'a' ? question.optionA : question.optionB;
          if (!opt) return null;
          const isSelected = selected === side;
          const isOther = selected !== null && selected !== side;
          return (
            <button
              key={side}
              onClick={() => handlePick(side)}
              style={{
                padding: isScene ? '20px 24px' : '24px',
                borderRadius: 16,
                border: isSelected ? '2px solid var(--t-ink)' : `1px solid ${INK['12']}`,
                background: isSelected ? INK['04'] : 'white',
                cursor: 'pointer',
                opacity: isOther ? 0.35 : 1,
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.25s ease',
                textAlign: 'left',
              }}
            >
              <div style={{
                fontFamily: FONT.sans, fontSize: isScene ? 14 : 16,
                color: 'var(--t-ink)', fontWeight: 500, lineHeight: 1.4,
              }}>
                {opt.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Slider Question
// ═══════════════════════════════════════

function SliderQuestion({ question, onAnswer }: { question: MosaicQuestion; onAnswer: (signals: string[], axes?: Record<string, number>) => void }) {
  const [value, setValue] = useState(50);
  const [committed, setCommitted] = useState(false);

  const handleCommit = () => {
    if (committed) return;
    setCommitted(true);
    const signal = value < 40 ? question.leftLabel : value > 60 ? question.rightLabel : 'Balanced';
    // Convert slider 0–100 to axis delta: -0.15 to +0.15
    const axisDelta = question.sliderAxis
      ? { [question.sliderAxis]: (value - 50) / 333 } // ≈ ±0.15 at extremes
      : {};
    setTimeout(() => {
      onAnswer([signal || 'Neutral'], axisDelta);
      setCommitted(false);
      setValue(50);
    }, 400);
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', width: '100%', textAlign: 'center' }}>
      <h2 style={{ fontFamily: FONT.serif, fontSize: 24, color: 'var(--t-ink)', marginBottom: 40, fontWeight: 400 }}>
        {question.prompt}
      </h2>

      <div style={{ padding: '0 8px', marginBottom: 16 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          style={{
            width: '100%', height: 4, appearance: 'none', background: INK['12'],
            borderRadius: 2, outline: 'none', cursor: 'pointer',
            accentColor: 'var(--t-ink)',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <span style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['50'] }}>{question.leftLabel}</span>
        <span style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['50'] }}>{question.rightLabel}</span>
      </div>

      <button
        onClick={handleCommit}
        style={{
          fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
          color: 'white', background: 'var(--t-ink)',
          border: 'none', borderRadius: 12, padding: '12px 32px',
          cursor: 'pointer', opacity: committed ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        Lock it in
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
// Rank Question
// ═══════════════════════════════════════

function RankQuestion({ question, onAnswer }: { question: MosaicQuestion; onAnswer: (signals: string[], axes?: Record<string, number>) => void }) {
  const [order, setOrder] = useState<string[]>(question.rankOptions || []);
  const [committed, setCommitted] = useState(false);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  };

  const moveDown = (idx: number) => {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
  };

  // Reset order when question changes
  useEffect(() => {
    setOrder(question.rankOptions || []);
    setCommitted(false);
  }, [question.id, question.rankOptions]);

  const handleCommit = () => {
    if (committed) return;
    setCommitted(true);
    setTimeout(() => {
      onAnswer([`1st:${order[0]}`, `Last:${order[order.length - 1]}`]);
      setCommitted(false);
    }, 400);
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontFamily: FONT.serif, fontSize: 22, color: 'var(--t-ink)', textAlign: 'center', marginBottom: 28, fontWeight: 400 }}>
        {question.rankPrompt}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {order.map((item, idx) => (
          <div
            key={item}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: 'white', border: `1px solid ${INK['10']}`,
            }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: 12, color: INK['35'], width: 20, textAlign: 'center' }}>
              {idx + 1}
            </span>
            <span style={{ flex: 1, fontFamily: FONT.sans, fontSize: 14, color: 'var(--t-ink)' }}>
              {item}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 14, color: idx === 0 ? INK['15'] : INK['40'], padding: '2px 6px' }}>↑</button>
              <button onClick={() => moveDown(idx)} disabled={idx === order.length - 1} style={{ background: 'none', border: 'none', cursor: idx === order.length - 1 ? 'default' : 'pointer', fontSize: 14, color: idx === order.length - 1 ? INK['15'] : INK['40'], padding: '2px 6px' }}>↓</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleCommit}
          style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            color: 'white', background: 'var(--t-ink)',
            border: 'none', borderRadius: 12, padding: '12px 32px',
            cursor: 'pointer', opacity: committed ? 0.5 : 1,
          }}
        >
          Lock it in
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Micro Question (open-ended)
// ═══════════════════════════════════════

function MicroQuestion({ question, onAnswer }: { question: MosaicQuestion; onAnswer: (signals: string[], axes?: Record<string, number>) => void }) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setText('');
    setSubmitted(false);
  }, [question.id]);

  const handleSubmit = () => {
    if (!text.trim() || submitted) return;
    setSubmitted(true);
    const words = text.trim().split(/\s+/);
    setTimeout(() => {
      onAnswer(words.slice(0, 3).map(w => w.toLowerCase()));
      setSubmitted(false);
      setText('');
    }, 400);
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', width: '100%', textAlign: 'center' }}>
      <h2 style={{ fontFamily: FONT.serif, fontSize: 22, color: 'var(--t-ink)', marginBottom: 36, fontWeight: 400, lineHeight: 1.35 }}>
        {question.microPrompt}
      </h2>

      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="Type here..."
        style={{
          width: '100%', maxWidth: 320,
          fontFamily: FONT.serif, fontSize: 18, color: 'var(--t-ink)',
          background: 'none', border: 'none', borderBottom: `2px solid ${INK['15']}`,
          padding: '12px 0', textAlign: 'center', outline: 'none',
        }}
      />

      <div style={{ marginTop: 24 }}>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            color: text.trim() ? 'white' : INK['30'],
            background: text.trim() ? 'var(--t-ink)' : INK['06'],
            border: 'none', borderRadius: 12, padding: '12px 32px',
            cursor: text.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Completion State
// ═══════════════════════════════════════

function CompletionState({ onClose, answered, total }: { onClose: () => void; answered: number; total: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
      <h2 style={{ fontFamily: FONT.serif, fontSize: 26, color: 'var(--t-ink)', marginBottom: 8, fontWeight: 400 }}>
        Mosaic complete
      </h2>
      <p style={{ fontFamily: FONT.sans, fontSize: 14, color: INK['60'], marginBottom: 32, lineHeight: 1.5 }}>
        You've answered all {total} questions. Your taste profile is sharper than ever — matching across hotels, restaurants, bars, and activities is fully calibrated.
      </p>
      <button
        onClick={onClose}
        style={{
          fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
          color: 'white', background: 'var(--t-ink)',
          border: 'none', borderRadius: 14, padding: '14px 36px',
          cursor: 'pointer',
        }}
      >
        Back to profile
      </button>
    </div>
  );
}
