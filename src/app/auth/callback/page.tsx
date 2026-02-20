'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { FONT, INK } from '@/constants/theme';

/**
 * Client-side auth callback page.
 * The magic link redirects to /api/auth/callback?code=xxx,
 * which forwards here so the BROWSER's Supabase client exchanges
 * the code → session is persisted to localStorage automatically.
 * Then we call the API to ensure the Prisma user record exists.
 */
export default function AuthCallbackPage() {
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
        // Exchange code for session using the browser's Supabase client.
        // This persists the session to localStorage automatically.
        const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

        if (authError || !data.session) {
          setError('Authentication failed. Please try signing in again.');
          return;
        }

        // Ensure Prisma user exists + get redirect destination
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
          // Session is persisted even if Prisma call fails — redirect to saved
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
