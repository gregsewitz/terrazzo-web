'use client';

import { useState, useRef, useCallback } from 'react';

interface UseTTSOptions {
  voice?: string;
  enabled?: boolean;
  onDone?: () => void; // Called when ALL queued speech finishes playing
}

interface UseTTSReturn {
  isSpeaking: boolean;
  /** Speak a complete text (single TTS call, batch) */
  speak: (text: string) => Promise<void>;
  /**
   * Queue a sentence for progressive playback.
   * Call multiple times as sentences arrive from streaming LLM.
   * Audio starts playing as soon as the first sentence's TTS resolves.
   */
  queueSentence: (sentence: string) => void;
  /** Signal that no more sentences will be queued (triggers onDone after last sentence plays) */
  finishQueue: () => void;
  stop: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

/**
 * TTS hook with progressive sentence-level playback.
 *
 * Two modes:
 * 1. `speak(text)` — batch mode, single TTS call (backward compatible)
 * 2. `queueSentence(s)` + `finishQueue()` — streaming mode, fires TTS per sentence,
 *    plays them sequentially as they resolve, overlapping TTS generation with playback.
 *
 * Uses a generation counter to prevent stale processQueue instances from interfering
 * with new ones after stop() is called.
 */
export function useTTS({ voice = 'nova', enabled: initialEnabled = true, onDone }: UseTTSOptions = {}): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);

  // Batch mode refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Queue mode refs
  const queueRef = useRef<Array<{ text: string; audioPromise: Promise<Blob | null> }>>([]);
  const isPlayingQueueRef = useRef(false);
  const queueFinishedRef = useRef(false);
  const stoppedRef = useRef(false);

  // Shared AbortController for all in-flight queue TTS fetches.
  // Aborted on stop() so we don't waste bandwidth/API credits on audio that will never play.
  const queueAbortRef = useRef<AbortController | null>(null);

  // Generation counter — incremented on every stop(). Each processQueue captures its
  // generation at start and exits immediately if it no longer matches. This prevents
  // stale async processQueue loops from interfering with new ones.
  const generationRef = useRef(0);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // ── Shared: fetch TTS for a text chunk ──
  // Handles 429 rate-limit responses with a single retry after the suggested delay.
  const fetchTTSBlob = useCallback(async (text: string, signal?: AbortSignal): Promise<Blob | null> => {
    const doFetch = async (): Promise<Response> => {
      return fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
        signal,
      });
    };

    try {
      let res = await doFetch();

      // Retry once on rate-limit (429) after the server's suggested delay
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '3', 10);
        const delayMs = Math.min(retryAfter * 1000, 10000); // cap at 10s
        console.warn(`[tts] Rate-limited, retrying in ${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
        if (signal?.aborted) return null;
        res = await doFetch();
      }

      if (!res.ok) {
        console.warn('[tts] Request failed:', res.status);
        return null;
      }
      return await res.blob();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      console.warn('[tts] Fetch error:', err);
      return null;
    }
  }, [voice]);

  // ── Shared: play a blob and return a promise that resolves when done ──
  // Waits for canplaythrough before calling play() to avoid choppy starts from
  // insufficient buffering.
  const playBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.preload = 'auto';

      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackTimer);
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };

      const tryPlay = () => {
        audio.play().catch(finish);
      };

      // Safety net: if canplaythrough never fires within 2s, just play anyway
      const fallbackTimer = setTimeout(() => {
        if (audioRef.current === audio && audio.paused) tryPlay();
      }, 2000);

      audio.onended = finish;
      audio.onerror = finish;

      // Wait for enough data to be buffered before playing.
      // This prevents the "choppy start" where playback begins before the
      // browser has decoded enough audio.
      audio.oncanplaythrough = () => {
        clearTimeout(fallbackTimer);
        tryPlay();
      };
    });
  }, []);

  // ── Stop everything ──
  const stop = useCallback(() => {
    stoppedRef.current = true;
    // Bump generation so any in-flight processQueue exits on its next check
    generationRef.current += 1;

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    // Cancel in-flight fetch (batch mode)
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Cancel in-flight queue TTS fetches
    if (queueAbortRef.current) {
      queueAbortRef.current.abort();
      queueAbortRef.current = null;
    }

    // Clear queue
    queueRef.current = [];
    isPlayingQueueRef.current = false;
    queueFinishedRef.current = false;

    setIsSpeaking(false);
  }, []);

  // ── Queue processor: plays sentences in order as their TTS resolves ──
  // Each invocation captures the current generation and exits if it goes stale.
  const processQueue = useCallback(async () => {
    if (isPlayingQueueRef.current) return; // already running
    isPlayingQueueRef.current = true;
    setIsSpeaking(true);

    const myGeneration = generationRef.current;

    let idx = 0;
    while (idx < queueRef.current.length || !queueFinishedRef.current) {
      // Check both stopped flag AND generation to catch stale loops
      if (stoppedRef.current || generationRef.current !== myGeneration) break;

      if (idx >= queueRef.current.length) {
        // Wait for more sentences to arrive
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      const item = queueRef.current[idx];
      const blob = await item.audioPromise;

      if (stoppedRef.current || generationRef.current !== myGeneration) break;

      if (blob) {
        await playBlob(blob);
      }

      if (stoppedRef.current || generationRef.current !== myGeneration) break;
      idx++;
    }

    // Only do cleanup and fire onDone if this is still the active generation.
    // Stale loops exit silently — the new generation owns the state.
    if (generationRef.current === myGeneration) {
      // All done — small delay so the browser audio system fully finishes
      // the last sentence before we signal completion (prevents abrupt cutoff feel)
      if (!stoppedRef.current) {
        await new Promise((r) => setTimeout(r, 150));
      }

      isPlayingQueueRef.current = false;
      queueRef.current = [];
      queueFinishedRef.current = false;
      queueAbortRef.current = null;

      if (!stoppedRef.current) {
        setIsSpeaking(false);
        onDoneRef.current?.();
      }
    }
    // If generation is stale, DON'T touch isPlayingQueueRef or call onDone —
    // the new generation's processQueue owns that responsibility.
  }, [playBlob]);

  // ── Queue a sentence for progressive playback ──
  const queueSentence = useCallback((sentence: string) => {
    if (!enabled || !sentence.trim()) return;

    // Reset stopped flag — a new response is being queued, so we should play it.
    // This is critical because stop() sets stoppedRef=true (to silence current audio
    // when user starts speaking), and the new SSE response arrives before anyone
    // resets it. Without this, streamed sentences are silently dropped.
    stoppedRef.current = false;

    // Ensure we have an AbortController for this batch of queue fetches.
    // Created lazily on the first queueSentence after a stop() or fresh start.
    if (!queueAbortRef.current) {
      queueAbortRef.current = new AbortController();
    }

    // Immediately fire TTS request (don't wait for previous to finish)
    const audioPromise = fetchTTSBlob(sentence, queueAbortRef.current.signal);
    queueRef.current.push({ text: sentence, audioPromise });

    // Start the queue processor if it's not already running
    if (!isPlayingQueueRef.current) {
      processQueue();
    }
  }, [enabled, fetchTTSBlob, processQueue]);

  // ── Signal that no more sentences will be queued ──
  const finishQueue = useCallback(() => {
    queueFinishedRef.current = true;
  }, []);

  // ── Batch mode: speak all text at once (backward compatible) ──
  const speak = useCallback(async (text: string) => {
    if (!enabled || !text.trim()) return;

    stop();
    stoppedRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;
    const myGeneration = generationRef.current;

    try {
      setIsSpeaking(true);
      const blob = await fetchTTSBlob(text, controller.signal);

      if (!blob || stoppedRef.current || generationRef.current !== myGeneration) {
        if (generationRef.current === myGeneration) {
          setIsSpeaking(false);
          if (!stoppedRef.current) onDoneRef.current?.();
        }
        return;
      }

      await playBlob(blob);

      if (!stoppedRef.current && generationRef.current === myGeneration) {
        setIsSpeaking(false);
        onDoneRef.current?.();
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.warn('[tts] Playback failed:', err);
      }
      if (generationRef.current === myGeneration) {
        setIsSpeaking(false);
      }
    }
  }, [enabled, stop, fetchTTSBlob, playBlob]);

  return { isSpeaking, speak, queueSentence, finishQueue, stop, enabled, setEnabled };
}
