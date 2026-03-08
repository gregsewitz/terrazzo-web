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

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // ── Shared: fetch TTS for a text chunk ──
  const fetchTTSBlob = useCallback(async (text: string, signal?: AbortSignal): Promise<Blob | null> => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
        signal,
      });
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
  const playBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };

      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      });
    });
  }, []);

  // ── Stop everything ──
  const stop = useCallback(() => {
    stoppedRef.current = true;

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    // Cancel in-flight fetch
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Clear queue
    queueRef.current = [];
    isPlayingQueueRef.current = false;
    queueFinishedRef.current = false;

    setIsSpeaking(false);
  }, []);

  // ── Queue processor: plays sentences in order as their TTS resolves ──
  const processQueue = useCallback(async () => {
    if (isPlayingQueueRef.current) return; // already running
    isPlayingQueueRef.current = true;
    setIsSpeaking(true);

    let idx = 0;
    while (idx < queueRef.current.length || !queueFinishedRef.current) {
      if (stoppedRef.current) break;

      if (idx >= queueRef.current.length) {
        // Wait for more sentences to arrive
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      const item = queueRef.current[idx];
      const blob = await item.audioPromise;

      if (stoppedRef.current) break;

      if (blob) {
        await playBlob(blob);
      }

      if (stoppedRef.current) break;
      idx++;
    }

    // All done
    isPlayingQueueRef.current = false;
    queueRef.current = [];
    queueFinishedRef.current = false;

    if (!stoppedRef.current) {
      setIsSpeaking(false);
      onDoneRef.current?.();
    }
  }, [playBlob]);

  // ── Queue a sentence for progressive playback ──
  const queueSentence = useCallback((sentence: string) => {
    if (!enabled || !sentence.trim() || stoppedRef.current) return;

    // Immediately fire TTS request (don't wait for previous to finish)
    const audioPromise = fetchTTSBlob(sentence);
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

    try {
      setIsSpeaking(true);
      const blob = await fetchTTSBlob(text, controller.signal);

      if (!blob || stoppedRef.current) {
        setIsSpeaking(false);
        if (!stoppedRef.current) onDoneRef.current?.();
        return;
      }

      await playBlob(blob);

      if (!stoppedRef.current) {
        setIsSpeaking(false);
        onDoneRef.current?.();
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.warn('[tts] Playback failed:', err);
      }
      setIsSpeaking(false);
    }
  }, [enabled, stop, fetchTTSBlob, playBlob]);

  return { isSpeaking, speak, queueSentence, finishQueue, stop, enabled, setEnabled };
}
