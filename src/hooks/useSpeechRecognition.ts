'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  silenceTimeout?: number; // ms of silence before auto-sending (0 = disabled)
  onSilenceDetected?: (transcript: string) => void; // called when user stops speaking
  /**
   * Auto-restart mode: when true, recognition automatically restarts after onend fires
   * (unless explicitly stopped via stopListening). This is used for the hands-free
   * conversational flow — the mic stays open between user turns.
   */
  autoRestart?: boolean;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  /** True if speech recognition was attempted but failed (e.g. permissions denied, unsupported on device) */
  hasFailed: boolean;
  /**
   * Update the silence timeout dynamically without recreating the recognition instance.
   * Used by the conversational state machine to adjust silence detection based on
   * expected response type (quick confirmation = shorter, reflective answer = longer).
   */
  setSilenceTimeout: (ms: number) => void;
}

export function useSpeechRecognition({
  silenceTimeout = 0,
  onSilenceDetected,
  autoRestart = false,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hasFailed, setHasFailed] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFinalResultRef = useRef(false);
  const latestTranscriptRef = useRef('');
  const sentRef = useRef(false); // guard: true once transcript has been sent (prevents double-send from both silence timer + onend)
  const onSilenceRef = useRef(onSilenceDetected);
  onSilenceRef.current = onSilenceDetected;
  const silenceTimeoutRef = useRef(silenceTimeout);
  silenceTimeoutRef.current = silenceTimeout;

  // Auto-restart tracking
  const autoRestartRef = useRef(autoRestart);
  autoRestartRef.current = autoRestart;
  const intentionalStopRef = useRef(false); // true when stopListening() is called explicitly
  const isListeningRef = useRef(false); // ref mirror for async callbacks

  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (silenceTimeoutRef.current <= 0) return;

    silenceTimerRef.current = setTimeout(() => {
      const text = latestTranscriptRef.current.trim();
      if (text && hasFinalResultRef.current && !sentRef.current) {
        sentRef.current = true;
        onSilenceRef.current?.(text);
      }
    }, silenceTimeoutRef.current);
  }, [clearSilenceTimer]);

  /** Dynamic silence timeout setter — updates the ref so the next timer uses the new value */
  const setSilenceTimeout = useCallback((ms: number) => {
    silenceTimeoutRef.current = ms;
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let hasNewFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) hasNewFinal = true;
      }
      setTranscript(finalTranscript);
      latestTranscriptRef.current = finalTranscript;

      // Reset silence timer on any new speech
      clearSilenceTimer();

      if (hasNewFinal) {
        hasFinalResultRef.current = true;
        // Start silence timer — if user stays quiet, we auto-send
        startSilenceTimer();
      }
    };

    recognition.onerror = (event: Event & { error?: string }) => {
      clearSilenceTimer();
      // Mark as failed for errors that indicate the feature won't work on this device
      // (not-allowed = permissions denied, service-not-allowed = not supported on this browser/OS)
      const errorType = event.error || '';
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed' || errorType === 'audio-capture') {
        setHasFailed(true);
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
      // For 'no-speech' and 'aborted' errors in auto-restart mode,
      // don't update isListening — the onend handler will auto-restart.
      // This prevents a brief flash of the "idle" UI state.
      if (autoRestartRef.current && !intentionalStopRef.current &&
          (errorType === 'no-speech' || errorType === 'aborted' || errorType === 'network')) {
        // Let onend handle restart
        return;
      }
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      // When recognition naturally ends, check if we should auto-restart
      if (autoRestartRef.current && !intentionalStopRef.current && isListeningRef.current) {
        // Auto-restart: recognition ended naturally (browser timeout, no-speech, etc.)
        // Restart it immediately to maintain the hands-free experience.
        // Brief delay to avoid rapid restart loops on some browsers.
        setTimeout(() => {
          if (!intentionalStopRef.current && autoRestartRef.current && isListeningRef.current) {
            try {
              // Reset state for fresh recognition session
              hasFinalResultRef.current = false;
              sentRef.current = false; // Allow re-sending on next silence detection
              latestTranscriptRef.current = '';
              setTranscript('');
              recognition.start();
            } catch {
              // If start() throws, give up on auto-restart
              setIsListening(false);
              isListeningRef.current = false;
            }
          }
        }, 100);
        return;
      }

      setIsListening(false);
      isListeningRef.current = false;

      // When recognition naturally ends (browser decided user is done),
      // if we have content that hasn't been sent yet, trigger auto-send immediately.
      // Guard: only fire if we haven't already sent via the silence timer.
      const text = latestTranscriptRef.current.trim();
      if (text && silenceTimeoutRef.current > 0 && !sentRef.current) {
        clearSilenceTimer();
        sentRef.current = true;
        onSilenceRef.current?.(text);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      clearSilenceTimer();
    };
  }, [isSupported, clearSilenceTimer, startSilenceTimer]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      setTranscript('');
      latestTranscriptRef.current = '';
      hasFinalResultRef.current = false;
      sentRef.current = false;
      intentionalStopRef.current = false;
      clearSilenceTimer();
      try {
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch {
        // .start() can throw if already started, or on mobile browsers where
        // the API constructor exists but speech recognition isn't actually available
        setHasFailed(true);
      }
    }
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true; // prevent auto-restart
    clearSilenceTimer();
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [clearSilenceTimer]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    latestTranscriptRef.current = '';
    hasFinalResultRef.current = false;
  }, []);

  return { isListening, transcript, isSupported, startListening, stopListening, resetTranscript, hasFailed, setSilenceTimeout };
}
