'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  silenceTimeout?: number; // ms of silence before auto-sending (0 = disabled)
  onSilenceDetected?: (transcript: string) => void; // called when user stops speaking
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
}

export function useSpeechRecognition({
  silenceTimeout = 0,
  onSilenceDetected,
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
      setIsListening(false);
      clearSilenceTimer();
      // Mark as failed for errors that indicate the feature won't work on this device
      // (not-allowed = permissions denied, service-not-allowed = not supported on this browser/OS)
      const errorType = event.error || '';
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed' || errorType === 'audio-capture') {
        setHasFailed(true);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
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
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      latestTranscriptRef.current = '';
      hasFinalResultRef.current = false;
      sentRef.current = false;
      clearSilenceTimer();
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        // .start() can throw if already started, or on mobile browsers where
        // the API constructor exists but speech recognition isn't actually available
        setHasFailed(true);
      }
    }
  }, [isListening, clearSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening, clearSilenceTimer]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    latestTranscriptRef.current = '';
    hasFinalResultRef.current = false;
  }, []);

  return { isListening, transcript, isSupported, startListening, stopListening, resetTranscript, hasFailed };
}
