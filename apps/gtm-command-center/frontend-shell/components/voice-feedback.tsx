'use client';

import React, { useState, useRef, useCallback } from 'react';

export interface VoiceFeedbackProps {
    onTranscription?: (text: string, audioBlob?: Blob) => void;
    onSubmit?: (data: {
        content: string;
        audioBlob?: Blob;
        duration: number;
    }) => Promise<void> | void;
    context?: {
        page?: string;
        section?: string;
    };
    className?: string;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'playing' | 'error';

// Use global types from Web Speech API
interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
}

export function VoiceFeedback({
    onTranscription,
    onSubmit,
    context,
    className = ''
}: VoiceFeedbackProps) {
    const [state, setState] = useState<RecordingState>('idle');
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSupported, setIsSupported] = useState(true);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const startTimeRef = useRef<number>(0);
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Check browser support
    React.useEffect(() => {
        const supported = !!(window.webkitSpeechRecognition || window.SpeechRecognition);
        setIsSupported(supported);
    }, []);

    const cleanup = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            try {
                recognitionRef.current?.stop();
            } catch {
                // Ignore
            }
            recognitionRef.current = null;
        }

        if (mediaRecorderRef.current) {
            try {
                mediaRecorderRef.current.stop();
            } catch {
                // Ignore
            }
            mediaRecorderRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startRecording = useCallback(async () => {
        setError(null);
        setTranscription('');
        audioChunksRef.current = [];

        // Request microphone permission
        try {
            setState('requesting');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Setup MediaRecorder for audio capture
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            // Setup Web Speech API
            const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            if (!SpeechRecognitionAPI) {
                throw new Error('Speech recognition not supported');
            }

            const recognition = new SpeechRecognitionAPI();
            recognitionRef.current = recognition;

            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const results = event.results;
                if (results.length > 0) {
                    const latest = results[results.length - 1];
                    const transcript = latest[0].transcript;
                    setTranscription(transcript);
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                setError(`Speech recognition error: ${event.error}`);
                setState('error');
                cleanup();
            };

            recognition.onend = () => {
                setState('idle');
                cleanup();
            };

            // Start recording
            startTimeRef.current = Date.now();
            mediaRecorder.start(100); // Collect data every 100ms
            recognition.start();
            setState('recording');
        } catch (err: any) {
            setError(err.message || 'Failed to access microphone');
            setState('error');
            cleanup();
        }
    }, [cleanup]);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
        }

        setState('transcribing');

        // Process the recording
        setTimeout(() => {
            const duration = Date.now() - startTimeRef.current;
            const audioBlob = audioChunksRef.current.length > 0
                ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
                : undefined;

            onTranscription?.(transcription, audioBlob);

            // Store in localStorage
            const voiceQueue = JSON.parse(localStorage.getItem('voice_feedback_queue') || '[]');
            voiceQueue.push({
                content: transcription,
                duration,
                context,
                timestamp: new Date().toISOString(),
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });
            localStorage.setItem('voice_feedback_queue', JSON.stringify(voiceQueue.slice(-10)));

            setState('idle');
            cleanup();
        }, 500);
    }, [transcription, cleanup, onTranscription, context]);

    const handleSubmit = useCallback(async () => {
        if (!transcription.trim()) return;

        const duration = Date.now() - startTimeRef.current;
        const audioBlob = audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
            : undefined;

        try {
            if (onSubmit) {
                await onSubmit({ content: transcription, audioBlob, duration });
            } else {
                // Default: send to backend
                await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signal_type: 'question_asked',
                        content: transcription,
                        context: {
                            page: context?.page || window.location.pathname,
                            section: context?.section,
                            audio_duration_ms: duration
                        }
                    })
                });
            }

            setTranscription('');
            setIsExpanded(false);
        } catch (err) {
            setError('Failed to submit feedback');
        }
    }, [transcription, context, onSubmit]);

    const toggleExpand = useCallback(() => {
        setIsExpanded(prev => !prev);
        if (!isExpanded) {
            setTranscription('');
            setError(null);
        }
    }, [isExpanded]);

    if (!isSupported) {
        return (
            <div className={`voice-feedback-container ${className}`} title="Voice feedback not supported in this browser">
                <button disabled className="voice-feedback-button unsupported">
                    🎤
                </button>
                <style jsx>{`
                    .voice-feedback-button {
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        border: none;
                        background: #f0f0f0;
                        cursor: not-allowed;
                        font-size: 18px;
                        opacity: 0.5;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className={`voice-feedback-container ${className}`}>
            {!isExpanded ? (
                <button
                    onClick={toggleExpand}
                    className="voice-feedback-floating-button"
                    aria-label="Give voice feedback"
                    title="Voice feedback"
                >
                    🎤
                </button>
            ) : (
                <div className="voice-feedback-panel">
                    <div className="voice-feedback-header">
                        <span>Voice Feedback</span>
                        <button
                            onClick={toggleExpand}
                            className="voice-feedback-close"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    <div className="voice-feedback-content">
                        {state === 'idle' && !transcription && (
                            <div className="voice-feedback-placeholder">
                                <p>Tap the mic to start recording</p>
                            </div>
                        )}

                        {state === 'requesting' && (
                            <div className="voice-feedback-status">
                                <div className="voice-feedback-spinner"></div>
                                <p>Requesting microphone permission...</p>
                            </div>
                        )}

                        {state === 'recording' && (
                            <div className="voice-feedback-recording">
                                <div className="voice-feedback-waveform">
                                    <span className="voice-feedback-bar"></span>
                                    <span className="voice-feedback-bar"></span>
                                    <span className="voice-feedback-bar"></span>
                                    <span className="voice-feedback-bar"></span>
                                    <span className="voice-feedback-bar"></span>
                                </div>
                                <p>Recording... Tap mic to stop</p>
                            </div>
                        )}

                        {(transcription || state === 'transcribing') && (
                            <div className="voice-feedback-transcribing">
                                <textarea
                                    value={transcription}
                                    onChange={(e) => setTranscription(e.target.value)}
                                    placeholder="Your feedback will appear here..."
                                    className="voice-feedback-textarea"
                                    rows={3}
                                />
                                <div className="voice-feedback-actions">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!transcription.trim()}
                                        className="voice-feedback-submit"
                                    >
                                        Submit
                                    </button>
                                    <button
                                        onClick={() => {
                                            setTranscription('');
                                            setError(null);
                                        }}
                                        className="voice-feedback-clear"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="voice-feedback-error">
                                <p>{error}</p>
                                <button onClick={() => setError(null)} className="voice-feedback-retry">
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="voice-feedback-footer">
                        <button
                            onClick={state === 'recording' ? stopRecording : startRecording}
                            className={`voice-feedback-mic-btn ${state === 'recording' ? 'recording' : ''}`}
                            aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
                        >
                            {state === 'recording' ? '⏹️' : '🎤'}
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .voice-feedback-container {
                    position: relative;
                }

                .voice-feedback-floating-button {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    border: none;
                    background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(222, 52, 127, 0.4);
                    transition: all 0.2s ease;
                    z-index: 100;
                }

                .voice-feedback-floating-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(222, 52, 127, 0.5);
                }

                .voice-feedback-panel {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 320px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    z-index: 100;
                    overflow: hidden;
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .voice-feedback-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
                    color: white;
                }

                .voice-feedback-header span {
                    font-weight: 600;
                    font-size: 14px;
                }

                .voice-feedback-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .voice-feedback-close:hover {
                    opacity: 0.8;
                }

                .voice-feedback-content {
                    padding: 16px;
                    min-height: 120px;
                }

                .voice-feedback-placeholder {
                    text-align: center;
                    color: #666;
                }

                .voice-feedback-placeholder p {
                    margin: 0;
                    font-size: 14px;
                }

                .voice-feedback-status {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }

                .voice-feedback-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #e0e0e0;
                    border-top-color: #de347f;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .voice-feedback-status p {
                    margin: 0;
                    font-size: 13px;
                    color: #666;
                }

                .voice-feedback-recording {
                    text-align: center;
                }

                .voice-feedback-waveform {
                    display: flex;
                    justify-content: center;
                    gap: 4px;
                    height: 40px;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .voice-feedback-bar {
                    width: 4px;
                    height: 20px;
                    background: #de347f;
                    border-radius: 2px;
                    animation: waveform 1s ease-in-out infinite;
                }

                .voice-feedback-bar:nth-child(2) {
                    animation-delay: 0.1s;
                }

                .voice-feedback-bar:nth-child(3) {
                    animation-delay: 0.2s;
                }

                .voice-feedback-bar:nth-child(4) {
                    animation-delay: 0.3s;
                }

                .voice-feedback-bar:nth-child(5) {
                    animation-delay: 0.4s;
                }

                @keyframes waveform {
                    0%, 100% { height: 10px; }
                    50% { height: 30px; }
                }

                .voice-feedback-recording p {
                    margin: 0;
                    font-size: 13px;
                    color: #de347f;
                    font-weight: 500;
                }

                .voice-feedback-textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                    min-height: 80px;
                }

                .voice-feedback-textarea:focus {
                    outline: none;
                    border-color: #de347f;
                }

                .voice-feedback-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                    justify-content: flex-end;
                }

                .voice-feedback-submit {
                    background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                }

                .voice-feedback-submit:hover:not(:disabled) {
                    opacity: 0.9;
                }

                .voice-feedback-submit:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .voice-feedback-clear {
                    background: transparent;
                    border: none;
                    color: #666;
                    padding: 8px 12px;
                    font-size: 13px;
                    cursor: pointer;
                }

                .voice-feedback-clear:hover {
                    color: #333;
                }

                .voice-feedback-error {
                    text-align: center;
                    padding: 16px;
                    background: #fef2f2;
                    border-radius: 8px;
                }

                .voice-feedback-error p {
                    margin: 0 0 12px;
                    font-size: 13px;
                    color: #b42318;
                }

                .voice-feedback-retry {
                    background: #b42318;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                }

                .voice-feedback-footer {
                    display: flex;
                    justify-content: center;
                    padding: 12px 16px 16px;
                    background: #f8fafc;
                }

                .voice-feedback-mic-btn {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    border: none;
                    background: linear-gradient(135deg, #de347f 0%, #ff5d74 100%);
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(222, 52, 127, 0.4);
                    transition: all 0.2s ease;
                }

                .voice-feedback-mic-btn:hover {
                    transform: scale(1.05);
                }

                .voice-feedback-mic-btn.recording {
                    animation: pulse 1.5s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 4px 12px rgba(222, 52, 127, 0.4);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 6px 20px rgba(222, 52, 127, 0.6);
                    }
                }
            `}</style>
        </div>
    );
}

export default VoiceFeedback;
