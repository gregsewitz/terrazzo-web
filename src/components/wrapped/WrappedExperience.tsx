'use client';

import { useState, useMemo, useCallback } from 'react';
import { TASTE_PROFILE, WRAPPED } from '@/constants/profile';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { T } from '@/types';

// ─── Props ───

interface WrappedExperienceProps {
  onClose: () => void;
}

// ─── Constants ───

const TOTAL_CARDS = 7;

// Warm editorial accent colors per card for subtle variety
const CARD_ACCENTS = [
  T.honey,    // cover
  T.verde,    // archetype
  T.amber,    // what we noticed
  '#6844a0',  // contradictions (violet)
  T.honey,    // how we'll travel
  T.verde,    // first matches
  T.honey,    // share
];

// ─── Helpers ───

/** Build editorial observation prose from micro-taste signals */
function buildObservations(signals: Record<string, string[]>): string[] {
  const observations: string[] = [];

  const design = signals['Design Language'];
  if (design?.length) {
    const terms = design.slice(0, 2).map(t => t.replace(/-/g, ' ').toLowerCase());
    observations.push(
      `You're drawn to spaces with a ${terms[0]} sensibility${terms[1] ? ` — places where ${terms[1]} isn't just a style, it's a point of view` : ''}.`
    );
  }

  const character = signals['Character & Identity'];
  if (character?.length) {
    const term = character[0].replace(/-/g, ' ').toLowerCase();
    observations.push(
      `You notice the personality of a place before the amenities. You want somewhere that feels ${term}.`
    );
  }

  const food = signals['Food & Drink'];
  if (food?.length) {
    const term = food[0].replace(/-/g, ' ').toLowerCase();
    observations.push(
      `Your palate gravitates toward ${term}. The dining room matters as much as the menu.`
    );
  }

  const location = signals['Location & Context'];
  if (location?.length) {
    observations.push(
      `Neighborhood matters to you — you'd rather be in the right quarter of town than the right hotel.`
    );
  }

  return observations.slice(0, 3);
}

/** Format context modifier as editorial vignette */
function contextVignette(
  context: string, shifts: string, firstName?: string, partnerName?: string,
): { heading: string; body: string } {
  const name = firstName || 'you';
  if (context.toLowerCase().includes('partner')) {
    const partner = partnerName || 'your partner';
    return {
      heading: `When it's ${name} & ${partner}`,
      body: shifts,
    };
  }
  if (context.toLowerCase().includes('friend')) {
    return { heading: `With friends`, body: shifts };
  }
  if (context.toLowerCase().includes('solo')) {
    return { heading: `Traveling solo`, body: shifts };
  }
  return { heading: context, body: shifts };
}

// ═══════════════════════════════════════════════════════════════════
//  CARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// ── Card 0: Cover ──

function DossierCover({ firstName }: { firstName?: string }) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Terrazzo monogram */}
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: INK['55'], marginBottom: 48,
      }}>
        Terrazzo
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: FONT.serif, fontSize: 44, fontStyle: 'italic',
        fontWeight: 400, color: 'var(--t-ink)',
        margin: 0, lineHeight: 1.1, letterSpacing: '-0.015em',
      }}>
        {firstName ? `${firstName}'s` : 'Your'}<br />Taste Dossier
      </h1>

      {/* Date line */}
      <div style={{
        fontFamily: FONT.sans, fontSize: 13, color: INK['60'],
        marginTop: 20,
      }}>
        Prepared {today}
      </div>

      {/* Decorative line */}
      <div style={{
        width: 40, height: 1, background: INK['15'],
        margin: '40px auto 0',
      }} />

      <div style={{
        fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.65,
        color: INK['70'], marginTop: 24, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto',
      }}>
        We spent some time getting to know how you travel. Here's what we found.
      </div>
    </div>
  );
}

// ── Card 1: Archetype ──

function DossierArchetype({
  archetype, description, radarData,
}: {
  archetype: string;
  description: string;
  radarData: Array<{ axis: string; value: number }>;
}) {
  // Build a subtle decorative radar polygon (not data-forward, just atmospheric)
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const points = radarData.map((d, i) => {
    const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
    const val = d.value * r;
    return `${cx + val * Math.cos(angle)},${cy + val * Math.sin(angle)}`;
  }).join(' ');

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Decorative radar shape */}
      <div style={{ margin: '0 auto 32px', opacity: 0.12 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={points} fill="var(--t-ink)" stroke="none" />
        </svg>
      </div>

      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: T.verde, marginBottom: 12,
      }}>
        Your archetype
      </div>
      <h2 style={{
        fontFamily: FONT.serif, fontSize: 38, fontStyle: 'italic',
        fontWeight: 400, color: 'var(--t-ink)',
        margin: 0, lineHeight: 1.15,
      }}>
        {archetype}
      </h2>
      <p style={{
        fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.7,
        color: INK['75'], marginTop: 20, maxWidth: 380,
        marginLeft: 'auto', marginRight: 'auto',
      }}>
        {description}
      </p>
    </div>
  );
}

