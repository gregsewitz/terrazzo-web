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
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
        >
          Your Trips
        </h1>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.5)' }}>
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
                <div
                  className="text-sm font-semibold"
                  style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
                >
                  {trip.name}
                </div>
                <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                  {trip.location} · {trip.days.length} days · {trip.pool.filter(p => p.status === 'available').length} in pool
                </div>
              </div>
              <span style={{ color: 'rgba(28,26,23,0.3)' }}>→</span>
            </button>
          ))}

          {/* Add trip button */}
          <button
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-none cursor-pointer"
            style={{
              background: 'rgba(28,26,23,0.03)',
              border: '1.5px dashed var(--t-travertine)',
              color: 'rgba(28,26,23,0.4)',
            }}
          >
            <span className="text-lg">+</span>
            <span className="text-[12px]">New Trip</span>
          </button>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
