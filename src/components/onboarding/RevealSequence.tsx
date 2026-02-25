'use client';

import { useState, useEffect, useMemo } from 'react';
import type { GeneratedTasteProfile, GoBackPlace, SeedTripInput } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK } from '@/constants/theme';
import { T } from '@/types';

interface RevealSequenceProps {
  profile: GeneratedTasteProfile;
  onComplete: () => void;
}

type RevealStage =
  | 'archetype'
  | 'quote'
  | 'design'
  | 'fingerprint'
  | 'contradiction'
  | 'perfectday'
  | 'shift'
  | 'neighbors'
  | 'destinations'
  | 'trips';

export default function RevealSequence({ profile, onComplete }: RevealSequenceProps) {
  const { goBackPlace, seedTrips, lifeContext, mosaicAxes } = useOnboardingStore();

  // Build dynamic stage list — skip stages with no data
  const stages = useMemo(() => {
    const s: RevealStage[] = ['archetype'];
    if (profile.bestQuote?.quote) s.push('quote');
    if (profile.designInsight || Object.keys(mosaicAxes).length > 0) s.push('design');
    if (profile.radarData?.length > 0) s.push('fingerprint');
    if (profile.contradictions?.length > 0) s.push('contradiction');
    if (profile.perfectDay) s.push('perfectday');
    if (profile.howYouShift?.length) s.push('shift');
    if (profile.tasteNeighbors) s.push('neighbors');
    if (profile.destinations) s.push('destinations');
    if (seedTrips?.length > 0) s.push('trips');
    return s;
  }, [profile, mosaicAxes, seedTrips]);

  const [stageIndex, setStageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const stage = stages[stageIndex];

  const advance = () => {
    if (stageIndex >= stages.length - 1) {
      onComplete();
      return;
    }
    setIsTransitioning(true);
    setTimeout(() => {
      setStageIndex((i) => i + 1);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          flex: 1, overflowY: 'auto', padding: '32px 24px',
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 300ms ease',
        }}
      >
        {stage === 'archetype' && <ArchetypeReveal profile={profile} firstName={lifeContext.firstName} />}
        {stage === 'quote' && <QuoteReveal profile={profile} />}
        {stage === 'design' && <DesignLanguageReveal profile={profile} mosaicAxes={mosaicAxes} />}
        {stage === 'fingerprint' && <TasteFingerprintReveal profile={profile} />}
        {stage === 'contradiction' && <ContradictionReveal profile={profile} />}
        {stage === 'perfectday' && <PerfectDayReveal profile={profile} />}
        {stage === 'shift' && <HowYouShiftReveal profile={profile} />}
        {stage === 'neighbors' && <TasteNeighborsReveal profile={profile} />}
        {stage === 'destinations' && <DestinationsReveal profile={profile} />}
        {stage === 'trips' && <SeedTripsReveal seedTrips={seedTrips} />}
      </div>

      <div style={{
        padding: '16px 24px 20px',
        borderTop: '1px solid var(--t-linen)',
        flexShrink: 0,
      }}>
        <button
          onClick={advance}
          style={{
            width: '100%', padding: '14px 0',
            borderRadius: 14, border: 'none',
            background: 'var(--t-ink)', color: 'var(--t-cream)',
            fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
        >
          {stageIndex >= stages.length - 1 ? 'Dive in' : 'Continue'}
        </button>

        {/* Stage dots */}
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14,
        }}>
          {stages.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === stageIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === stageIndex ? T.honey : i < stageIndex ? INK['30'] : INK['12'],
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── Card 1: Archetype ───

function ArchetypeReveal({ profile, firstName }: { profile: GeneratedTasteProfile; firstName?: string }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 400); return () => clearTimeout(t); }, []);

  const greeting = firstName ? `${firstName}, you're` : "You're";

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: T.honey, marginBottom: 20,
      }}>
        Your taste archetype
      </div>
      <h1 style={{
        fontFamily: FONT.serif, fontSize: 38, fontStyle: 'italic',
        fontWeight: 400, color: 'var(--t-ink)',
        margin: 0, lineHeight: 1.15,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 1s ease',
      }}>
        {greeting} {profile.overallArchetype}
      </h1>
      <p style={{
        fontFamily: FONT.sans, fontSize: 16, lineHeight: 1.65,
        color: INK['60'], maxWidth: 320, marginTop: 16,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 1s ease 0.3s',
      }}>
        {profile.archetypeDescription}
      </p>
      <div style={{
        marginTop: 24, padding: '10px 20px',
        borderRadius: 100,
        border: '1px solid var(--t-linen)',
        opacity: revealed ? 1 : 0,
        transition: 'opacity 1s ease 0.7s',
      }}>
        <span style={{
          fontFamily: FONT.sans, fontSize: 13, color: INK['50'],
        }}>
          <span style={{ color: T.honey, fontWeight: 600 }}>{profile.emotionalDriver.primary}</span>
          {' · '}
          <span>{profile.emotionalDriver.secondary}</span>
        </span>
      </div>
    </div>
  );
}


