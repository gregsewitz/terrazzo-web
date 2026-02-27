'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PlaceDetailContent from '@/components/PlaceDetailContent';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
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

// ─── Skeleton component shown while resolving ────────────────────────────────

function PlaceSkeleton({ name, location }: { name: string; location?: string }) {
  return (
    <div className="animate-in fade-in duration-150">
      {/* Photo placeholder */}
      <div
        className="w-full aspect-[4/3]"
        style={{
          background: 'linear-gradient(135deg, var(--t-linen) 0%, var(--t-cream) 100%)',
        }}
      />

      <div className="px-5 pt-5 pb-8 flex flex-col gap-4">
        {/* Name — shown immediately */}
        <div>
          <h1
            className="text-2xl leading-tight"
            style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
          >
            {name}
          </h1>
          {location && (
            <p className="mt-1 text-sm" style={{ color: INK['50'], fontFamily: FONT.sans }}>
              {location}
            </p>
          )}
        </div>

        {/* Shimmer bars for the rest of the content */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="h-4 rounded-full shimmer-bar" style={{ width: '60%' }} />
          <div className="h-4 rounded-full shimmer-bar" style={{ width: '80%' }} />
          <div className="h-4 rounded-full shimmer-bar" style={{ width: '45%' }} />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="h-12 rounded-xl shimmer-bar" />
          <div className="h-24 rounded-xl shimmer-bar" />
        </div>
      </div>

      <style jsx>{`
        .shimmer-bar {
          background: linear-gradient(
            90deg,
            var(--t-linen) 25%,
            rgba(255,255,255,0.6) 50%,
            var(--t-linen) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const slug = params.googlePlaceId as string;

  const [resolved, setResolved] = useState<ResolvedPlace | null>(null);
  const [resolving, setResolving] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Pending data from the discover feed (name + location, no API call yet) ──
  const [pendingName, setPendingName] = useState<string>('');
  const [pendingLocation, setPendingLocation] = useState<string>('');

  // ── Load place data ──
  useEffect(() => {
    async function load() {
      setResolving(true);
      setError(null);

      const decodedSlug = decodeURIComponent(slug);

      // 1. Check for pre-resolved hint (from usePlaceResolver with googlePlaceId)
      //    This stores { googlePlaceId, name, location } — NOT a full ResolvedPlace.
      //    We use it for the skeleton, then resolve fully in background using the ID.
      const resolveHintRaw = sessionStorage.getItem(`place_resolve_${slug}`);
      let googlePlaceIdToResolve: string | undefined;
      let nameForSkeleton = decodedSlug;
      let locationForSkeleton = '';

      if (resolveHintRaw) {
        try {
          const hint = JSON.parse(resolveHintRaw);
          googlePlaceIdToResolve = hint.googlePlaceId || slug;
          nameForSkeleton = hint.name || decodedSlug;
          locationForSkeleton = hint.location || '';
        } catch {
          // Malformed — use slug as googlePlaceId
          googlePlaceIdToResolve = slug;
        }
        sessionStorage.removeItem(`place_resolve_${slug}`);
        setPendingName(nameForSkeleton);
        setPendingLocation(locationForSkeleton);
      }

      // 2. Check for pending data from name-based fallback flow
      const pendingKey = `place_pending_${slug}`;
      const pendingRaw = sessionStorage.getItem(pendingKey);
      let nameToResolve = nameForSkeleton;
      let locationToResolve = locationForSkeleton;

      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          nameToResolve = pending.name || decodedSlug;
          locationToResolve = pending.location || '';
          setPendingName(nameToResolve);
          setPendingLocation(locationToResolve);
        } catch {
          // Malformed — fall through
        }
        sessionStorage.removeItem(pendingKey);
      } else if (!resolveHintRaw) {
        // Direct link or refresh — check if the slug looks like a Google Place ID
        // Google Place IDs start with "ChIJ" or similar patterns
        if (/^ChIJ/.test(slug) || /^[A-Za-z0-9_-]{20,}$/.test(slug)) {
          googlePlaceIdToResolve = slug;
          setPendingName(''); // We don't know the name yet
        } else {
          setPendingName(decodedSlug);
        }
      }

      // 3. Resolve in the background (detail page is already visible with skeleton)
      //    If we have a googlePlaceId (pre-resolved), pass it for direct lookup — faster & more accurate.
      try {
        const data = await apiFetch<ResolvedPlace>('/api/places/resolve', {
          method: 'POST',
          body: JSON.stringify({
            name: nameToResolve || undefined,
            location: locationToResolve || undefined,
            ...(googlePlaceIdToResolve ? { googlePlaceId: googlePlaceIdToResolve } : {}),
          }),
        });
        setResolved(data);
      } catch (err) {
        console.error('Failed to resolve place:', err);
        setError('Failed to load place details');
      } finally {
        setResolving(false);
      }
    }
    load();
  }, [slug]);

  // ── Save to library ──
  const handleSave = useCallback(async () => {
    if (!resolved || saving) return;
    setSaving(true);
    try {
      const { place: saved } = await apiFetch<{ place: { id: string } }>('/api/places/save', {
        method: 'POST',
        body: JSON.stringify({
          googlePlaceId: resolved.googlePlaceId,
          name: resolved.name,
          type: resolved.type,
          location: resolved.location,
          googleData: resolved.googleData,
          source: { type: 'url', name: 'Discover Feed' },
        }),
      });
      setResolved(prev =>
        prev ? { ...prev, savedPlaceId: saved.id, isInLibrary: true } : prev,
      );
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [resolved, saving]);

  // ── Error state (only after resolve fails) ──
  if (!resolving && (error || !resolved)) {
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

  // ── Skeleton while resolving (page is visible immediately) ──
  if (resolving && !resolved) {
    return (
      <div className="min-h-screen bg-[var(--t-cream)]">
        {isDesktop ? <DesktopNav /> : null}
        <div className={`mx-auto ${isDesktop ? 'max-w-xl pt-6 pb-16' : 'pb-24'}`}>
          <div
            className={`flex flex-col ${isDesktop ? 'rounded-2xl overflow-hidden border border-[var(--t-linen)] bg-white shadow-sm' : ''}`}
          >
            {/* Back button */}
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none"
                style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
              >
                <PerriandIcon name="arrow-left" size={18} color="white" />
              </button>
            </div>

            <PlaceSkeleton name={pendingName} location={pendingLocation} />
          </div>
        </div>
        {!isDesktop && <TabBar />}
      </div>
    );
  }

  // ── Resolved — show full detail ──
  const item = toImportedPlace(resolved!);

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
            onSave={!resolved!.isInLibrary ? handleSave : undefined}
            isPreview={!resolved!.isInLibrary}
            variant={isDesktop ? 'desktop' : 'mobile'}
          />
        </div>
      </div>

      {!isDesktop && <TabBar />}
    </div>
  );
}
