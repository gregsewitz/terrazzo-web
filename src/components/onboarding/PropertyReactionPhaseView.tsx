'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import PropertyReactionCard from './PropertyReactionCard';
import type { PropertyExemplar, TasteDomain, PropertyAnchor } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';
import { apiFetch } from '@/lib/api-client';

interface PropertyReactionPhaseViewProps {
  onComplete: () => void;
  /** Which taste domains to target — fetches exemplar properties for these */
  targetDomains?: TasteDomain[];
  /** Number of property cards to show (default: 10) */
  cardCount?: number;
}

/** Response shape from the domain-gap-check endpoint */
interface GapCheckResponse {
  exemplars: { domain: string; exemplar: PropertyExemplar }[];
}

export default function PropertyReactionPhaseView({
  onComplete,
  targetDomains,
  cardCount = 10,
}: PropertyReactionPhaseViewProps) {
  const addPropertyAnchors = useOnboardingStore((s) => s.addPropertyAnchors);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);
  const allSignals = useOnboardingStore((s) => s.allSignals);
  const propertyAnchors = useOnboardingStore((s) => s.propertyAnchors);

  const [exemplars, setExemplars] = useState<{ domain: string; exemplar: PropertyExemplar }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reactedCount, setReactedCount] = useState(0);

  // Fetch exemplar properties for target domains
  useEffect(() => {
    let cancelled = false;

    async function fetchExemplars() {
      try {
        setLoading(true);
        setError(null);

        const result = await apiFetch<GapCheckResponse>('/api/onboarding/domain-gap-check', {
          method: 'POST',
          body: JSON.stringify({
            signals: allSignals,
            // No radarData yet (Act 0) — endpoint should handle gracefully
            radarData: [],
            existingAnchorIds: propertyAnchors.map((a) => a.googlePlaceId),
            targetDomains: targetDomains ?? undefined,
            maxExemplars: cardCount,
          }),
        });

        if (!cancelled && result?.exemplars) {
          setExemplars(result.exemplars.slice(0, cardCount));
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
      sourcePhaseId: 'onboarding-reaction',
      hasEmbedding: false, // Will be resolved by backend
      resolvedAt: new Date().toISOString(),
    };
    addPropertyAnchors([anchor]);

    const newCount = reactedCount + 1;
    setReactedCount(newCount);
    setCurrentPhaseProgress(newCount / Math.max(1, exemplars.length));

    // Auto-complete when all cards reacted to
    if (newCount >= exemplars.length) {
      setCurrentPhaseProgress(1);
      setTimeout(onComplete, 600);
    }
  }, [reactedCount, exemplars.length, addPropertyAnchors, setCurrentPhaseProgress, onComplete]);

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
          border: `2px solid ${T.travertine}`,
          borderTopColor: T.ink,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{
          marginTop: 16,
          fontSize: 14,
          color: INK['45'],
          fontFamily: FONT.sans,
        }}>
          Finding properties for you…
        </p>
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
          color: INK['50'],
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
            background: T.ink,
            color: T.cream,
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
          color: INK['40'],
          fontFamily: FONT.mono,
          textAlign: 'center',
          marginBottom: 16,
          letterSpacing: '0.04em',
        }}>
          {reactedCount} / {exemplars.length}
        </p>

        {/* Property cards */}
        {exemplars.map((item, i) => (
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
            />
          </div>
        ))}

        {/* Skip remaining button (shows after 3+ reactions) */}
        {reactedCount >= 3 && reactedCount < exemplars.length && (
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
                color: INK['45'],
                border: `1px solid rgba(28,26,23,0.1)`,
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
