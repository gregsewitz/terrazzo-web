'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Voice Activity Detection using native Web APIs.
 *
 * Uses getUserMedia with echoCancellation + AudioContext AnalyserNode to detect
 * whether the user is speaking. Echo cancellation is critical — it filters out
 * the TTS audio playing through the speakers so we only detect the user's voice.
 *
 * This enables barge-in: user starts talking while AI is speaking → we detect it
 * and duck/stop the TTS.
 *
 * Falls back gracefully if getUserMedia is denied — caller should offer tap-to-interrupt.
 */

interface UseVoiceActivityOptions {
  /** Volume threshold (0–255) to consider as speech. Default 25. */
  threshold?: number;
  /** How long (ms) volume must stay below threshold to fire onVoiceEnd. Default 300. */
  silenceDelay?: number;
  /** Called when voice activity starts (volume exceeds threshold). */
  onVoiceStart?: () => void;
  /** Called when voice activity ends (silence for silenceDelay ms). */
  onVoiceEnd?: () => void;
  /** Whether the detector is active. Stops polling when false. */
  enabled?: boolean;
}

interface UseVoiceActivityReturn {
  /** True while user voice is detected above threshold. */
  isVoiceActive: boolean;
  /** True if getUserMedia + AudioContext are available. */
  isSupported: boolean;
  /** True if getUserMedia permission was denied. */
  permissionDenied: boolean;
  /** Current volume level (0–255) — useful for visualizations. */
  volumeLevel: number;
  /** Initialize the audio pipeline (requests mic permission). Call once on user gesture. */
  init: () => Promise<boolean>;
  /** Tear down the audio pipeline. */
  destroy: () => void;
}

export function useVoiceActivity({
  threshold = 25,
  silenceDelay = 300,
  onVoiceStart,
  onVoiceEnd,
  enabled = true,
}: UseVoiceActivityOptions = {}): UseVoiceActivityReturn {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for the audio pipeline
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Refs for state tracking (avoid stale closures in the animation frame loop)
  const isActiveRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  // Callback refs to avoid stale closures
  const onVoiceStartRef = useRef(onVoiceStart);
  onVoiceStartRef.current = onVoiceStart;
  const onVoiceEndRef = useRef(onVoiceEnd);
  onVoiceEndRef.current = onVoiceEnd;

  const isSupported = typeof window !== 'undefined'
    && typeof navigator?.mediaDevices?.getUserMedia === 'function'
    && typeof AudioContext !== 'undefined';

  /**
   * Volume polling loop — runs via requestAnimationFrame for minimal overhead.
   * Reads the analyser's frequency data and computes a simple RMS volume.
   */
  const pollVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !enabledRef.current) {
      rafRef.current = requestAnimationFrame(pollVolume);
      // Still schedule next frame so we resume when enabled
      return;
    }

    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);

    // Compute RMS (root mean square) volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128; // normalize to -1..1
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const volumeRaw = Math.min(255, Math.round(rms * 255 * 4)); // scale up for sensitivity

    setVolumeLevel(volumeRaw);

    const aboveThreshold = volumeRaw > thresholdRef.current;

    if (aboveThreshold && !isActiveRef.current) {
      // Voice started
      isActiveRef.current = true;
      setIsVoiceActive(true);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      onVoiceStartRef.current?.();
    } else if (!aboveThreshold && isActiveRef.current) {
      // Volume dropped — start silence timer
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          isActiveRef.current = false;
          setIsVoiceActive(false);
          silenceTimerRef.current = null;
          onVoiceEndRef.current?.();
        }, silenceDelay);
      }
    } else if (aboveThreshold && isActiveRef.current) {
      // Still speaking — cancel any pending silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(pollVolume);
  }, [silenceDelay]);

  /**
   * Initialize the audio pipeline. Must be called from a user gesture (tap/click)
   * on mobile browsers to get getUserMedia permission.
   */
  const init = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    if (isInitialized) return true;

    try {
      // Request microphone with echo cancellation + noise suppression.
      // echoCancellation is the key feature — it filters out the TTS audio
      // playing through speakers so we only detect the user's actual voice.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; // smaller FFT for faster analysis (lower latency)
      analyser.smoothingTimeConstant = 0.3; // moderate smoothing

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      // Note: we intentionally do NOT connect analyser to destination
      // — we don't want to play back the mic audio, just analyze it.

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      sourceRef.current = source;
      setIsInitialized(true);

      // Start the polling loop
      rafRef.current = requestAnimationFrame(pollVolume);

      return true;
    } catch (err) {
      console.warn('[voice-activity] getUserMedia failed:', err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setPermissionDenied(true);
      }
      return false;
    }
  }, [isSupported, isInitialized, pollVolume]);

  /**
   * Tear down the audio pipeline — releases mic, closes AudioContext.
   */
  const destroy = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    isActiveRef.current = false;
    setIsVoiceActive(false);
    setVolumeLevel(0);
    setIsInitialized(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  return {
    isVoiceActive,
    isSupported,
    permissionDenied,
    volumeLevel,
    init,
    destroy,
  };
}
