'use client';

/**
 * Individual card components for the RevealSequence.
 *
 * Each card is a self-contained visual unit that renders one "stage"
 * of the taste dossier reveal (archetype, quote, fingerprint, etc.).
 *
 * Extracted from RevealSequence.tsx for readability and maintainability.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { GeneratedTasteProfile, SeedTripInput } from '@/types';
import { FONT, INK, TEXT } from '@/constants/theme';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import {
  BRAND, EASE_OUT_EXPO, SPRING_GENTLE, SPRING_BOUNCY,
  WaveDivider, OrgBlob, HeroSection, ContentSection, CardShell, GoldDivider,
} from './primitives';


// ─── Cover Card (replay mode) ────────────────────────────────────────────────

export function CoverReveal({ firstName }: { firstName?: string }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <CardShell>
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '72px 28px 56px', background: BRAND.navy,
        textAlign: 'center', minHeight: 360,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <OrgBlob color="rgba(255,255,255,0.03)" size={260} style={{ top: -80, right: -60 }} />
        <OrgBlob color={`${BRAND.coral}10`} size={180} style={{ bottom: -40, left: -40 }} />
        <OrgBlob color={`${BRAND.ochre}06`} size={120} style={{ top: 20, left: -30 }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <SafeFadeIn delay={0.1} direction="up" distance={10}>
            <div style={{ marginBottom: 40 }}>
              <img
                src="/brand/logo-pixellance-cream.svg"
                alt="Terrazzo"
                style={{ height: 14, width: 'auto', opacity: 0.45 }}
              />
            </div>
          </SafeFadeIn>

          <SafeFadeIn delay={0.18} direction="up" distance={20}>
            <h1 style={{
              fontFamily: FONT.serif, fontSize: 44, fontStyle: 'italic',
              fontWeight: 400, color: '#fff',
              margin: 0, lineHeight: 1.1, letterSpacing: '-0.015em',
            }}>
              {firstName ? `${firstName}\u2019s` : 'Your'}<br />Taste Dossier
            </h1>
          </SafeFadeIn>

          <SafeFadeIn delay={0.26}>
            <GoldDivider width={50} delay={0.3} />
          </SafeFadeIn>

          <SafeFadeIn delay={0.32}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 20,
            }}>
              Prepared {today}
            </div>
          </SafeFadeIn>

          <SafeFadeIn delay={0.38} direction="up" distance={10}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
              color: 'rgba(255,255,255,0.6)', marginTop: 28, maxWidth: 300,
            }}>
              We spent some time getting to know how you travel. Here&apos;s what we found.
            </div>
          </SafeFadeIn>
        </div>
      </div>
    </CardShell>
  );
}


// ─── Card 1: Archetype ───────────────────────────────────────────────────────

export function ArchetypeReveal({ profile, firstName }: { profile: GeneratedTasteProfile; firstName?: string }) {
  const greeting = firstName ? `${firstName}, you\u2019re` : "You\u2019re";

  return (
    <CardShell>
      <HeroSection bg={BRAND.coral} label="Your taste archetype" minHeight={240}>
        <SafeFadeIn delay={0.25} direction="up" distance={24} duration={0.7}>
          <h1 style={{
            fontFamily: FONT.serif, fontSize: 38, fontStyle: 'italic',
            fontWeight: 400, color: '#fff',
            margin: 0, lineHeight: 1.12,
          }}>
            {greeting} {profile.overallArchetype}
          </h1>
        </SafeFadeIn>

        <SafeFadeIn delay={0.45} direction="none" duration={0.6}>
          <div style={{
            width: 50, height: 2, margin: '20px 0',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.5), transparent)',
          }} />
        </SafeFadeIn>

        <SafeFadeIn delay={0.55} direction="up" distance={10} scale={0.9} duration={0.5}>
          <div style={{
            display: 'inline-flex', padding: '8px 20px',
            borderRadius: 100,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <span style={{
              fontFamily: FONT.sans, fontSize: 12, color: 'rgba(255,255,255,0.85)',
            }}>
              <span style={{ fontWeight: 700 }}>{profile.emotionalDriver.primary}</span>
              {' · '}
              <span style={{ opacity: 0.7 }}>{profile.emotionalDriver.secondary}</span>
            </span>
          </div>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.coral} />

      <ContentSection>
        <SafeFadeIn delay={0.65} direction="up" distance={16} duration={0.6}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.75,
            color: TEXT.primary, margin: 0, maxWidth: 380,
          }}>
            {profile.archetypeDescription}
          </p>
        </SafeFadeIn>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 2: The Quote ───────────────────────────────────────────────────────

export function QuoteReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.bestQuote) return null;

  return (
    <CardShell>
      <HeroSection bg={BRAND.coral} label="The moment that told us the most" minHeight={200}>
        <SafeFadeIn delay={0.2} direction="up" distance={20} duration={0.7}>
          <div style={{
            fontFamily: FONT.serif, fontSize: 14, color: 'rgba(255,255,255,0.5)',
            marginBottom: 12,
          }}>
            &ldquo;
          </div>
          <p style={{
            fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
            fontWeight: 400, color: '#fff',
            lineHeight: 1.4, margin: 0,
          }}>
            {profile.bestQuote.quote}
          </p>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.coral} />

      <ContentSection>
        <SafeFadeIn delay={0.6} direction="up" distance={12} duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.75,
            color: TEXT.secondary, margin: 0,
          }}>
            {profile.bestQuote.insight}
          </p>
        </SafeFadeIn>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 3: Design Language ─────────────────────────────────────────────────

export function DesignLanguageReveal({
  profile,
  mosaicAxes,
}: {
  profile: GeneratedTasteProfile;
  mosaicAxes: Record<string, number>;
}) {
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
    <CardShell>
      <HeroSection bg={BRAND.darkTeal} label="Your design language" minHeight={140}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff',
            margin: 0,
          }}>
            {profile.designInsight?.headline ?? 'How you see space'}
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.darkTeal} />

      <ContentSection padding="20px 24px 24px">
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.3 }}
        >
          {spectrums.map((spec, idx) => (
            <motion.div
              key={spec.axis}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.35 + idx * 0.08 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: TEXT.secondary,
                }}>
                  {spec.labels[0]}
                </span>
                <span style={{
                  fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: TEXT.secondary,
                }}>
                  {spec.labels[1]}
                </span>
              </div>

              <div style={{
                position: 'relative', height: 6, borderRadius: 3,
                background: INK['08'], overflow: 'hidden',
              }}>
                <motion.div
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    height: '100%', borderRadius: 3,
                    background: `linear-gradient(90deg, ${BRAND.darkTeal}70, ${BRAND.darkTeal})`,
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.round(spec.value * 100)}%` }}
                  transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.4 + idx * 0.08 }}
                />
                <motion.div
                  style={{
                    position: 'absolute', top: '50%',
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'white',
                    border: `2.5px solid ${BRAND.darkTeal}`,
                    boxShadow: `0 1px 6px ${BRAND.darkTeal}30`,
                    transform: 'translateY(-50%)',
                  }}
                  initial={{ left: '0%', opacity: 0, scale: 0 }}
                  animate={{ left: `calc(${Math.round(spec.value * 100)}% - 7px)`, opacity: 1, scale: 1 }}
                  transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.4 + idx * 0.08 }}
                />
              </div>

              {spec.note && (
                <p style={{
                  fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.55,
                  color: TEXT.secondary, marginTop: 6, marginBottom: 0,
                  fontStyle: 'italic',
                }}>
                  {spec.note}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 4: Taste Fingerprint ───────────────────────────────────────────────

export function TasteFingerprintReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const radar = profile.radarData;
  if (!radar?.length) return null;

  const sorted = [...radar].sort((a, b) => b.value - a.value);
  const top2 = sorted.slice(0, 2).map((d) => d.axis);

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 28;

  const points = radar.map((d, i) => {
    const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
    const r = d.value * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), axis: d.axis, value: d.value };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <CardShell>
      <HeroSection bg={BRAND.navy} label="Your taste fingerprint" minHeight={120}>
        <SafeFadeIn delay={0.2} direction="up" distance={12} duration={0.5}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4,
          }}>
            {radar.map((d) => (
              <span key={d.axis} style={{
                fontFamily: FONT.sans, fontSize: 12,
                fontWeight: top2.includes(d.axis) ? 700 : 400,
                color: top2.includes(d.axis) ? BRAND.ochre : 'rgba(255,255,255,0.5)',
              }}>
                {d.axis}
              </span>
            ))}
          </div>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.navy} />

      <ContentSection padding="16px 24px 28px">
        <SafeFadeIn delay={0.3} direction="none" scale={0.85} duration={0.8}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {[0.33, 0.66, 1].map((r) => (
                <circle key={r} cx={cx} cy={cy} r={maxR * r}
                  fill="none" stroke={INK['08']} strokeWidth={0.75}
                  strokeDasharray={r < 1 ? '4 4' : 'none'}
                />
              ))}
              {points.map((_, i) => (
                <line key={i} x1={cx} y1={cy}
                  x2={cx + maxR * Math.cos((Math.PI * 2 * i) / radar.length - Math.PI / 2)}
                  y2={cy + maxR * Math.sin((Math.PI * 2 * i) / radar.length - Math.PI / 2)}
                  stroke={INK['06']} strokeWidth={0.75}
                />
              ))}
              <defs>
                <linearGradient id="radarFillBrand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND.coral} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={BRAND.ochre} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <motion.path
                d={pathD}
                fill="url(#radarFillBrand)"
                stroke={BRAND.coral}
                strokeWidth={2}
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.4 }}
              />
              {points.map((p, i) => (
                <motion.circle key={i} cx={p.x} cy={p.y} r={4.5}
                  fill="white" stroke={BRAND.coral} strokeWidth={2}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...SPRING_BOUNCY, delay: 0.6 + i * 0.06 }}
                />
              ))}
            </svg>
          </div>
        </SafeFadeIn>

        <SafeFadeIn delay={0.8} direction="up" distance={10} duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
            color: TEXT.secondary, textAlign: 'center', margin: '12px 0 0',
          }}>
            <span style={{ fontWeight: 700, color: BRAND.coral }}>{top2[0]}</span>
            {' and '}
            <span style={{ fontWeight: 700, color: BRAND.coral }}>{top2[1]}</span>
            {' drive you. Most travelers lead with other dimensions — you lead with these.'}
          </p>
        </SafeFadeIn>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 5: Contradiction ───────────────────────────────────────────────────

export function ContradictionReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const c = profile.contradictions[0];
  if (!c) return null;

  return (
    <CardShell>
      <HeroSection bg={BRAND.olive} label="The interesting part" minHeight={140}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            You contain contradictions
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.olive} />

      <ContentSection padding="24px 20px 24px">
        {/* The two poles */}
        <div style={{
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
          gap: 10, marginBottom: 20,
        }}>
          <SafeFadeIn delay={0.35} direction="left" distance={24} duration={0.6}>
            <div style={{
              flex: 1,
              fontFamily: FONT.serif, fontSize: 15, fontStyle: 'italic',
              color: TEXT.primary, textAlign: 'center',
              padding: '18px 16px', borderRadius: 16,
              background: `linear-gradient(135deg, ${BRAND.coral}08, white)`,
              border: `1px solid ${BRAND.coral}20`,
            }}>
              {c.stated}
            </div>
          </SafeFadeIn>

          <SafeFadeIn delay={0.4} direction="none" scale={0.5} duration={0.4}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                fontFamily: FONT.sans, fontSize: 18, fontWeight: 300,
                color: `${BRAND.olive}50`,
              }}>
                &times;
              </span>
            </div>
          </SafeFadeIn>

          <SafeFadeIn delay={0.35} direction="right" distance={24} duration={0.6}>
            <div style={{
              flex: 1,
              fontFamily: FONT.serif, fontSize: 15, fontStyle: 'italic',
              color: TEXT.primary, textAlign: 'center',
              padding: '18px 16px', borderRadius: 16,
              background: `linear-gradient(135deg, ${BRAND.olive}06, white)`,
              border: `1px solid ${BRAND.olive}15`,
            }}>
              {c.revealed}
            </div>
          </SafeFadeIn>
        </div>

        {/* Resolution */}
        <SafeFadeIn delay={0.55} direction="up" distance={12} duration={0.6}>
          <div style={{
            padding: '22px 24px', borderRadius: 16,
            background: 'white',
            boxShadow: `0 2px 16px rgba(0,42,85,0.04)`,
            border: `1px solid ${INK['05']}`,
          }}>
            <p style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
              color: TEXT.primary, margin: 0,
            }}>
              {c.resolution}
            </p>
          </div>
        </SafeFadeIn>

        <SafeFadeIn delay={0.7} direction="none" duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 13, color: BRAND.olive,
            marginTop: 16, fontStyle: 'italic', textAlign: 'center',
          }}>
            We&apos;ll find places that understand both sides.
          </p>
        </SafeFadeIn>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 6: Observations ────────────────────────────────────────────────────

