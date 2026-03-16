'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import PropertyReactionCard from './PropertyReactionCard';
import type { PropertyExemplar, TasteDomain, PropertyAnchor } from '@/types';
import { T } from '@/types';
import { FONT, INK, COLOR } from '@/constants/theme';
import { apiFetch } from '@/lib/api-client';

interface PropertyReactionPhaseViewProps {
  onComplete: () => void;
  /** Which taste domains to target — fetches exemplar properties for these */
  targetDomains?: TasteDomain[];
  /** Number of property cards to show (default: 10) */
  cardCount?: number;
  /** Where to source properties: 'db' (PlaceIntelligence) or 'email' (parsed email history) */
  source?: 'db' | 'email';
}

/** Response shape from the domain-gap-check endpoint */
interface GapCheckResponse {
  exemplars: { domain: string; exemplar: PropertyExemplar }[];
}

/** Response shape from the email-places endpoint */
interface EmailPlacesResponse {
  places: (PropertyExemplar & { reservationId: string; provider?: string; visitDate?: string | null })[];
  total: number;
  scanComplete: boolean;
}

export default function PropertyReactionPhaseView({
  onComplete,
  targetDomains,
  cardCount = 10,
  source = 'db',
}: PropertyReactionPhaseViewProps) {
  const addPropertyAnchors = useOnboardingStore((s) => s.addPropertyAnchors);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);
  const allSignals = useOnboardingStore((s) => s.allSignals);
  const propertyAnchors = useOnboardingStore((s) => s.propertyAnchors);

  const [exemplars, setExemplars] = useState<{ domain: string; exemplar: PropertyExemplar }[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reactedCount, setReactedCount] = useState(0);

  // Visible exemplars (filtering out dismissed)
  const visibleExemplars = exemplars.filter(
    (item) => !dismissedIds.has(item.exemplar.googlePlaceId)
  );

  // Fetch exemplar properties — from email history or PlaceIntelligence DB
  useEffect(() => {
    let cancelled = false;

    async function fetchExemplars() {
      try {
        setLoading(true);
        setError(null);

        if (source === 'email') {
          // ── Email-sourced: past hotels & restaurants from Gmail ──
          const result = await apiFetch<EmailPlacesResponse>('/api/onboarding/email-places');

          if (!cancelled && result?.places?.length) {
            setExemplars(
              result.places.slice(0, cardCount).map((p) => ({
                domain: p.placeType === 'hotel' ? 'Geography' : 'FoodDrink',
                exemplar: {
                  googlePlaceId: p.googlePlaceId,
                  propertyName: p.propertyName,
                  placeType: p.placeType,
                  locationHint: p.locationHint,
                  domainScore: p.domainScore,
                },
              }))
            );
          } else if (!cancelled) {
            // No email places found — auto-skip this phase
            setExemplars([]);
          }
        } else {
          // ── DB-sourced: PlaceIntelligence vector search ──
          const result = await apiFetch<GapCheckResponse>('/api/onboarding/domain-gap-check', {
            method: 'POST',
            body: JSON.stringify({
              signals: allSignals,
              radarData: [],
              existingAnchorIds: propertyAnchors.map((a) => a.googlePlaceId),
              targetDomains: targetDomains ?? undefined,
              maxExemplars: cardCount,
            }),
          });

          if (!cancelled && result?.exemplars) {
            setExemplars(result.exemplars.slice(0, cardCount));
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[property-reactions] Failed to fetch exemplars:', err);
          setError('Could not load properties — tap Continue to skip');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchExemplars();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — signals are stable at this point

  // Dismiss a card (remove from view without rating)
  const handleDismiss = useCallback((googlePlaceId: string) => {
    setDismissedIds((prev) => new Set(prev).add(googlePlaceId));
  }, []);

  // Auto-complete when all cards have been dismissed
  useEffect(() => {
    if (!loading && visibleExemplars.length === 0 && exemplars.length > 0) {
      setCurrentPhaseProgress(1);
      const t = setTimeout(onComplete, 300);
      return () => clearTimeout(t);
    }
  }, [loading, visibleExemplars.length, exemplars.length, setCurrentPhaseProgress, onComplete]);

  const handleReact = useCallback((
    googlePlaceId: string,
    sentiment: string,
    blendWeight: number,
    propertyName: string,
    placeType: string | null,
  ) => {
    // Store as a property anchor
    const anchor: PropertyAnchor = {
      googlePlaceId,
      propertyName,
      placeType: placeType ?? undefined,
      sentiment: sentiment as PropertyAnchor['sentiment'],
      blendWeight,
      sourcePhaseId: source === 'email' ? 'email-history-reaction' : 'onboarding-reaction',
      hasEmbedding: false, // Will be resolved by backend
      resolvedAt: new Date().toISOString(),
    };
    addPropertyAnchors([anchor]);

    const newCount = reactedCount + 1;
    setReactedCount(newCount);

    const totalActive = visibleExemplars.length;
    setCurrentPhaseProgress(newCount / Math.max(1, totalActive));

    // Auto-complete when all visible cards reacted to
    if (newCount >= totalActive) {
      setCurrentPhaseProgress(1);
      setTimeout(onComplete, 600);
    }
  }, [reactedCount, visibleExemplars.length, addPropertyAnchors, setCurrentPhaseProgress, onComplete, source]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        flex: 1,
      }}>
        <div style={{
          width: 28,
          height: 28,
          border: `2px solid ${COLOR.peach}`,
          borderTopColor: COLOR.navy,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{
          marginTop: 16,
          fontSize: 14,
          color: COLOR.navy,
          fontFamily: FONT.sans,
        }}>
          Finding properties for you…
        </p>
      </div>
    );
  }

  // Email source: no places found — auto-skip gracefully
  if (!loading && source === 'email' && exemplars.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        flex: 1,
        gap: 16,
      }}>
        <p style={{
          fontSize: 14,
          color: COLOR.navy,
          fontFamily: FONT.sans,
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.5,
        }}>
          No past stays or restaurants found yet — your email is still being scanned in the background.
        </p>
        <button
          onClick={onComplete}
          className="btn-hover"
          style={{
            padding: '12px 32px',
            background: COLOR.navy,
            color: COLOR.cream,
            border: 'none',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  // Error or empty state — allow skip
  if (error || exemplars.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        flex: 1,
        gap: 16,
      }}>
        <p style={{
          fontSize: 14,
          color: COLOR.navy,
          fontFamily: FONT.sans,
          textAlign: 'center',
        }}>
          {error || 'No properties to show right now'}
        </p>
        <button
          onClick={onComplete}
          className="btn-hover"
          style={{
            padding: '12px 32px',
            background: COLOR.navy,
            color: COLOR.cream,
            border: 'none',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </div>
    );
  }

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
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Progress indicator */}
        <p style={{
          fontSize: 12,
          color: COLOR.navy,
          fontFamily: FONT.mono,
          textAlign: 'center',
          marginBottom: 16,
          letterSpacing: '0.04em',
        }}>
          {reactedCount} / {visibleExemplars.length}
        </p>

        {/* Property cards */}
        {visibleExemplars.map((item, i) => (
          <div
            key={item.exemplar.googlePlaceId}
            style={{
              animation: `fadeInUp 0.4s ease ${i * 0.05}s both`,
            }}
          >
            <PropertyReactionCard
              exemplar={item.exemplar}
              domain={item.domain}
              onReact={handleReact}
              onDismiss={source === 'email' ? handleDismiss : undefined}
            />
          </div>
        ))}

        {/* Skip remaining button (shows after 3+ reactions) */}
        {reactedCount >= 3 && reactedCount < visibleExemplars.length && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => {
                setCurrentPhaseProgress(1);
                onComplete();
              }}
              className="btn-hover"
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: COLOR.navy,
                border: `1px solid rgba(0,42,85,0.1)`,
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT.sans,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              That&apos;s enough — continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
