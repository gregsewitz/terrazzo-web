'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { FONT, INK } from '@/constants/theme';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setError('Missing authentication code.');
      return;
    }

    async function handleCallback(code: string) {
      try {
        const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

        if (authError || !data.session) {
          setError('Authentication failed. Please try signing in again.');
          return;
        }

        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });

        if (res.ok) {
          const { redirectTo } = await res.json();
          router.replace(redirectTo || '/saved');
        } else {
          router.replace('/saved');
        }
      } catch {
        setError('Something went wrong. Please try signing in again.');
      }
    }

    handleCallback(code);
  }, [searchParams, router]);

  if (error) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
      >
        <p className="text-[13px] mb-4" style={{ color: '#c44', fontFamily: FONT.sans }}>
          {error}
        </p>
        <button
          onClick={() => router.replace('/login')}
          className="text-[12px] font-semibold px-4 py-2 rounded-full cursor-pointer"
          style={{
            background: 'var(--t-ink)',
            color: 'white',
            border: 'none',
            fontFamily: FONT.sans,
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      <h1
        className="text-[24px] mb-3"
        style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
      >
        Terrazzo
      </h1>
      <p className="text-[13px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
        Signing you in...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-dvh flex flex-col items-center justify-center px-6"
          style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
        >
          <h1
            className="text-[24px] mb-3"
            style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
          >
            Terrazzo
          </h1>
          <p className="text-[13px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
            Signing you in...
          </p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