function buildObservations(signals: Record<string, string[]> | undefined | null): string[] {
  if (!signals || typeof signals !== 'object') return [];
  const observations: string[] = [];
  const entries = Object.entries(signals).filter(([, v]) => Array.isArray(v) && v.length > 0);

  const domainPhrasing: Record<string, (terms: string[]) => string> = {
    Design: (t) => `You\u2019re drawn to spaces with a ${t[0]} sensibility${t[1] ? ` \u2014 places where ${t[1]} isn\u2019t just a style, it\u2019s a point of view` : ''}.`,
    Character: (t) => `You notice the personality of a place before the amenities. You want somewhere that feels ${t[0]}.`,
    FoodDrink: (t) => `Your palate gravitates toward ${t[0]}. The dining room matters as much as the menu.`,
    Setting: () => `Neighborhood matters to you \u2014 you\u2019d rather be in the right quarter of town than the right hotel.`,
    Atmosphere: (t) => `Atmosphere is everything for you \u2014 you\u2019re tuned into ${t[0]} before you even sit down.`,
    Service: (t) => `You notice how a place makes you feel. Service that\u2019s ${t[0]} stays with you.`,
  };

  for (const [key, terms] of entries) {
    const cleaned = terms.slice(0, 2).map(t => t.replace(/-/g, ' ').toLowerCase());
    const phrasing = domainPhrasing[key];
    if (phrasing) {
      observations.push(phrasing(cleaned));
    } else {
      const label = key.replace(/[-_]/g, ' ').toLowerCase();
      observations.push(
        `In ${label}, you\u2019re drawn to ${cleaned[0]}${cleaned[1] ? ` and ${cleaned[1]}` : ''}.`
      );
    }
    if (observations.length >= 3) break;
  }

  return observations;
}