// ─── Card 2: The Quote ───

function QuoteReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);

  if (!profile.bestQuote) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
      padding: '0 4px',
    }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: INK['45'], marginBottom: 24,
      }}>
        The moment that told us the most
      </div>

      <div style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.8s ease',
      }}>
        {/* Large decorative quote mark */}
        <div style={{
          fontFamily: FONT.serif, fontSize: 64, color: T.honey,
          lineHeight: 0.6, marginBottom: 8, opacity: 0.5,
        }}>
          &ldquo;
        </div>

        <p style={{
          fontFamily: FONT.serif, fontSize: 22, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          lineHeight: 1.5, maxWidth: 380, margin: '0 auto',
        }}>
          {profile.bestQuote.quote}
        </p>
      </div>

      <p style={{
        fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
        color: INK['55'], maxWidth: 340, marginTop: 28,
        opacity: revealed ? 1 : 0,
        transition: 'opacity 0.8s ease 0.5s',
      }}>
        {profile.bestQuote.insight}
      </p>
    </div>
  );
}


// ─── Card 3: Design Language ───

function DesignLanguageReveal({
  profile,
  mosaicAxes,
}: {
  profile: GeneratedTasteProfile;
  mosaicAxes: Record<string, number>;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 200); return () => clearTimeout(t); }, []);

  // Build spectrum data: merge ELO axes with profile annotations
  const spectrums = useMemo(() => {
    const axisOrder = ['volume', 'temperature', 'time', 'formality', 'culture', 'mood'];
    const defaultLabels: Record<string, [string, string]> = {
      volume: ['Minimal', 'Maximal'],
      temperature: ['Cool & Composed', 'Warm & Rich'],
      time: ['Contemporary', 'Historic & Layered'],
      formality: ['Raw & Natural', 'Polished & Sleek'],
      culture: ['International', 'Deeply Local'],
      mood: ['Serene', 'Energetic'],
    };

    return axisOrder.map((axis) => {
      const eloValue = mosaicAxes[axis] ?? 0.5;
      const annotation = profile.designInsight?.annotations?.find((a) => a.axis === axis);
      return {
        axis,
        value: eloValue,
        labels: annotation?.label ?? defaultLabels[axis] ?? [axis, axis],
        note: annotation?.note,
      };
    });
  }, [mosaicAxes, profile.designInsight]);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: INK['45'], marginBottom: 8,
        }}>
          Your design language
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: '0 0 4px',
        }}>
          {profile.designInsight?.headline ?? 'How you see space'}
        </h2>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {spectrums.map((spec, i) => (
          <div
            key={spec.axis}
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(8px)',
              transition: `all 0.5s ease ${i * 80}ms`,
            }}
          >
            {/* Labels */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 6,
            }}>
              <span style={{
                fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: INK['50'],
              }}>
                {spec.labels[0]}
              </span>
              <span style={{
                fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: INK['50'],
              }}>
                {spec.labels[1]}
              </span>
            </div>

            {/* Bar */}
            <div style={{
              position: 'relative', height: 8, borderRadius: 4,
              background: 'var(--t-linen)',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0,
                height: '100%', borderRadius: 4,
                background: T.honey,
                width: revealed ? `${Math.round(spec.value * 100)}%` : '0%',
                transition: `width 0.8s ease ${i * 80 + 200}ms`,
              }} />
            </div>

            {/* Annotation */}
            {spec.note && (
              <p style={{
                fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.5,
                color: INK['45'], marginTop: 5, marginBottom: 0,
                fontStyle: 'italic',
              }}>
                {spec.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Card 4: Taste Fingerprint ───

function TasteFingerprintReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);

  const radar = profile.radarData;
  if (!radar?.length) return null;

  // Find top 2 dimensions
  const sorted = [...radar].sort((a, b) => b.value - a.value);
  const top2 = sorted.slice(0, 2).map((d) => d.axis);

  // SVG radar chart — organic shape
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 24;

  const points = radar.map((d, i) => {
    const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
    const r = d.value * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (maxR + 16) * Math.cos(angle),
      labelY: cy + (maxR + 16) * Math.sin(angle),
      axis: d.axis,
      value: d.value,
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '50vh', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: INK['45'], marginBottom: 8,
      }}>
        Your taste fingerprint
      </div>

      <div style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'scale(1)' : 'scale(0.9)',
        transition: 'all 0.8s ease',
      }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Grid circles */}
          {[0.33, 0.66, 1].map((r) => (
            <circle
              key={r}
              cx={cx} cy={cy} r={maxR * r}
              fill="none" stroke={INK['08']} strokeWidth={1}
            />
          ))}
          {/* Grid lines */}
          {points.map((p, i) => (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={cx + maxR * Math.cos((Math.PI * 2 * i) / radar.length - Math.PI / 2)}
              y2={cy + maxR * Math.sin((Math.PI * 2 * i) / radar.length - Math.PI / 2)}
              stroke={INK['06']} strokeWidth={1}
            />
          ))}
          {/* Shape */}
          <path
            d={pathD}
            fill={`${T.honey}20`}
            stroke={T.honey}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill={T.honey} />
          ))}
        </svg>

        {/* Axis labels */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: '6px 14px', marginTop: 16, maxWidth: 280,
        }}>
          {radar.map((d) => (
            <span key={d.axis} style={{
              fontFamily: FONT.sans, fontSize: 11,
              fontWeight: top2.includes(d.axis) ? 700 : 400,
              color: top2.includes(d.axis) ? T.honey : INK['45'],
            }}>
              {d.axis}
            </span>
          ))}
        </div>
      </div>

      <p style={{
        fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
        color: INK['55'], maxWidth: 320, marginTop: 20,
        opacity: revealed ? 1 : 0,
        transition: 'opacity 0.8s ease 0.5s',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--t-ink)' }}>{top2[0]}</span>
        {' and '}
        <span style={{ fontWeight: 600, color: 'var(--t-ink)' }}>{top2[1]}</span>
        {' drive you. Most travelers lead with other dimensions — you lead with these.'}
      </p>
    </div>
  );
}


