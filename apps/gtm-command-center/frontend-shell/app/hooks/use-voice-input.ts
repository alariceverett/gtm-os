'use client';

import { useState, useRef, useCallback } from 'react';

// Type definitions for Web Speech API (must be declared before use)
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: ((event: Event) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((event: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
  
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
  }
}

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
}

export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    transcript: '',
    error: null,
    isSupported: typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window),
  });
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const startListening = useCallback(() => {
    if (!state.isSupported) {
      setState((prev) => ({ ...prev, error: 'Voice input not supported in this browser' }));
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState((prev) => ({ ...prev, error: 'Voice input not supported in this browser' }));
      return;
    }
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setState((prev) => ({ ...prev, isListening: true, error: null }));
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      setState((prev) => ({
        ...prev,
        transcript: finalTranscript || interimTranscript,
      }));
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: event.error,
      }));
    };
    
    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false }));
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  }, [state.isSupported]);
  
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);
  
  const resetTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: '', error: null }));
  }, []);
  
  const setTranscript = useCallback((text: string) => {
    setState((prev) => ({ ...prev, transcript: text }));
  }, []);
  
  return {
    ...state,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    toggleListening: state.isListening ? stopListening : startListening,
  };
}