export function ObservationsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const observations = useMemo(
    () => buildObservations(profile.microTasteSignals),
    [profile.microTasteSignals],
  );

  if (!observations.length) return null;

  return (
    <CardShell>
      <HeroSection bg={BRAND.ochre} label="What we noticed" minHeight={120}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            The details that define you
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.ochre} />

      <ContentSection padding="20px 20px 24px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {observations.map((obs, i) => (
            <SafeFadeIn key={i} delay={0.35 + i * 0.1} direction="up" distance={20} duration={0.5}>
              <div style={{
                padding: '20px 22px', borderRadius: 16,
                background: 'white',
                border: `1px solid ${INK['05']}`,
                boxShadow: '0 2px 12px rgba(0,42,85,0.03)',
              }}>
                <p style={{
                  fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.7,
                  color: TEXT.primary, margin: 0,
                }}>
                  {obs}
                </p>
              </div>
            </SafeFadeIn>
          ))}
        </div>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 7: Perfect Day ─────────────────────────────────────────────────────

export function PerfectDayReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.perfectDay) return null;

  const segments = [
    { label: 'Morning', text: profile.perfectDay.morning, color: BRAND.ochre },
    { label: 'Afternoon', text: profile.perfectDay.afternoon, color: BRAND.coral },
    { label: 'Evening', text: profile.perfectDay.evening, color: BRAND.coral },
  ];

  return (
    <CardShell>
      <HeroSection bg={BRAND.coral} label="Your perfect day" minHeight={120}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            How a great day unfolds for you
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.coral} />

      <ContentSection padding="20px 20px 24px">
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          position: 'relative',
        }}>
          {/* Connecting line */}
          <div style={{
            position: 'absolute', left: 17, top: 32, bottom: 32,
            width: 2, borderRadius: 1,
            background: `linear-gradient(to bottom, ${BRAND.ochre}40, ${BRAND.coral}60, ${BRAND.coral}40)`,
            pointerEvents: 'none',
          }} />

          {segments.map((seg, idx) => (
            <SafeFadeIn key={seg.label} delay={0.35 + idx * 0.15} direction="up" distance={16} duration={0.5}>
              <div style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                padding: '18px 20px', borderRadius: 16,
                background: 'white',
                border: `1px solid ${INK['05']}`,
                boxShadow: '0 1px 8px rgba(0,42,85,0.03)',
                position: 'relative',
              }}>
                {/* Time dot */}
                <div style={{
                  width: 12, minWidth: 12, height: 12,
                  borderRadius: '50%',
                  background: seg.color,
                  marginTop: 3,
                  boxShadow: `0 2px 8px ${seg.color}30`,
                }} />
                <div>
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: seg.color, marginBottom: 6,
                  }}>
                    {seg.label}
                  </div>
                  <p style={{
                    fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
                    color: TEXT.primary, margin: 0,
                  }}>
                    {seg.text}
                  </p>
                </div>
              </div>
            </SafeFadeIn>
          ))}
        </div>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 8: How You Shift ───────────────────────────────────────────────────

