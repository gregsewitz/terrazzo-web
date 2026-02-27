'use client';

import { useState, useRef, useCallback } from 'react';

interface UseTTSOptions {
  voice?: string;
  enabled?: boolean;
  onDone?: () => void; // Called when speech finishes playing
}

interface UseTTSReturn {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export function useTTS({ voice = 'nova', enabled: initialEnabled = true, onDone }: UseTTSOptions = {}): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const stop = useCallback(() => {
    if (audioRef.current) {
      // Remove event handlers BEFORE pausing so onended doesn't fire onDone
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text.trim()) return;

    // Stop any currently playing audio
    stop();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsSpeaking(true);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn('TTS request failed:', res.status);
        setIsSpeaking(false);
        onDoneRef.current?.();
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        audioRef.current = null;
        onDoneRef.current?.();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        audioRef.current = null;
        onDoneRef.current?.();
      };

      await audio.play();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Intentional abort — not an error
      } else {
        console.warn('TTS playback failed:', err);
      }
      setIsSpeaking(false);
    }
  }, [enabled, voice, stop]);

  return { isSpeaking, speak, stop, enabled, setEnabled };
}
