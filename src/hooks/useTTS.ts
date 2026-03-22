'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

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
  /** Hard stop — immediately silences and clears everything. */
  stop: () => void;
  /**
   * Smooth duck — fades volume to 0 over ~150ms, then stops.
   * Use for barge-in (user starts talking). Feels natural, like the AI is yielding.
   */
  duck: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

// ── Web Audio API ducking pipeline ──
// We route all audio through a GainNode so we can smoothly fade volume.
// Created lazily on first use (AudioContext requires user gesture on mobile).
let sharedAudioContext: AudioContext | null = null;
let sharedGainNode: GainNode | null = null;
let sharedMediaSource: MediaElementAudioSourceNode | null = null;
let sharedAudioElement: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  // Resume if suspended (browsers suspend AudioContext until user gesture)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

function getGainNode(): GainNode {
  if (!sharedGainNode) {
    const ctx = getAudioContext();
    sharedGainNode = ctx.createGain();
    sharedGainNode.connect(ctx.destination);
  }
  return sharedGainNode;
}

/**
 * Connect an audio element to the Web Audio API GainNode pipeline.
 * This allows us to control volume smoothly (ducking) while still using
 * the simple HTMLAudioElement for playback/buffering.
 *
 * IMPORTANT: Each audio element can only be connected once. We track the
 * currently connected element and disconnect before connecting a new one.
 */
function connectAudioToGain(audio: HTMLAudioElement): void {
  try {
    const ctx = getAudioContext();
    const gainNode = getGainNode();

    // Disconnect previous source if any
    if (sharedMediaSource) {
      try { sharedMediaSource.disconnect(); } catch { /* already disconnected */ }
      sharedMediaSource = null;
    }

    // Only connect if this is a new element (can't re-connect same element)
    if (sharedAudioElement !== audio) {
      const source = ctx.createMediaElementSource(audio);
      source.connect(gainNode);
      sharedMediaSource = source;
      sharedAudioElement = audio;
    }

    // Ensure gain is at full volume (reset from any previous duck)
    gainNode.gain.cancelScheduledValues(ctx.currentTime);
    gainNode.gain.setValueAtTime(1, ctx.currentTime);
  } catch {
    // Web Audio API not available — audio will play through default pipeline
    // (no ducking support, but playback still works)
  }
}

/**
 * TTS hook with progressive sentence-level playback and audio ducking.
 *
 * Two modes:
 * 1. `speak(text)` — batch mode, single TTS call (backward compatible)
 * 2. `queueSentence(s)` + `finishQueue()` — streaming mode, fires TTS per sentence,
 *    plays them sequentially as they resolve, overlapping TTS generation with playback.
 *
 * Audio ducking:
 * - `duck()` smoothly fades volume to 0 over 150ms, then stops. Use for barge-in.
 * - `stop()` immediately silences. Use for unmount/hard cancel.
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
  const queueAbortRef = useRef<AbortController | null>(null);

  // Generation counter — incremented on every stop/duck.
  const generationRef = useRef(0);

  // Duck timer — tracks the fade-out timeout so we can clean up
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Clean up shared AudioContext on unmount of last instance
  useEffect(() => {
    return () => {
      // Don't destroy shared context — other instances may use it
    };
  }, []);

  // ── Fetch TTS blob with 429 retry ──
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

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '3', 10);
        const delayMs = Math.min(retryAfter * 1000, 10000);
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

  // ── Play a blob via Audio element routed through Web Audio GainNode ──
  const playBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.preload = 'auto';

      // Route through Web Audio API for ducking support
      connectAudioToGain(audio);

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

      const fallbackTimer = setTimeout(() => {
        if (audioRef.current === audio && audio.paused) tryPlay();
      }, 2000);

      audio.onended = finish;
      audio.onerror = finish;
      audio.oncanplaythrough = () => {
        clearTimeout(fallbackTimer);
        tryPlay();
      };
    });
  }, []);

  // ── Internal cleanup (shared between stop and duck) ──
  const cleanupInternal = useCallback(() => {
    // Cancel in-flight batch fetch
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    // Cancel in-flight queue fetches
    if (queueAbortRef.current) {
      queueAbortRef.current.abort();
      queueAbortRef.current = null;
    }
    // Cancel any pending duck timer
    if (duckTimerRef.current) {
      clearTimeout(duckTimerRef.current);
      duckTimerRef.current = null;
    }
    // Clear queue
    queueRef.current = [];
    isPlayingQueueRef.current = false;
    queueFinishedRef.current = false;
  }, []);

  // ── Hard-kill audio element ──
  const killAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  // ── Stop: immediate silence ──
  const stop = useCallback(() => {
    stoppedRef.current = true;
    generationRef.current += 1;

    killAudio();

    // Reset gain to full (in case a duck was in progress)
    try {
      const ctx = sharedAudioContext;
      const gain = sharedGainNode;
      if (ctx && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(1, ctx.currentTime);
      }
    } catch { /* ignore */ }

    cleanupInternal();
    setIsSpeaking(false);
  }, [killAudio, cleanupInternal]);

  // ── Duck: smooth fade-out over 150ms, then stop ──
  // This is what should be called when the user barges in (starts talking).
  // It feels natural — like the AI is yielding the floor — instead of a hard cut.
  const duck = useCallback(() => {
    stoppedRef.current = true;
    generationRef.current += 1;
    cleanupInternal();

    try {
      const ctx = sharedAudioContext;
      const gain = sharedGainNode;
      if (ctx && gain && audioRef.current) {
        // Smooth exponential fade to near-zero over 150ms
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        // exponentialRampToValueAtTime can't ramp to 0, so ramp to 0.01 then stop
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        // After the fade completes, kill the audio and reset gain
        duckTimerRef.current = setTimeout(() => {
          killAudio();
          if (ctx && gain) {
            gain.gain.cancelScheduledValues(ctx.currentTime);
            gain.gain.setValueAtTime(1, ctx.currentTime);
          }
          setIsSpeaking(false);
          duckTimerRef.current = null;
        }, 170); // slightly longer than the ramp to ensure it completes
        return;
      }
    } catch { /* Web Audio not available, fall through to hard stop */ }

    // Fallback: hard stop if Web Audio isn't available
    killAudio();
    setIsSpeaking(false);
  }, [killAudio, cleanupInternal]);

  // ── Queue processor ──
  const processQueue = useCallback(async () => {
    if (isPlayingQueueRef.current) return;
    isPlayingQueueRef.current = true;
    setIsSpeaking(true);

    const myGeneration = generationRef.current;

    let idx = 0;
    while (idx < queueRef.current.length || !queueFinishedRef.current) {
      if (stoppedRef.current || generationRef.current !== myGeneration) break;

      if (idx >= queueRef.current.length) {
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

    if (generationRef.current === myGeneration) {
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
  }, [playBlob]);

  // ── Queue a sentence ──
  const queueSentence = useCallback((sentence: string) => {
    if (!enabled || !sentence.trim()) return;

    stoppedRef.current = false;

    if (!queueAbortRef.current) {
      queueAbortRef.current = new AbortController();
    }

    const audioPromise = fetchTTSBlob(sentence, queueAbortRef.current.signal);
    queueRef.current.push({ text: sentence, audioPromise });

    if (!isPlayingQueueRef.current) {
      processQueue();
    }
  }, [enabled, fetchTTSBlob, processQueue]);

  // ── Finish queue ──
  const finishQueue = useCallback(() => {
    queueFinishedRef.current = true;
  }, []);

  // ── Batch speak ──
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

  return { isSpeaking, speak, queueSentence, finishQueue, stop, duck, enabled, setEnabled };
}