export function HowYouShiftReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.howYouShift?.length) return null;

  const cardColors = [BRAND.coral, BRAND.darkTeal, BRAND.olive];

  return (
    <CardShell>
      <HeroSection bg={BRAND.darkTeal} label="How you shift" minHeight={120}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            You&apos;re not the same traveler every time
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.darkTeal} />

      <ContentSection padding="20px 20px 24px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profile.howYouShift.map((shift, idx) => {
            const accent = cardColors[idx % cardColors.length];
            return (
              <SafeFadeIn key={shift.context} delay={0.35 + idx * 0.12} direction="up" distance={16} duration={0.5}>
                <div style={{
                  padding: '20px 22px', borderRadius: 16,
                  background: 'white',
                  boxShadow: '0 2px 12px rgba(0,42,85,0.04)',
                  border: `1px solid ${INK['05']}`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* Bold left accent bar */}
                  <div style={{
                    position: 'absolute', top: 12, bottom: 12, left: 0, width: 4,
                    background: accent,
                    borderRadius: '0 2px 2px 0',
                  }} />
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{
                      fontFamily: FONT.sans, fontSize: 13, fontWeight: 700,
                      color: accent, marginBottom: 6,
                    }}>
                      {shift.context}
                    </div>
                    <p style={{
                      fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
                      color: TEXT.secondary, margin: 0,
                    }}>
                      {shift.insight}
                    </p>
                  </div>
                </div>
              </SafeFadeIn>
            );
          })}
        </div>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 9: Taste Neighbors ─────────────────────────────────────────────────