// ─── Card 5: Contradiction ───

function ContradictionReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);

  const c = profile.contradictions[0];
  if (!c) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '50vh', textAlign: 'center',
      padding: '0 4px',
    }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#6844a0', marginBottom: 24,
      }}>
        The interesting part
      </div>

      <div style={{
        maxWidth: 420, width: '100%',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.7s ease',
      }}>
        {/* The two poles */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginBottom: 24,
        }}>
          <span style={{
            fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
            color: 'var(--t-ink)', textAlign: 'right', flex: 1,
          }}>
            {c.stated}
          </span>
          <span style={{
            fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
            color: INK['30'],
          }}>
            ×
          </span>
          <span style={{
            fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
            color: 'var(--t-ink)', textAlign: 'left', flex: 1,
          }}>
            {c.revealed}
          </span>
        </div>

        {/* Resolution */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'white', border: '1px solid var(--t-linen)',
          textAlign: 'left',
          opacity: revealed ? 1 : 0,
          transition: 'opacity 0.7s ease 0.4s',
        }}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
            color: INK['70'], margin: 0,
          }}>
            {c.resolution}
          </p>
        </div>

        <p style={{
          fontFamily: FONT.sans, fontSize: 13, color: INK['40'],
          marginTop: 16,
        }}>
          We&apos;ll find places that understand both sides.
        </p>
      </div>
    </div>
  );
}


// ─── Card 6: Your Perfect Day ───

function PerfectDayReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 200); return () => clearTimeout(t); }, []);

  if (!profile.perfectDay) return null;

  const segments = [
    { label: 'Morning', text: profile.perfectDay.morning, color: '#e8dcc8' },
    { label: 'Afternoon', text: profile.perfectDay.afternoon, color: '#ddd5c4' },
    { label: 'Evening', text: profile.perfectDay.evening, color: '#d0c4ae' },
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: INK['45'], marginBottom: 8,
        }}>
          Your perfect day
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: 0,
        }}>
          How a great day unfolds for you
        </h2>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            style={{
              padding: '20px 24px', borderRadius: 16,
              background: 'white', border: '1px solid var(--t-linen)',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.6s ease ${i * 150}ms`,
            }}
          >
            <div style={{
              fontFamily: FONT.sans, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: T.honey, marginBottom: 8,
            }}>
              {seg.label}
            </div>
            <p style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
              color: INK['75'], margin: 0,
            }}>
              {seg.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Card 7: How You Shift ───

function HowYouShiftReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 200); return () => clearTimeout(t); }, []);

  if (!profile.howYouShift?.length) return null;

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: INK['45'], marginBottom: 8,
        }}>
          How you shift
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: 0,
        }}>
          You&apos;re not the same traveler every time
        </h2>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {profile.howYouShift.map((shift, i) => (
          <div
            key={shift.context}
            style={{
              padding: '20px 24px', borderRadius: 16,
              background: 'white', border: '1px solid var(--t-linen)',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.6s ease ${i * 150}ms`,
            }}
          >
            <div style={{
              fontFamily: FONT.sans, fontSize: 13, fontWeight: 700,
              color: 'var(--t-ink)', marginBottom: 6,
            }}>
              {shift.context}
            </div>
            <p style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
              color: INK['60'], margin: 0,
            }}>
              {shift.insight}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Card 8: Taste Neighbors ───

function TasteNeighborsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);

  if (!profile.tasteNeighbors) return null;
  const { nearbyArchetypes, distinction, rarityStat } = profile.tasteNeighbors;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '50vh', textAlign: 'center',
      padding: '0 4px',
    }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: INK['45'], marginBottom: 24,
      }}>
        Your taste neighbors
      </div>

      <div style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.7s ease',
      }}>
        {/* Nearby archetypes */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          justifyContent: 'center', marginBottom: 20,
        }}>
          {nearbyArchetypes.map((name) => (
            <span
              key={name}
              style={{
                fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
                color: 'var(--t-ink)',
                padding: '8px 18px', borderRadius: 100,
                border: '1px solid var(--t-linen)',
                background: 'white',
              }}
            >
              {name}
            </span>
          ))}
        </div>

        {/* Distinction */}
        <p style={{
          fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.65,
          color: INK['70'], maxWidth: 340, marginBottom: 24,
        }}>
          {distinction}
        </p>
      </div>

      {/* Rarity stat */}
      <div style={{
        padding: '16px 24px', borderRadius: 14,
        background: 'white', border: '1px solid var(--t-linen)',
        maxWidth: 380,
        opacity: revealed ? 1 : 0,
        transition: 'opacity 0.7s ease 0.5s',
      }}>
        <p style={{
          fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.6,
          color: INK['55'], margin: 0, fontStyle: 'italic',
        }}>
          {rarityStat}
        </p>
      </div>
    </div>
  );
}


// ─── Card 9: Where You'd Thrive ───

function DestinationsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 200); return () => clearTimeout(t); }, []);

  if (!profile.destinations) return null;
  const { familiar, surprise } = profile.destinations;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '50vh', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: INK['45'], marginBottom: 8,
      }}>
        Where you&apos;d thrive
      </div>
      <h2 style={{
        fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
        fontWeight: 400, color: 'var(--t-ink)',
        margin: '0 0 28px',
      }}>
        Your signals point toward
      </h2>

      {/* Familiar destinations */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        marginBottom: 20, width: '100%', maxWidth: 360,
      }}>
        {familiar.map((dest, i) => (
          <div
            key={dest}
            style={{
              fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
              color: 'var(--t-ink)', padding: '14px 20px',
              borderRadius: 14, background: 'white',
              border: '1px solid var(--t-linen)',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(8px)',
              transition: `all 0.5s ease ${i * 120}ms`,
            }}
          >
            {dest}
          </div>
        ))}
      </div>

      {/* Surprise destination */}
      <div style={{
        width: '100%', maxWidth: 360,
        padding: '18px 20px', borderRadius: 14,
        background: `${T.honey}10`,
        border: `1px solid ${T.honey}30`,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: `all 0.6s ease ${familiar.length * 120 + 100}ms`,
      }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: T.honey, marginBottom: 6,
        }}>
          This one might surprise you
        </div>
        <div style={{
          fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
          color: 'var(--t-ink)', marginBottom: 6,
        }}>
          {surprise.name}
        </div>
        <p style={{
          fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.55,
          color: INK['55'], margin: 0,
        }}>
          {surprise.reason}
        </p>
      </div>
    </div>
  );
}


// ─── Final: Your Trips ───

function SeedTripsReveal({ seedTrips }: { seedTrips: SeedTripInput[] }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: INK['45'], marginBottom: 8,
        }}>
          Already started
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: '0 0 8px',
        }}>
          I&apos;ve started filling these in
        </h2>
        <p style={{
          fontFamily: FONT.sans, fontSize: 14, color: INK['50'],
          maxWidth: 320, margin: '0 auto',
        }}>
          Take a look — tell me if I&apos;m on the right track.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, margin: '0 auto' }}>
        {seedTrips.map((trip, i) => (
          <div
            key={i}
            style={{
              padding: '20px 24px', borderRadius: 16,
              background: 'white', border: '1px solid var(--t-linen)',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(16px)',
              transition: `all 0.7s ease ${i * 200}ms`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{
                  fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
                  color: 'var(--t-ink)',
                }}>
                  {trip.destination}
                </div>
                {trip.dates && (
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 12, color: INK['50'], marginTop: 2,
                  }}>
                    {trip.dates}
                  </div>
                )}
              </div>
              <span style={{
                fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
                padding: '3px 10px', borderRadius: 100,
                background: trip.status === 'planning' ? T.verde : T.honey,
                color: 'white',
              }}>
                {trip.status}
              </span>
            </div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 11, color: INK['45'],
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{trip.travelContext}</span>
              <span>·</span>
              <span>{trip.seedSource === 'onboarding_planning' ? 'upcoming' : 'dream'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
