'use client';

import { useTripStore } from '@/stores/tripStore';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';

export default function TripsPage() {
  const trips = useTripStore(s => s.trips);
  const router = useRouter();

  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-2xl"
            style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
          >
            Your Trips
          </h1>
          <button
            onClick={() => router.push('/trips/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-none cursor-pointer text-[12px] font-medium transition-all hover:opacity-80"
            style={{ background: 'var(--t-ink)', color: 'white', fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className="text-sm">+</span> New Trip
          </button>
        </div>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.95)' }}>
          Plan and curate with Terrazzo taste intelligence
        </p>

        <div className="flex flex-col gap-3">
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => router.push(`/trips/${trip.id}`)}
              className="flex items-center gap-3 p-4 rounded-xl border-none cursor-pointer text-left transition-all hover:scale-[1.01]"
              style={{
                background: 'white',
                border: '1.5px solid var(--t-linen)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'rgba(200,146,58,0.1)' }}
              >
                △
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-sm font-semibold truncate"
                    style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
                  >
                    {trip.name}
                  </span>
                  {trip.status && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                      style={{
                        background: trip.status === 'planning' ? 'rgba(42,122,86,0.08)' : 'rgba(200,146,58,0.08)',
                        color: trip.status === 'planning' ? 'var(--t-verde)' : 'var(--t-honey)',
                        fontFamily: "'Space Mono', monospace",
                      }}
                    >
                      {trip.status === 'planning' ? '● Planning' : '◯ Dreaming'}
                    </span>
                  )}
                </div>
                <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
                  {trip.location} · {trip.days.length} days
                </div>
              </div>
              <span style={{ color: 'rgba(28,26,23,0.95)' }}>→</span>
            </button>
          ))}

          {/* Large dashed CTA card */}
          <button
            onClick={() => router.push('/trips/new')}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-none cursor-pointer transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(28,26,23,0.02)',
              border: '1.5px dashed var(--t-travertine)',
              color: 'rgba(28,26,23,0.9)',
            }}
          >
            <span className="text-2xl">+</span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--t-ink)' }}>Start a New Trip</span>
            <span className="text-[11px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
              Tell us where and when — we'll find your perfect places
            </span>
          </button>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