export function TasteNeighborsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.tasteNeighbors) return null;
  const { nearbyArchetypes, distinction, rarityStat } = profile.tasteNeighbors;

  return (
    <CardShell>
      <HeroSection bg={BRAND.peach} label="Your taste neighbors" minHeight={140}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            Travelers with a similar lens
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.peach} />

      <ContentSection padding="24px 24px 28px">
        {/* Nearby archetypes as pills */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10,
          justifyContent: 'center', marginBottom: 20,
        }}>
          {nearbyArchetypes.map((name, idx) => (
            <SafeFadeIn key={name} delay={0.35 + idx * 0.1} scale={0.8} direction="none" duration={0.5}>
              <span style={{
                fontFamily: FONT.serif, fontSize: 15, fontStyle: 'italic',
                color: TEXT.primary, padding: '10px 22px', borderRadius: 100,
                background: 'white',
                border: `1px solid ${BRAND.peach}25`,
                boxShadow: `0 2px 12px ${BRAND.peach}10`,
                display: 'inline-block',
              }}>
                {name}
              </span>
            </SafeFadeIn>
          ))}
        </div>

        {/* Distinction */}
        <SafeFadeIn delay={0.55} direction="up" distance={12} duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.7,
            color: TEXT.primary, margin: '0 0 20px', textAlign: 'center',
          }}>
            {distinction}
          </p>
        </SafeFadeIn>

        {/* Rarity stat */}
        <SafeFadeIn delay={0.65} scale={0.95} direction="up" distance={10} duration={0.5}>
          <div style={{
            padding: '16px 24px', borderRadius: 14,
            background: `${BRAND.peach}08`,
            border: `1px solid ${BRAND.peach}18`,
          }}>
            <p style={{
              fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.65,
              color: TEXT.secondary, margin: 0, fontStyle: 'italic', textAlign: 'center',
            }}>
              {rarityStat}
            </p>
          </div>
        </SafeFadeIn>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 10: Destinations ───────────────────────────────────────────────────

