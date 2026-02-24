'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK } from '@/constants/theme';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // ─── Authenticated users: redirect straight to app ───
  const [hydrated, setHydrated] = useState(false);
  const isComplete = useOnboardingStore((s) => s.isComplete);

  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useOnboardingStore.persist.onFinishHydration(() => {
        setHydrated(true);
        unsub();
      });
    }
  }, []);

  useEffect(() => {
    if (authLoading || !hydrated) return;
    if (isAuthenticated) {
      router.replace(isComplete ? '/trips' : '/onboarding');
    }
  }, [authLoading, hydrated, isAuthenticated, isComplete, router]);

  // ─── Waitlist form state ───
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong.');
      } else {
        setStatus('success');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Could not connect. Please try again.');
    }
  };

  // While checking auth, show brief loading
  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <h1 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 32, color: 'var(--t-ink)' }} className="animate-pulse">
          Terrazzo
        </h1>
      </div>
    );
  }

  // If authenticated, show loading while redirect happens
  if (isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <h1 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 32, color: 'var(--t-ink)' }} className="animate-pulse">
          Terrazzo
        </h1>
      </div>
    );
  }

  // ─── Splash page for unauthenticated visitors ───
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)' }}
    >
      {/* Hero */}
      <div className="w-full max-w-[520px] text-center mb-10">
        <h1
          className="mb-3"
          style={{
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontSize: 48,
            color: 'var(--t-ink)',
            lineHeight: 1.1,
          }}
        >
          Terrazzo
        </h1>
        <p
          className="mb-6"
          style={{
            fontFamily: FONT.sans,
            fontSize: 17,
            color: INK['60'],
            letterSpacing: '-0.01em',
          }}
        >
          Your bespoke travel concierge
        </p>
        <p
          style={{
            fontFamily: FONT.sans,
            fontSize: 15,
            color: INK['50'],
            lineHeight: 1.6,
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          Terrazzo learns your taste — the textures, the light, the details that make a place unforgettable — and helps you collect, curate, and plan trips that actually feel like you.
        </p>
      </div>

      {/* Waitlist card */}
      <div
        className="w-full max-w-[400px] rounded-2xl p-8"
        style={{
          background: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          border: '1px solid var(--t-linen)',
        }}
      >
        {status === 'success' ? (
          <div className="text-center">
            <div className="text-[28px] mb-4">&#x2728;</div>
            <h2
              className="text-[18px] font-semibold mb-2"
              style={{ fontFamily: FONT.sans, color: 'var(--t-ink)' }}
            >
              You&apos;re on the list
            </h2>
            <p
              className="text-[13px]"
              style={{ color: INK['55'], fontFamily: FONT.sans, lineHeight: 1.5 }}
            >
              We&apos;ll be in touch when it&apos;s your turn. In the meantime, we&apos;re building something we think you&apos;ll love.
            </p>
          </div>
        ) : (
          <>
            <p
              className="text-center mb-5"
              style={{
                fontFamily: FONT.sans,
                fontSize: 13,
                color: INK['55'],
                lineHeight: 1.5,
              }}
            >
              Terrazzo is currently available by invitation only. Request an invitation and we&apos;ll let you know when a spot opens up.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl py-3 px-4 mb-3"
                style={{
                  fontSize: 16,
                  background: 'var(--t-cream)',
                  border: '1px solid var(--t-linen)',
                  color: 'var(--t-ink)',
                  fontFamily: FONT.sans,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {status === 'error' && (
                <p className="text-[11px] mb-2" style={{ color: '#c44', fontFamily: FONT.sans }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={!email.trim() || status === 'sending'}
                className="w-full py-3 rounded-xl text-[14px] font-semibold cursor-pointer"
                style={{
                  background: email.trim() ? 'var(--t-ink)' : INK['10'],
                  color: email.trim() ? 'white' : INK['30'],
                  border: 'none',
                  fontFamily: FONT.sans,
                  opacity: status === 'sending' ? 0.6 : 1,
                  transition: 'all 150ms ease',
                }}
              >
                {status === 'sending' ? 'Requesting...' : 'Request an invitation'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Sign in link */}
      <a
        href="/login"
        className="mt-6 text-[12px]"
        style={{
          color: INK['40'],
          fontFamily: FONT.sans,
          textDecoration: 'none',
        }}
      >
        Already have an invitation? <span style={{ color: 'var(--t-verde)', textDecoration: 'underline' }}>Sign in</span>
      </a>

      {/* Footer */}
      <p
        className="mt-16 text-[11px]"
        style={{ color: INK['30'], fontFamily: FONT.sans }}
      >
        &copy; 2026 Terrazzo
      </p>
    </div>
  );
}
