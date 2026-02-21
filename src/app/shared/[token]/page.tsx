'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// ─── Types for shared data ───

interface SharedPlace {
  id: string;
  name: string;
  type: string;
  location: string | null;
  matchScore: number | null;
  tasteNote: string | null;
  enrichment: Record<string, unknown> | null;
  whatToOrder: string[] | null;
  tips: string[] | null;
  googleData: Record<string, unknown> | null;
  ghostSource: string | null;
  friendAttribution: Record<string, unknown> | null;
  rating: { reaction?: string; personalNote?: string } | null;
  terrazzoInsight: { why?: string; caveat?: string } | null;
}

interface SharedShortlistData {
  type: 'shortlist';
  ownerName: string;
  permission: string;
  data: {
    shortlist: {
      id: string;
      name: string;
      description: string | null;
      emoji: string;
      placeCount: number;
    };
    places: SharedPlace[];
  };
}

interface SharedTripData {
  type: 'trip';
  ownerName: string;
  permission: string;
  data: {
    trip: {
      id: string;
      name: string;
      location: string;
      destinations: string[] | null;
      startDate: string | null;
      endDate: string | null;
      groupSize: number | null;
      groupType: string | null;
      days: Array<{
        dayNumber: number;
        destination?: string;
        slots: Array<{
          id: string;
          label: string;
          time: string;
          placed?: { name: string; type: string; location?: string };
        }>;
      }>;
      status: string;
    };
  };
}

type SharedData = SharedShortlistData | SharedTripData;

const TYPE_ICONS: Record<string, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  bar: 'bar',
  cafe: 'cafe',
  museum: 'museum',
  activity: 'activity',
  neighborhood: 'location',
  shop: 'shop',
};

const THUMB_GRADIENTS: Record<string, string> = {
  restaurant: 'linear-gradient(135deg, #d8c8ae, #c0ab8e)',
  hotel: 'linear-gradient(135deg, #d0c8d8, #b8b0c0)',
  bar: 'linear-gradient(135deg, #c0d0c8, #a8c0b0)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0)',
};

