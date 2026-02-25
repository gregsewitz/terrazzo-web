'use client';

import { useState, useEffect, useCallback } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { apiFetch } from '@/lib/api-client';

interface ShareSheetProps {
  resourceType: 'collection' | 'trip';
  resourceId: string;
  resourceName: string;
  onClose: () => void;
}

interface ShareState {
  isShared: boolean;
  token: string | null;
  url: string | null;
  viewCount: number;
  loading: boolean;
}

export default function ShareSheet({ resourceType, resourceId, resourceName, onClose }: ShareSheetProps) {
  const [state, setState] = useState<ShareState>({
    isShared: false,
    token: null,
    url: null,
    viewCount: 0,
    loading: true,
  });
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check current share status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const endpoint = resourceType === 'collection'
          ? `/api/collections/${resourceId}/share`
          : `/api/trips/${resourceId}/share`;
        const data = await apiFetch<{ isShared: boolean; shareLink: { token: string; viewCount: number } | null; url: string | null }>(endpoint);
        setState({
          isShared: data.isShared,
          token: data.shareLink?.token || null,
          url: data.url,
          viewCount: data.shareLink?.viewCount || 0,
          loading: false,
        });
      } catch {
        setState(s => ({ ...s, loading: false }));
      }
    };
    checkStatus();
  }, [resourceType, resourceId]);

  const generateLink = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    setError(null);
    try {
      const endpoint = resourceType === 'collection'
        ? `/api/collections/${resourceId}/share`
        : `/api/trips/${resourceId}/share`;
      const data = await apiFetch<{ shareLink: { token: string; viewCount: number }; url: string }>(endpoint, { method: 'POST' });
      setState({
        isShared: true,
        token: data.shareLink.token,
        url: data.url,
        viewCount: data.shareLink.viewCount,
        loading: false,
      });
    } catch (err) {
      console.error('[ShareSheet] generateLink failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create share link';
      setError(msg === 'Unauthorized' ? 'Please sign in to share' : msg);
      setState(s => ({ ...s, loading: false }));
    }
  }, [resourceType, resourceId]);

  const revokeLink = useCallback(async () => {
    setRevoking(true);
    try {
      const endpoint = resourceType === 'collection'
        ? `/api/collections/${resourceId}/share`
        : `/api/trips/${resourceId}/share`;
      await apiFetch(endpoint, { method: 'DELETE' });
      setState({ isShared: false, token: null, url: null, viewCount: 0, loading: false });
    } catch {
      // ignore
    }
    setRevoking(false);
  }, [resourceType, resourceId]);

  const copyLink = useCallback(async () => {
    if (!state.url) return;
    const fullUrl = `${window.location.origin}${state.url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [state.url]);

  const nativeShare = useCallback(async () => {
    if (!state.url) return;
    const fullUrl = `${window.location.origin}${state.url}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: resourceName,
          text: `Check out my ${resourceType === 'collection' ? 'collection' : 'trip'}: ${resourceName}`,
          url: fullUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      copyLink();
    }
  }, [state.url, resourceName, resourceType, copyLink]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full rounded-t-2xl animate-[slideUp_0.25s_ease-out]"
        style={{
          maxWidth: 480,
          background: 'var(--t-cream)',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: INK['15'] }} />
        </div>

        <div className="px-5 pt-2 pb-8">
          {/* Title */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div
                style={{ fontFamily: FONT.serif, fontSize: 17, fontStyle: 'italic', color: 'var(--t-ink)' }}
              >
                Share {resourceType === 'collection' ? 'collection' : 'trip'}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
                {resourceName}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: INK['05'], border: 'none', cursor: 'pointer' }}
            >
              <PerriandIcon name="close" size={12} color={INK['50']} />
            </button>
          </div>

          {/* ─── Share Link Section ─── */}
          <div
            className="text-[10px] font-semibold mb-2"
            style={{ color: INK['50'], fontFamily: FONT.mono, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Public share link
          </div>

          {/* Loading state */}
          {state.loading && (
            <div className="py-8 text-center">
              <div
                className="inline-block w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: INK['15'], borderTopColor: INK['60'] }}
              />
            </div>
          )}

          {/* Not yet shared */}
          {!state.loading && !state.isShared && (
            <div>
              <div
                className="text-[12px] leading-relaxed mb-4"
                style={{ color: INK['60'], fontFamily: FONT.sans }}
              >
                Create a link that anyone can use to view this {resourceType === 'collection' ? 'collection and its places' : 'trip itinerary'}.
                They can save places to their own library if they have an account.
              </div>
              <button
                onClick={generateLink}
                className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{
                  background: 'var(--t-ink)',
                  color: 'white',
                  border: 'none',
                  fontFamily: FONT.sans,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Create share link
              </button>
              {error && (
                <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--t-signal-red)', fontFamily: FONT.mono }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Shared — show link + actions */}
          {!state.loading && state.isShared && state.url && (
            <div>
              <div
                className="flex items-center gap-2 p-3 rounded-xl mb-3"
                style={{ background: 'white', border: '1px solid var(--t-linen)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK['50']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <div
                  className="flex-1 text-[11px] truncate"
                  style={{ color: INK['70'], fontFamily: FONT.mono }}
                >
                  {window.location.origin}{state.url}
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={copyLink}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  style={{
                    background: copied ? 'var(--t-verde)' : 'var(--t-ink)',
                    color: 'white',
                    border: 'none',
                    fontFamily: FONT.sans,
                  }}
                >
                  {copied ? (
                    <>
                      <PerriandIcon name="check" size={12} color="white" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy link
                    </>
                  )}
                </button>
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    onClick={nativeShare}
                    className="py-2.5 px-4 rounded-xl text-[12px] font-medium cursor-pointer flex items-center justify-center gap-1.5"
                    style={{
                      background: 'white',
                      color: 'var(--t-ink)',
                      border: '1px solid var(--t-linen)',
                      fontFamily: FONT.sans,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Share
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: INK['40'], fontFamily: FONT.mono }}>
                  {state.viewCount} view{state.viewCount !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={revokeLink}
                  disabled={revoking}
                  className="text-[10px] cursor-pointer"
                  style={{
                    color: 'var(--t-signal-red)',
                    background: 'none',
                    border: 'none',
                    fontFamily: FONT.mono,
                    opacity: revoking ? 0.5 : 1,
                  }}
                >
                  {revoking ? 'Revoking...' : 'Stop sharing'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