// ── Card 2: What We Noticed ──

function DossierObservations({ observations }: { observations: string[] }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: T.amber, marginBottom: 12,
        }}>
          What we noticed
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: 0, lineHeight: 1.2,
        }}>
          The details that define you
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {observations.map((obs, i) => (
          <div key={i} style={{
            padding: '20px 24px',
            background: 'white',
            borderRadius: 16,
            border: '1px solid var(--t-linen)',
          }}>
            <p style={{
              fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.7,
              color: INK['85'], margin: 0,
            }}>
              {obs}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 3: Contradictions ──

function DossierContradiction({
  contradiction,
}: {
  contradiction: { stated: string; revealed: string; resolution: string };
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#6844a0', marginBottom: 12,
      }}>
        The interesting part
      </div>
      <h2 style={{
        fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
        fontWeight: 400, color: 'var(--t-ink)',
        margin: '0 0 32px', lineHeight: 1.2,
      }}>
        You contain multitudes
      </h2>

      {/* The tension */}
      <div style={{
        padding: '28px 24px',
        background: 'white',
        borderRadius: 16,
        border: '1px solid var(--t-linen)',
        textAlign: 'left',
      }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.6,
          color: INK['85'],
        }}>
          <span style={{ color: INK['55'] }}>You said you love</span>{' '}
          {contradiction.stated.toLowerCase()}
          <span style={{ color: INK['55'] }}>, but we noticed you</span>{' '}
          {contradiction.revealed.toLowerCase()}.
        </div>

        <div style={{
          marginTop: 20, paddingTop: 20,
          borderTop: '1px solid var(--t-linen)',
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: INK['55'], marginBottom: 8,
          }}>
            What this tells us
          </div>
          <p style={{
            fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.65,
            color: INK['75'], margin: 0,
          }}>
            {contradiction.resolution}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Card 4: How We'll Travel Together ──

function DossierContexts({
  contexts,
  firstName,
  partnerName,
}: {
  contexts: Array<{ context: string; shifts: string }>;
  firstName?: string;
  partnerName?: string;
}) {
  const vignettes = contexts
    .slice(0, 3)
    .map(c => contextVignette(c.context, c.shifts, firstName, partnerName));

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: T.honey, marginBottom: 12,
        }}>
          How we'll travel together
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: 0, lineHeight: 1.2,
        }}>
          Different trips, different you
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {vignettes.map((v, i) => (
          <div key={i} style={{
            padding: '20px 24px',
            background: 'white',
            borderRadius: 16,
            border: '1px solid var(--t-linen)',
          }}>
            <div style={{
              fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
              color: 'var(--t-ink)', marginBottom: 8,
            }}>
              {v.heading}
            </div>
            <p style={{
              fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.65,
              color: INK['70'], margin: 0,
            }}>
              {v.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 5: First Matches ──

function DossierMatches({
  matches,
}: {
  matches: Array<{
    name: string;
    location: string;
    matchReasons: string[];
    tensionResolved: string;
  }>;
}) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: T.verde, marginBottom: 12,
        }}>
          Already thinking ahead
        </div>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: 0, lineHeight: 1.2,
        }}>
          Places we'd send you
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {matches.slice(0, 3).map((m, i) => (
          <div key={i} style={{
            padding: '24px',
            background: 'white',
            borderRadius: 16,
            border: '1px solid var(--t-linen)',
          }}>
            <div style={{
              fontFamily: FONT.serif, fontSize: 22, fontStyle: 'italic',
              color: 'var(--t-ink)', marginBottom: 4, lineHeight: 1.2,
            }}>
              {m.name}
            </div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 12, color: INK['60'],
              marginBottom: 14,
            }}>
              {m.location}
            </div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.6,
              color: INK['80'],
            }}>
              {m.matchReasons.slice(0, 2).join(' · ')}
            </div>
            {m.tensionResolved && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: '1px solid var(--t-linen)',
                fontFamily: FONT.sans, fontSize: 12,
                color: INK['60'], fontStyle: 'italic',
              }}>
                {m.tensionResolved}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 6: Share & Continue ──

