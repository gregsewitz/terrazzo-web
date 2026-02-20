'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FONT, INK } from '@/constants/theme';

export default function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // If already authenticated, redirect
  if (isAuthenticated) {
    router.replace('/saved');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setErrorMsg('');

    const { error } = await signIn(email.trim());
    if (error) {
      setStatus('error');
      setErrorMsg(error);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      {/* Logo */}
      <h1
        className="text-[36px] mb-2"
        style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
      >
        Terrazzo
      </h1>
      <p
        className="text-[13px] mb-10"
        style={{ color: INK['50'], fontFamily: FONT.sans }}
      >
        Your bespoke travel concierge
      </p>

      {status === 'sent' ? (
        /* Success state */
        <div className="text-center">
          <div className="text-[28px] mb-4">&#x2709;&#xFE0F;</div>
          <h2
            className="text-[18px] font-semibold mb-2"
            style={{ fontFamily: FONT.sans, color: 'var(--t-ink)' }}
          >
            Check your email
          </h2>
          <p
            className="text-[13px] mb-6"
            style={{ color: INK['60'], fontFamily: FONT.sans }}
          >
            We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
          </p>
          <button
            onClick={() => { setStatus('idle'); setEmail(''); }}
            className="text-[12px] cursor-pointer"
            style={{
              color: 'var(--t-verde)',
              background: 'none',
              border: 'none',
              fontFamily: FONT.sans,
            }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        /* Form state */
        <form onSubmit={handleSubmit} className="w-full max-w-[320px]">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="w-full rounded-xl py-3 px-4 mb-3"
            style={{
              fontSize: 16,
              background: 'white',
              border: '1px solid var(--t-linen)',
              color: 'var(--t-ink)',
              fontFamily: FONT.sans,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {status === 'error' && (
            <p className="text-[11px] mb-2" style={{ color: '#c44', fontFamily: FONT.sans }}>
              {errorMsg || 'Something went wrong. Please try again.'}
            </p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || status === 'sending'}
            className="w-full py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all"
            style={{
              background: email.trim() ? 'var(--t-ink)' : INK['10'],
              color: email.trim() ? 'white' : INK['30'],
              border: 'none',
              fontFamily: FONT.sans,
              opacity: status === 'sending' ? 0.6 : 1,
            }}
          >
            {status === 'sending' ? 'Sending...' : 'Send magic link'}
          </button>

          <p
            className="text-[10px] text-center mt-4"
            style={{ color: INK['40'], fontFamily: FONT.sans }}
          >
            No password needed. We&apos;ll email you a sign-in link.
          </p>
        </form>
      )}
    </div>
  );
}
