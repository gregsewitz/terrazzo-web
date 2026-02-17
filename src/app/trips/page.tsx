'use client';

import { useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';

export default function TripsPage() {
  const trips = useTripStore(s => s.trips);
  const router = useRouter();
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [tripName, setTripName] = useState('');

  const handleCreateTrip = () => {
    if (!tripName.trim()) return;
    // For now, navigate to the demo trip (in a real app, we'd create a new trip in the store)
    setShowNewTrip(false);
    setTripName('');
    // Navigate to demo for now since we only have one trip
    router.push('/trips/demo-tokyo');
  };

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

          {/* New trip — inline form or button */}
          {showNewTrip ? (
            <div
              className="p-4 rounded-xl"
              style={{ background: 'white', border: '1.5px solid var(--t-honey)' }}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}>
                New trip
              </div>
              <input
                type="text"
                placeholder="Where are you going?"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTrip(); }}
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border mb-3 text-[13px]"
                style={{
                  background: 'var(--t-cream)',
                  borderColor: 'var(--t-linen)',
                  color: 'var(--t-ink)',
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNewTrip(false); setTripName(''); }}
                  className="flex-1 py-2 rounded-lg text-[12px] font-medium border cursor-pointer"
                  style={{ background: 'transparent', borderColor: 'var(--t-linen)', color: 'var(--t-ink)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTrip}
                  disabled={!tripName.trim()}
                  className="flex-1 py-2 rounded-lg text-[12px] font-medium border-none cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--t-ink)', color: 'white' }}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewTrip(true)}
              className="flex items-center justify-center gap-2 p-4 rounded-xl border-none cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                background: 'rgba(28,26,23,0.03)',
                border: '1.5px dashed var(--t-travertine)',
                color: 'rgba(28,26,23,0.4)',
              }}
            >
              <span className="text-lg">+</span>
              <span className="text-[12px]">New Trip</span>
            </button>
          )}
        </div>
      </div>

      <TabBar />
    </div>
  );
}