function DossierShare({
  archetype, firstName, onViewProfile, onShare, shareState,
}: {
  archetype: string;
  firstName?: string;
  onViewProfile: () => void;
  onShare: () => void;
  shareState: 'idle' | 'copied';
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      {/* Decorative line */}
      <div style={{
        width: 40, height: 1, background: INK['15'],
        margin: '0 auto 32px',
      }} />

      <h2 style={{
        fontFamily: FONT.serif, fontSize: 32, fontStyle: 'italic',
        fontWeight: 400, color: 'var(--t-ink)',
        margin: '0 0 12px', lineHeight: 1.15,
      }}>
        That's your dossier
      </h2>
      <p style={{
        fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.6,
        color: INK['60'], marginBottom: 40,
        maxWidth: 300, marginLeft: 'auto', marginRight: 'auto',
      }}>
        We'll keep learning as you plan. Your taste profile gets sharper with every trip.
      </p>

      {/* Share button */}
      <button
        onClick={(e) => { e.stopPropagation(); onShare(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', maxWidth: 320,
          margin: '0 auto 14px',
          padding: '14px 24px',
          borderRadius: 14,
          background: 'white',
          border: '1px solid var(--t-linen)',
          cursor: 'pointer',
          fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
          color: 'var(--t-ink)',
          transition: 'all 0.15s ease',
        }}
      >
        <PerriandIcon name="invite" size={16} color="var(--t-ink)" />
        {shareState === 'copied' ? 'Copied to clipboard!' : 'Share your dossier'}
      </button>

      {/* See Full Profile */}
      <button
        onClick={(e) => { e.stopPropagation(); onViewProfile(); }}
        style={{
          display: 'block',
          width: '100%', maxWidth: 320,
          margin: '0 auto 14px',
          padding: '14px 24px',
          borderRadius: 14,
          background: 'var(--t-ink)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
          color: 'var(--t-cream)',
          transition: 'opacity 0.15s ease',
        }}
      >
        See full profile
      </button>

      {/* Terrazzo footer */}
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: INK['40'], marginTop: 32,
      }}>
        Terrazzo
      </div>
      <div style={{
        fontFamily: FONT.sans, fontSize: 11,
        color: INK['45'], marginTop: 4,
      }}>
        Travel that matches your taste
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function WrappedExperience({ onClose }: WrappedExperienceProps) {
  const [currentCard, setCurrentCard] = useState(0);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const profile = TASTE_PROFILE;
  const lifeContext = useOnboardingStore(s => s.lifeContext);

  const firstName = lifeContext?.firstName || undefined;
  const partnerName = (lifeContext as Record<string, unknown>)?.partnerName as string | undefined;

  // Pre-compute editorial observations from raw signals
  const observations = useMemo(
    () => buildObservations(profile.microTasteSignals),
    [profile.microTasteSignals],
  );

  const advance = useCallback(() => {
    if (currentCard < TOTAL_CARDS - 1) setCurrentCard(c => c + 1);
  }, [currentCard]);

  const goBack = useCallback(() => {
    if (currentCard > 0) setCurrentCard(c => c - 1);
    else onClose();
  }, [currentCard, onClose]);

  const handleShare = useCallback(async () => {
    const text = [
      `My Terrazzo Taste Dossier`,
      `I'm "${profile.overallArchetype}" — ${profile.archetypeDescription.slice(0, 120)}...`,
      ``,
      `Get your own taste profile at terrazzo.travel`,
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Taste Dossier — Terrazzo', text });
        return;
      } catch { /* user cancelled or not supported */ }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch { /* clipboard not available */ }
  }, [profile]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        height: '100dvh',
        background: 'var(--t-cream)',
      }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 16px',
        flexShrink: 0,
      }}>
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: FONT.sans, fontSize: 13, color: INK['55'],
            padding: 0,
          }}
        >
          ← {currentCard === 0 ? 'Close' : 'Back'}
        </button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentCard ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentCard
                  ? CARD_ACCENTS[currentCard]
                  : i < currentCard ? INK['30'] : INK['12'],
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        <div style={{ width: 48 }} />
      </div>

      {/* Card content */}
      <div
        onClick={currentCard < TOTAL_CARDS - 1 ? advance : undefined}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 28px',
          cursor: currentCard < TOTAL_CARDS - 1 ? 'pointer' : 'default',
          maxWidth: 520, margin: '0 auto', width: '100%',
          overflowY: 'auto',
        }}
      >
        {currentCard === 0 && (
          <DossierCover firstName={firstName} />
        )}
        {currentCard === 1 && (
          <DossierArchetype
            archetype={profile.overallArchetype}
            description={profile.archetypeDescription}
            radarData={profile.radarData}
          />
        )}
        {currentCard === 2 && (
          <DossierObservations observations={observations} />
        )}
        {currentCard === 3 && profile.contradictions[0] && (
          <DossierContradiction contradiction={profile.contradictions[0]} />
        )}
        {currentCard === 4 && (
          <DossierContexts
            contexts={profile.contextModifiers}
            firstName={firstName}
            partnerName={partnerName}
          />
        )}
        {currentCard === 5 && (
          <DossierMatches matches={profile.matchedProperties} />
        )}
        {currentCard === 6 && (
          <DossierShare
            archetype={profile.overallArchetype}
            firstName={firstName}
            onViewProfile={onClose}
            onShare={handleShare}
            shareState={shareState}
          />
        )}
      </div>

      {/* Tap hint */}
      {currentCard < TOTAL_CARDS - 1 && (
        <div style={{
          paddingBottom: 32,
          textAlign: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: INK['30'],
          }}>
            Tap to continue
          </span>
        </div>
      )}
    </div>
  );
}
