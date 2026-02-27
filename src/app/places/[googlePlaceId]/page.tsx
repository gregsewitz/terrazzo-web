'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PlaceDetailContent from '@/components/PlaceDetailContent';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useAuth } from '@/context/AuthContext';
import { FONT, INK } from '@/constants/theme';
import type { ImportedPlace, PlaceType, GooglePlaceData } from '@/types';

// ─── Types for the resolve API response ──────────────────────────────────────

interface ResolvedPlace {
  googlePlaceId: string;
  name: string;
  location: string | null;
  type: string;
  googleData: {
    address?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    priceLevel?: string | null;
    hours?: string[] | null;
    photoUrl?: string | null;
    website?: string | null;
    phone?: string | null;
    lat?: number | null;
    lng?: number | null;
    category?: string | null;
  };
  savedPlaceId: string | null;
  isInLibrary: boolean;
  matchScore: number | null;
  matchBreakdown: Record<string, number> | null;
  tasteNote: string | null;
  intelligenceId: string | null;
  intelligenceStatus: string;
}

/**
 * Convert a resolved place into the ImportedPlace shape expected by PlaceDetailContent.
 */
function toImportedPlace(resolved: ResolvedPlace): ImportedPlace {
  const g = resolved.googleData;
  const priceNum = g.priceLevel ? g.priceLevel.length : undefined;

  const google: GooglePlaceData = {
    placeId: resolved.googlePlaceId,
    address: g.address || undefined,
    rating: g.rating || undefined,
    reviewCount: g.reviewCount || undefined,
    category: g.category || undefined,
    priceLevel: priceNum,
    hours: g.hours || undefined,
    photoUrl: g.photoUrl || undefined,
    website: g.website || undefined,
    phone: g.phone || undefined,
    lat: g.lat || undefined,
    lng: g.lng || undefined,
  };

  return {
    id: resolved.savedPlaceId || `discover-${resolved.googlePlaceId}`,
    name: resolved.name,
    type: (resolved.type || 'activity') as PlaceType,
    location: resolved.location || '',
    source: { type: 'url', name: 'Discover' },
    matchScore: resolved.matchScore || 0,
    matchBreakdown: (resolved.matchBreakdown || {}) as ImportedPlace['matchBreakdown'],
    tasteNote: resolved.tasteNote || '',
    google,
    status: 'available',
    ghostSource: 'terrazzo',
  };
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const googlePlaceId = params.googlePlaceId as string;

  const [resolved, setResolved] = useState<ResolvedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load place data ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Check sessionStorage for pre-resolved data from discover click
        const cached = sessionStorage.getItem(`place_resolve_${googlePlaceId}`);
        if (cached) {
          setResolved(JSON.parse(cached));
          sessionStorage.removeItem(`place_resolve_${googlePlaceId}`);
          setLoading(false);
          return;
        }

        // No cached data — resolve by searching with the googlePlaceId as the name
        // This handles direct links / refreshes
        const res = await fetch('/api/places/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: decodeURIComponent(googlePlaceId), location: '' }),
        });

        if (!res.ok) {
          setError('Place not found');
          return;
        }

        setResolved(await res.json());
      } catch (err) {
        console.error('Failed to load place:', err);
        setError('Failed to load place details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [googlePlaceId]);

  // ── Save to library ──
  const handleSave = useCallback(async () => {
    if (!resolved || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/places/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googlePlaceId: resolved.googlePlaceId,
          name: resolved.name,
          type: resolved.type,
          location: resolved.location,
          googleData: resolved.googleData,
          source: { type: 'url', name: 'Discover Feed' },
        }),
      });
      if (res.ok) {
        const { place: saved } = await res.json();
        setResolved(prev =>
          prev ? { ...prev, savedPlaceId: saved.id, isInLibrary: true } : prev,
        );
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [resolved, saving]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--t-cream)]">
        {isDesktop ? <DesktopNav /> : null}
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--t-honey)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: INK['50'], fontFamily: FONT.sans }}>
              Loading place details...
            </p>
          </div>
        </div>
        {!isDesktop && <TabBar />}
      </div>
    );
  }

  // ── Error state ──
  if (error || !resolved) {
    return (
      <div className="min-h-screen bg-[var(--t-cream)]">
        {isDesktop ? <DesktopNav /> : null}
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <PerriandIcon name="location" size={32} color={INK['30']} />
            <p className="text-base" style={{ color: INK['70'], fontFamily: FONT.sans }}>
              {error || "Couldn't find this place"}
            </p>
            <button
              onClick={() => router.back()}
              className="px-5 py-2 rounded-full text-sm border-none cursor-pointer"
              style={{ background: 'var(--t-ink)', color: 'var(--t-cream)', fontFamily: FONT.sans }}
            >
              Go back
            </button>
          </div>
        </div>
        {!isDesktop && <TabBar />}
      </div>
    );
  }

  const item = toImportedPlace(resolved);

  return (
    <div className="min-h-screen bg-[var(--t-cream)]">
      {isDesktop ? <DesktopNav /> : null}

      <div className={`mx-auto ${isDesktop ? 'max-w-xl pt-6 pb-16' : 'pb-24'}`}>
        <div
          className={`flex flex-col ${isDesktop ? 'rounded-2xl overflow-hidden border border-[var(--t-linen)] bg-white shadow-sm' : ''}`}
        >
          <PlaceDetailContent
            item={item}
            onClose={() => router.back()}
            onSave={!resolved.isInLibrary ? handleSave : undefined}
            isPreview={!resolved.isInLibrary}
            variant={isDesktop ? 'desktop' : 'mobile'}
          />
        </div>
      </div>

      {!isDesktop && <TabBar />}
    </div>
  );
}
