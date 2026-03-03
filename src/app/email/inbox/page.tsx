'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FONT, INK } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { apiFetch } from '@/lib/api-client';
import type { PerriandIconName } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StagedReservation {
  id: string;
  status: 'pending' | 'confirmed' | 'dismissed';
  placeName: string;
  placeType: string;
  location: string | null;
  reservationDate: string | null;
  reservationTime: string | null;
  partySize: number | null;
  confirmationNumber: string | null;
  provider: string | null;
  flightNumber: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  activityDetails: string | null;
  confidence: number;
  matchedTripName: string | null;
  suggestedDayNumber: number | null;
  emailFrom: string;
  emailSubject: string;
  emailDate: string;
  createdAt: string;
}

type FilterTab = 'pending' | 'confirmed' | 'dismissed' | 'all';

const TYPE_ICONS: Record<string, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  flight: 'transport',
  activity: 'activity',
  bar: 'bar',
  cafe: 'cafe',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function StagingInboxPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<StagedReservation[]>([]);
  const [counts, setCounts] = useState({ pending: 0, confirmed: 0, dismissed: 0 });
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReservations = useCallback(async (status: FilterTab) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ reservations: StagedReservation[]; counts: typeof counts }>(`/api/email/reservations?status=${status}`);
      setReservations(data.reservations || []);
      setCounts(data.counts || { pending: 0, confirmed: 0, dismissed: 0 });
    } catch (err) {
      console.error('Failed to fetch reservations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations(activeTab);
  }, [activeTab, fetchReservations]);

  const handleAction = async (id: string, action: 'confirm' | 'dismiss') => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/email/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      // Refresh the list
      await fetchReservations(activeTab);
    } catch (err) {
      console.error(`Failed to ${action} reservation:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--t-parchment)', fontFamily: FONT.sans }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 pt-14 pb-3" style={{ background: 'var(--t-parchment)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="bg-transparent border-none cursor-pointer p-1"
            style={{ color: 'var(--t-ink)' }}
          >
            <PerriandIcon name="arrow-left" size={16} color="var(--t-ink)" />
          </button>
          <h1 className="text-[18px] font-semibold m-0" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
            Email Reservations
          </h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border-none cursor-pointer transition-all"
              style={{
                background: activeTab === key ? 'var(--t-ink)' : INK['06'],
                color: activeTab === key ? 'var(--t-parchment)' : INK['60'],
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: activeTab === key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                    color: activeTab === key ? 'var(--t-parchment)' : INK['40'],
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-[12px]" style={{ color: INK['40'] }}>Loading…</span>
          </div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PerriandIcon name="email" size={32} color={INK['20']} />
            <p className="text-[13px] mt-3 mb-1" style={{ color: INK['50'] }}>
              {activeTab === 'pending' ? 'No pending reservations' : `No ${activeTab} reservations`}
            </p>
            <p className="text-[11px]" style={{ color: INK['30'] }}>
              {activeTab === 'pending'
                ? 'Scan your email from Connected Accounts to find bookings'
                : 'Reservations you review will appear here'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {reservations.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                isActioning={actionLoading === r.id}
                onConfirm={() => handleAction(r.id, 'confirm')}
                onDismiss={() => handleAction(r.id, 'dismiss')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card Component ─────────────────────────────────────────────────────────

function ReservationCard({
  reservation: r,
  isActioning,
  onConfirm,
  onDismiss,
}: {
  reservation: StagedReservation;
  isActioning: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const icon = TYPE_ICONS[r.placeType] || 'discover';
  const isPending = r.status === 'pending';
  const isConfirmed = r.status === 'confirmed';

  // Build detail line
  const details: string[] = [];
  if (r.placeType === 'flight' && r.departureAirport && r.arrivalAirport) {
    details.push(`${r.departureAirport} → ${r.arrivalAirport}`);
    if (r.flightNumber) details.push(r.flightNumber);
  } else if (r.placeType === 'hotel' && r.checkInDate) {
    details.push(`${formatDate(r.checkInDate)} – ${formatDate(r.checkOutDate)}`);
  } else {
    if (r.reservationDate) details.push(formatDate(r.reservationDate)!);
    if (r.reservationTime) details.push(formatTime(r.reservationTime)!);
  }
  if (r.partySize) details.push(`Party of ${r.partySize}`);
  if (r.provider) details.push(r.provider);

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        background: 'white',
        border: `1px solid ${isConfirmed ? 'rgba(42,122,86,0.2)' : 'var(--t-linen)'}`,
        opacity: isActioning ? 0.6 : 1,
      }}
    >
      {/* Top row: icon + name + confidence */}
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: INK['06'] }}
        >
          <PerriandIcon name={icon} size={14} color={INK['60']} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)' }}>
              {r.placeName}
            </span>
            {r.confidence >= 0.8 && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}>
                High confidence
              </span>
            )}
          </div>
          {r.location && (
            <span className="text-[11px] block mt-0.5" style={{ color: INK['50'] }}>
              {r.location}
            </span>
          )}
        </div>
      </div>

      {/* Details line */}
      {details.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {details.map((d, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: INK['06'], color: INK['60'] }}>
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Trip match suggestion */}
      {r.matchedTripName && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(200,146,58,0.06)' }}>
          <PerriandIcon name="trips" size={10} color="var(--t-honey)" />
          <span className="text-[10px]" style={{ color: 'var(--t-honey)' }}>
            Matches {r.matchedTripName}
            {r.suggestedDayNumber ? ` · Day ${r.suggestedDayNumber}` : ''}
          </span>
        </div>
      )}

      {/* Confirmation number */}
      {r.confirmationNumber && (
        <div className="mt-2">
          <span className="text-[9px] font-mono" style={{ color: INK['30'] }}>
            Ref: {r.confirmationNumber}
          </span>
        </div>
      )}

      {/* Email source line */}
      <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${INK['06']}` }}>
        <span className="text-[9px]" style={{ color: INK['30'] }}>
          From {r.emailFrom} · {new Date(r.emailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Actions (pending only) */}
      {isPending && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onConfirm}
            disabled={isActioning}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold border-none cursor-pointer transition-all"
            style={{ background: 'var(--t-verde)', color: 'white' }}
          >
            <PerriandIcon name="check" size={10} color="white" />
            Add to Library
          </button>
          <button
            onClick={onDismiss}
            disabled={isActioning}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium border-none cursor-pointer transition-all"
            style={{ background: INK['06'], color: INK['50'] }}
          >
            <PerriandIcon name="close" size={10} color={INK['50']} />
            Dismiss
          </button>
        </div>
      )}

      {/* Status badges for non-pending */}
      {isConfirmed && (
        <div className="flex items-center gap-1.5 mt-3">
          <PerriandIcon name="check" size={10} color="var(--t-verde)" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--t-verde)' }}>Added to Library</span>
        </div>
      )}
      {r.status === 'dismissed' && (
        <div className="flex items-center gap-1.5 mt-3">
          <PerriandIcon name="close" size={10} color={INK['30']} />
          <span className="text-[10px]" style={{ color: INK['30'] }}>Dismissed</span>
        </div>
      )}
    </div>
  );
}