export function DestinationsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.destinations) return null;
  const { familiar, surprise } = profile.destinations;

  return (
    <CardShell>
      <HeroSection bg={BRAND.coral} label="Where you'd thrive" minHeight={120}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            Your signals point toward
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.coral} />

      <ContentSection padding="20px 20px 24px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {familiar.map((dest, idx) => (
            <SafeFadeIn key={dest} delay={0.35 + idx * 0.12} direction="up" distance={10} duration={0.5}>
              <div style={{
                fontFamily: FONT.serif, fontSize: 17, fontStyle: 'italic',
                color: TEXT.primary, padding: '14px 20px', borderRadius: 14,
                background: 'white',
                border: `1px solid ${INK['06']}`,
                boxShadow: '0 2px 10px rgba(0,42,85,0.03)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 4, height: 24, borderRadius: 2,
                  background: BRAND.coral,
                  flexShrink: 0,
                }} />
                {dest}
              </div>
            </SafeFadeIn>
          ))}
        </div>

        {/* Surprise destination */}
        <SafeFadeIn
          scale={0.95}
          delay={0.35 + familiar.length * 0.12}
          direction="up" distance={14} duration={0.6}
        >
          <div style={{
            padding: '20px 22px', borderRadius: 16,
            background: `linear-gradient(135deg, ${BRAND.ochre}10, ${BRAND.coral}08)`,
            border: `1px solid ${BRAND.ochre}30`,
            boxShadow: `0 4px 20px ${BRAND.ochre}10`,
            position: 'relative', overflow: 'hidden',
          }}>
            <OrgBlob color={`${BRAND.ochre}08`} size={80} style={{ top: -20, right: -20 }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{
                fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: BRAND.coral, marginBottom: 8,
              }}>
                ✦ This one might surprise you
              </div>
              <div style={{
                fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic',
                color: TEXT.primary, marginBottom: 8,
              }}>
                {surprise.name}
              </div>
              <p style={{
                fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.65,
                color: TEXT.secondary, margin: 0,
              }}>
                {surprise.reason}
              </p>
            </div>
          </div>
        </SafeFadeIn>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 11: Matches ────────────────────────────────────────────────────────