export default function SharedViewPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const token = params.token as string;

  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedIndividual, setSavedIndividual] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/shared/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Not found' }));
          setError(body.error || 'This link is no longer available');
          return;
        }
        const result = await res.json();
        setData(result);
      } catch {
        setError('Unable to load shared content');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const saveAllToLibrary = useCallback(async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/shared/${token}`);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/shared/${token}/save`, {
        method: 'POST',
        body: JSON.stringify({ saveAll: true, createShortlist: true }),
      });
      setSaved(true);
    } catch {
      // show error inline
    }
    setSaving(false);
  }, [isAuthenticated, token, router]);

  const saveSinglePlace = useCallback(async (placeId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/shared/${token}`);
      return;
    }
    try {
      await apiFetch(`/api/shared/${token}/save`, {
        method: 'POST',
        body: JSON.stringify({ placeIds: [placeId] }),
      });
      setSavedIndividual(prev => new Set(prev).add(placeId));
    } catch {
      // ignore
    }
  }, [isAuthenticated, token, router]);

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <div className="text-center">
          <div
            className="inline-block w-6 h-6 rounded-full border-2 animate-spin mb-3"
            style={{ borderColor: INK['15'], borderTopColor: INK['60'] }}
          />
          <p className="text-[12px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8" style={{ background: 'var(--t-cream)' }}>
        <div className="text-center">
          <PerriandIcon name="close" size={32} color={INK['20']} />
          <p className="text-[14px] mt-3" style={{ color: INK['70'], fontFamily: FONT.serif, fontStyle: 'italic' }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-[11px] cursor-pointer"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none', fontFamily: FONT.mono }}
          >
            Go to Terrazzo →
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ─── Shared Shortlist View ───
  if (data.type === 'shortlist') {
    const { shortlist, places } = data.data;
    const isPerriandIcon = shortlist.emoji && !shortlist.emoji.match(/[\u{1F000}-\u{1FFFF}]/u) && shortlist.emoji.length > 2;

    return (
      <div className="min-h-screen pb-24" style={{ background: 'var(--t-cream)', maxWidth: 640, margin: '0 auto' }}>
        <div className="px-4 pt-6">
          {/* Terrazzo branding */}
          <div className="text-center mb-6">
            <span
              style={{ fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic', color: 'var(--t-ink)', letterSpacing: -0.5 }}
            >
              Terrazzo
            </span>
          </div>

          {/* Collection header */}
          <div className="text-center mb-6">
            <div className="mb-2">
              {isPerriandIcon ? (
                <PerriandIcon name={shortlist.emoji as PerriandIconName} size={28} color={INK['50']} />
              ) : (
                <span style={{ fontSize: 28 }}>{shortlist.emoji || '✨'}</span>
              )}
            </div>
            <h1
              style={{ fontFamily: FONT.serif, fontSize: 22, fontStyle: 'italic', color: 'var(--t-ink)', marginBottom: 4 }}
            >
              {shortlist.name}
            </h1>
            <p className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>
              Shared by {data.ownerName} · {places.length} place{places.length !== 1 ? 's' : ''}
            </p>
            {shortlist.description && (
              <p className="text-[12px] mt-2 mx-4" style={{ color: INK['60'], fontFamily: FONT.sans }}>
                {shortlist.description}
              </p>
            )}
          </div>

          {/* Save all button */}
          {places.length > 0 && !saved && (
            <button
              onClick={saveAllToLibrary}
              disabled={saving}
              className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 mb-5"
              style={{
                background: 'var(--t-verde)',
                color: 'white',
                border: 'none',
                fontFamily: FONT.sans,
                opacity: saving ? 0.7 : 1,
              }}
            >
              <PerriandIcon name="saved" size={14} color="white" />
              {saving ? 'Saving...' : isAuthenticated ? 'Save all to my library' : 'Sign in to save to library'}
            </button>
          )}

          {saved && (
            <div
              className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 mb-5"
              style={{
                background: 'rgba(42,122,86,0.08)',
                color: 'var(--t-verde)',
                border: '1px solid rgba(42,122,86,0.2)',
                fontFamily: FONT.sans,
              }}
            >
              <PerriandIcon name="check" size={14} color="var(--t-verde)" />
              Saved to your library!
            </div>
          )}

          {/* Place cards */}
          <div className="flex flex-col gap-2.5">
            {places.map(place => (
              <SharedPlaceCard
                key={place.id}
                place={place}
                isSaved={savedIndividual.has(place.id) || saved}
                onSave={() => saveSinglePlace(place.id)}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>

          {places.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[12px]" style={{ color: INK['50'] }}>This collection is empty</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Shared Trip View ───
  if (data.type === 'trip') {
    const { trip } = data.data;
    const days = (trip.days || []) as Array<{
      dayNumber: number;
      destination?: string;
      slots: Array<{
        id: string;
        label: string;
        time: string;
        placed?: { name: string; type: string; location?: string };
      }>;
    }>;

    return (
      <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 640, margin: '0 auto' }}>
        <div className="px-4 pt-6">
          {/* Terrazzo branding */}
          <div className="text-center mb-6">
            <span
              style={{ fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic', color: 'var(--t-ink)', letterSpacing: -0.5 }}
            >
              Terrazzo
            </span>
          </div>

          {/* Trip header */}
          <div className="text-center mb-6">
            <h1
              style={{ fontFamily: FONT.serif, fontSize: 22, fontStyle: 'italic', color: 'var(--t-ink)', marginBottom: 4 }}
            >
              {trip.name}
            </h1>
            <p className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>
              Shared by {data.ownerName} · {trip.location}
            </p>
            {trip.startDate && (
              <p className="text-[10px] mt-1" style={{ color: INK['40'], fontFamily: FONT.mono }}>
                {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {trip.endDate && ` – ${new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </p>
            )}
          </div>

          {/* Day-by-day itinerary */}
          {days.map(day => (
            <div key={day.dayNumber} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: INK['40'], fontFamily: FONT.mono }}
                >
                  Day {day.dayNumber}
                </span>
                {day.destination && (
                  <span className="text-[10px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
                    {day.destination}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {day.slots.map(slot => (
                  <div
                    key={slot.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: slot.placed ? 'white' : 'transparent',
                      border: slot.placed ? '1px solid var(--t-linen)' : '1px dashed var(--t-linen)',
                    }}
                  >
                    <div
                      className="text-[9px] font-medium uppercase tracking-wider w-16 flex-shrink-0"
                      style={{ color: INK['40'], fontFamily: FONT.mono }}
                    >
                      {slot.label}
                    </div>
                    {slot.placed ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: THUMB_GRADIENTS[slot.placed.type] || THUMB_GRADIENTS.restaurant,
                          }}
                        >
                          <PerriandIcon
                            name={TYPE_ICONS[slot.placed.type] || 'location'}
                            size={12}
                            color={INK['70']}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium truncate" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                            {slot.placed.name}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px]" style={{ color: INK['20'], fontFamily: FONT.sans }}>
                        Open
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {days.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[12px]" style={{ color: INK['50'] }}>No itinerary yet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}


// ─── Shared Place Card ───

function SharedPlaceCard({ place, isSaved, onSave, isAuthenticated }: {
  place: SharedPlace;
  isSaved: boolean;
  onSave: () => void;
  isAuthenticated: boolean;
}) {
  const typeIcon = TYPE_ICONS[place.type] || 'location';
  const google = place.googleData as { rating?: number; priceLevel?: number } | null;
  const priceStr = google?.priceLevel ? '$'.repeat(google.priceLevel) : null;
  const subtitle = (place.rating?.personalNote)
    || (place.terrazzoInsight?.why)
    || place.tasteNote
    || '';
  const truncSub = subtitle.length > 90 ? subtitle.slice(0, 87) + '…' : subtitle;

  return (
    <div
      className="rounded-xl overflow-hidden card-hover"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
      }}
    >
      <div className="flex gap-2.5 p-3 pb-0">
        {/* Thumbnail */}
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: 44, height: 44,
            background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
          }}
        >
          <PerriandIcon name={typeIcon} size={18} color={INK['70']} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                {place.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['70'] }}>
                  {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
                </span>
                {place.location && (
                  <span style={{ fontSize: 10, color: INK['70'] }}>· {place.location.split(',')[0]}</span>
                )}
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={onSave}
              disabled={isSaved}
              className="text-[9px] px-2 py-1 rounded-full cursor-pointer flex items-center gap-1 flex-shrink-0 transition-all"
              style={{
                background: isSaved ? 'rgba(42,122,86,0.08)' : INK['04'],
                color: isSaved ? 'var(--t-verde)' : INK['60'],
                border: isSaved ? '1px solid rgba(42,122,86,0.2)' : '1px solid transparent',
                fontFamily: FONT.mono,
                fontWeight: 600,
              }}
            >
              {isSaved ? (
                <><PerriandIcon name="check" size={8} color="var(--t-verde)" /> Saved</>
              ) : (
                <><PerriandIcon name="saved" size={8} color={INK['50']} /> Save</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {google?.rating && (
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'], display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PerriandIcon name="star" size={10} color={INK['50']} /> {google.rating}
            </span>
          )}
          {priceStr && (
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'] }}>
              {priceStr}
            </span>
          )}
          {place.matchScore && (
            <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 600, color: '#8a6a2a' }}>
              {place.matchScore}%
            </span>
          )}
        </div>

        {truncSub && (
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            color: INK['60'],
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {truncSub}
          </div>
        )}

        {/* What to order */}
        {place.whatToOrder && place.whatToOrder.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(place.whatToOrder as string[]).slice(0, 3).map((item, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(232,112,128,0.06)', color: 'var(--t-royere-pink)', fontFamily: FONT.mono }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
