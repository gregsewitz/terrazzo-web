'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { FONT, INK } from '@/constants/theme';

interface InviteInfo {
  tripId: string;
  tripName: string;
  tripLocation: string;
  tripDestinations: string[] | null;
  invitedBy: string;
  invitedEmail: string;
  role: string;
  collaboratorId: string;
}

function JoinTripInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }

    const fetchInvite = async () => {
      try {
        const data = await apiFetch<InviteInfo>(`/api/trips/join/${token}`);
        setInvite(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invite not found or expired');
      }
      setLoading(false);
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!invite) return;
    setAccepting(true);

    try {
      await apiFetch(`/api/trips/${invite.tripId}/collaborators/${invite.collaboratorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'accepted' }),
      });
      router.push(`/trips/${invite.tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;

    try {
      await apiFetch(`/api/trips/${invite.tripId}/collaborators/${invite.collaboratorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'declined' }),
      });
      router.push('/trips');
    } catch {
      router.push('/trips');
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--t-cream)' }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: INK['15'], borderTopColor: INK['60'] }}
        />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
      >
        <div className="text-center">
          <div
            className="text-lg mb-2"
            style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}
          >
            Invite not found
          </div>
          <p
            className="text-[13px] mb-6"
            style={{ color: INK['60'], fontFamily: FONT.sans }}
          >
            {error || 'This invite may have expired or already been used.'}
          </p>
          <button
            onClick={() => router.push('/trips')}
            className="px-6 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{
              background: 'var(--t-ink)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.sans,
            }}
          >
            Go to my trips
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      <div className="w-full max-w-sm">
        {/* Trip card */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: 'white', border: '1px solid var(--t-linen)' }}
        >
          <div
            className="text-[10px] font-semibold mb-3"
            style={{
              color: 'var(--t-verde)',
              fontFamily: FONT.mono,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            You&apos;re invited to collaborate
          </div>

          <div
            className="text-xl mb-1"
            style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
          >
            {invite.tripName}
          </div>

          <div
            className="text-[13px] mb-4"
            style={{ color: INK['60'], fontFamily: FONT.sans }}
          >
            {invite.tripLocation}
            {invite.tripDestinations && invite.tripDestinations.length > 1 && (
              <span> &middot; {invite.tripDestinations.length} destinations</span>
            )}
          </div>

          <div
            className="text-[12px] leading-relaxed"
            style={{ color: INK['70'], fontFamily: FONT.sans }}
          >
            <strong style={{ color: 'var(--t-ink)' }}>{invite.invitedBy}</strong> invited you
            as a <strong style={{ color: 'var(--t-ink)' }}>{invite.role}</strong>.
            {invite.role === 'suggester' ? (
              <span> You&apos;ll be able to suggest places, react to the itinerary, and leave notes.</span>
            ) : (
              <span> You&apos;ll be able to view the full itinerary.</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-3.5 rounded-xl text-[14px] font-semibold transition-all"
            style={{
              background: 'var(--t-verde)',
              color: 'white',
              border: 'none',
              cursor: accepting ? 'default' : 'pointer',
              fontFamily: FONT.sans,
              opacity: accepting ? 0.7 : 1,
            }}
          >
            {accepting ? 'Joining...' : 'Join Trip'}
          </button>
          <button
            onClick={handleDecline}
            className="w-full py-3 rounded-xl text-[13px] font-medium"
            style={{
              background: 'transparent',
              color: INK['50'],
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.sans,
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinTripPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--t-cream)' }}
        >
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: INK['15'], borderTopColor: INK['60'] }}
          />
        </div>
      }
    >
      <JoinTripInner />
    </Suspense>
  );
}