export function MatchesReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.matchedProperties?.length) return null;

  return (
    <CardShell>
      <HeroSection bg={BRAND.darkTeal} label="Already thinking ahead" minHeight={120}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: 0,
          }}>
            Places we&apos;d send you
          </h2>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.darkTeal} />

      <ContentSection padding="20px 20px 24px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {profile.matchedProperties.slice(0, 3).map((m, i) => (
            <SafeFadeIn key={i} delay={0.35 + i * 0.1} direction="up" distance={20} duration={0.5}>
              <div style={{
                padding: '22px 22px', borderRadius: 16,
                background: 'white',
                border: `1px solid ${INK['05']}`,
                boxShadow: '0 2px 12px rgba(0,42,85,0.04)',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Bold accent stripe */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${BRAND.darkTeal}, ${BRAND.darkTeal}40)`,
                }} />

                <div style={{
                  fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic',
                  color: TEXT.primary, marginBottom: 4, lineHeight: 1.2, marginTop: 4,
                }}>
                  {m.name}
                </div>

                <div style={{
                  fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary, marginBottom: 12,
                }}>
                  {m.location}
                </div>

                <div style={{
                  fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.6, color: TEXT.secondary,
                }}>
                  {m.matchReasons.slice(0, 2).join(' · ')}
                </div>

                {m.tensionResolved && (
                  <div style={{
                    marginTop: 14, paddingTop: 14,
                    borderTop: `1px solid ${INK['06']}`,
                    fontFamily: FONT.sans, fontSize: 12,
                    color: BRAND.darkTeal, fontStyle: 'italic',
                  }}>
                    {m.tensionResolved}
                  </div>
                )}
              </div>
            </SafeFadeIn>
          ))}
        </div>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 12: Seed Trips ─────────────────────────────────────────────────────

export function SeedTripsReveal({ seedTrips }: { seedTrips: SeedTripInput[] }) {
  return (
    <CardShell>
      <HeroSection bg={BRAND.ochre} label="Already started" minHeight={140}>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
            fontWeight: 400, color: '#fff', margin: '0 0 6px',
          }}>
            I&apos;ve started filling these in
          </h2>
        </SafeFadeIn>
        <SafeFadeIn delay={0.3} direction="up" distance={10} duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 14, color: 'rgba(255,255,255,0.7)',
            margin: 0,
          }}>
            Take a look — tell me if I&apos;m on the right track.
          </p>
        </SafeFadeIn>
      </HeroSection>

      <WaveDivider from={BRAND.ochre} />

      <ContentSection padding="20px 20px 24px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {seedTrips.map((trip, i) => (
            <SafeFadeIn key={i} delay={0.4 + i * 0.12} direction="up" distance={16} duration={0.5}>
              <div style={{
                padding: '20px 22px', borderRadius: 16,
                background: 'white',
                boxShadow: '0 2px 12px rgba(0,42,85,0.04)',
                border: `1px solid ${INK['06']}`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: trip.status === 'planning'
                    ? `linear-gradient(90deg, ${BRAND.darkTeal}, ${BRAND.darkTeal}40)`
                    : `linear-gradient(90deg, ${BRAND.ochre}, ${BRAND.ochre}40)`,
                }} />

                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 6, marginTop: 4 }}>
                  <div>
                    <div style={{
                      fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
                      color: TEXT.primary,
                    }}>
                      {trip.destination}
                    </div>
                    {trip.dates && (
                      <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary, marginTop: 3 }}>
                        {trip.dates}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
                    padding: '4px 12px', borderRadius: 100,
                    background: trip.status === 'planning' ? `${BRAND.darkTeal}12` : `${BRAND.ochre}15`,
                    color: trip.status === 'planning' ? BRAND.darkTeal : BRAND.coral,
                  }}>
                    {trip.status}
                  </span>
                </div>
                <div style={{
                  fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{trip.travelContext}</span>
                  <span style={{ color: TEXT.secondary }}>·</span>
                  <span>{trip.seedSource === 'onboarding_planning' ? 'upcoming' : 'dream'}</span>
                </div>
              </div>
            </SafeFadeIn>
          ))}
        </div>
      </ContentSection>
    </CardShell>
  );
}


// ─── Card 13: Share (replay mode) ────────────────────────────────────────────

export function ShareReveal({
  profile, onViewProfile, onShare, shareState,
}: {
  profile: GeneratedTasteProfile;
  onViewProfile: () => void;
  onShare: () => void;
  shareState: 'idle' | 'copied';
}) {
  return (
    <CardShell>
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '56px 28px 48px', background: BRAND.navy,
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 380,
      }}>
        <OrgBlob color={`${BRAND.coral}08`} size={200} style={{ top: -60, right: -50 }} />
        <OrgBlob color={`${BRAND.darkTeal}06`} size={150} style={{ bottom: -40, left: -40 }} />

        <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <GoldDivider width={40} delay={0} />

          <SafeFadeIn delay={0.1} direction="up" distance={20}>
            <h2 style={{
              fontFamily: FONT.serif, fontSize: 32, fontStyle: 'italic',
              fontWeight: 400, color: '#fff',
              margin: '24px 0 12px', lineHeight: 1.15,
            }}>
              That&apos;s your dossier
            </h2>
          </SafeFadeIn>

          <SafeFadeIn delay={0.18} direction="up" distance={10}>
            <p style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.6,
              color: 'rgba(255,255,255,0.5)', marginBottom: 36,
              maxWidth: 300, margin: '0 auto 36px',
            }}>
              We&apos;ll keep learning as you plan. Your taste profile gets sharper with every trip.
            </p>
          </SafeFadeIn>

          {/* Share button */}
          <motion.button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', maxWidth: 300,
              margin: '0 auto 12px',
              padding: '14px 24px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
              color: '#fff',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, ...SPRING_GENTLE }}
            whileHover={{ y: -2, background: 'rgba(255,255,255,0.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            <PerriandIcon name="invite" size={16} color="#fff" />
            {shareState === 'copied' ? 'Copied to clipboard!' : 'Share your dossier'}
          </motion.button>

          {/* See Full Profile */}
          <motion.button
            onClick={(e) => { e.stopPropagation(); onViewProfile(); }}
            style={{
              display: 'block',
              width: '100%', maxWidth: 300,
              margin: '0 auto 14px',
              padding: '14px 24px',
              borderRadius: 14,
              background: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
              color: BRAND.navy,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, ...SPRING_GENTLE }}
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
            whileTap={{ scale: 0.98 }}
          >
            See full profile
          </motion.button>

          {/* Footer */}
          <SafeFadeIn delay={0.4} direction="up" distance={8}>
            <div style={{ marginTop: 28 }}>
              <img
                src="/brand/logo-pixellance-cream.svg"
                alt="Terrazzo"
                style={{ height: 14, width: 'auto', opacity: 0.3 }}
              />
            </div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4,
            }}>
              Travel that matches your taste
            </div>
          </SafeFadeIn>
        </div>
      </div>
    </CardShell>
  );
}
