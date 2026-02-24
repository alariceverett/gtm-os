'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface DwellTimeConfig {
    /** Threshold in milliseconds before emitting a dwell signal (default: 10000 = 10s) */
    threshold?: number;
    /** Section identifier */
    sectionId: string;
    /** Page identifier */
    page?: string;
    /** Whether to track scroll depth (default: true) */
    trackScrollDepth?: boolean;
    /** Callback when dwell threshold is reached */
    onDwell?: (data: DwellTimeEvent) => void;
    /** Debounce time for scroll updates in ms (default: 100) */
    scrollDebounceMs?: number;
}

export interface DwellTimeEvent {
    signal_type: 'implicit_dwell';
    sectionId: string;
    page: string;
    duration: number;
    scrollDepth: number;
    timestamp: string;
    context: {
        page: string;
        section: string;
        duration_ms: number;
        scroll_depth: number;
        viewport_height: number;
        document_height: number;
    };
}

interface DwellTimeState {
    startTime: number;
    hasTriggered: boolean;
    scrollDepth: number;
    isVisible: boolean;
}

/**
 * Hook to track time spent on sections
 * Emits signal when >threshold (e.g., 10s)
 * Includes: section id, duration, scroll depth
 */
export function useDwellTime({
    threshold = 10000,
    sectionId,
    page,
    trackScrollDepth = true,
    onDwell,
    scrollDebounceMs = 100
}: DwellTimeConfig) {
    const stateRef = useRef<DwellTimeState>({
        startTime: Date.now(),
        hasTriggered: false,
        scrollDepth: 0,
        isVisible: true
    });

    const rafRef = useRef<number | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const [isTracking, setIsTracking] = useState(true);

    const calculateScrollDepth = useCallback(() => {
        if (typeof window === 'undefined') return 0;

        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY;

        if (docHeight <= 0) return 1;

        // Get the element's position if we have a ref
        let elementProgress = 0;
        if (elementRef.current) {
            const rect = elementRef.current.getBoundingClientRect();
            const elementTop = rect.top + window.scrollY;
            const elementHeight = rect.height;
            const elementVisible = elementTop <= scrolled + window.innerHeight &&
                elementTop + elementHeight >= scrolled;

            if (elementVisible) {
                // Calculate how much of the element has been viewed
                const visibleTop = Math.max(scrolled, elementTop);
                const visibleBottom = Math.min(scrolled + window.innerHeight, elementTop + elementHeight);
                const visibleHeight = Math.max(0, visibleBottom - visibleTop);
                elementProgress = visibleHeight / elementHeight;
            }
        }

        return Math.min(1, Math.max(0, scrolled / docHeight));
    }, []);

    const emitDwellSignal = useCallback(() => {
        const state = stateRef.current;

        if (state.hasTriggered || !state.isVisible) return;

        const duration = Date.now() - state.startTime;

        if (duration >= threshold) {
            state.hasTriggered = true;

            const event: DwellTimeEvent = {
                signal_type: 'implicit_dwell',
                sectionId,
                page: page || window.location.pathname,
                duration,
                scrollDepth: state.scrollDepth,
                timestamp: new Date().toISOString(),
                context: {
                    page: page || window.location.pathname,
                    section: sectionId,
                    duration_ms: duration,
                    scroll_depth: state.scrollDepth,
                    viewport_height: window.innerHeight,
                    document_height: document.documentElement.scrollHeight
                }
            };

            // Call the callback
            if (onDwell) {
                onDwell(event);
            }

            // Store in localStorage for batching
            const dwellQueue = JSON.parse(localStorage.getItem('dwell_queue') || '[]');
            dwellQueue.push({
                ...event,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });
            localStorage.setItem('dwell_queue', JSON.stringify(dwellQueue.slice(-20)));

            // Send to backend
            try {
                fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signal_type: 'implicit_dwell',
                        context: event.context,
                        outcome: { dwell_completed: true }
                    })
                }).catch(() => {
                    // Fail silently - data is queued
                });
            } catch {
                // Ignore network errors
            }
        }
    }, [threshold, sectionId, page, onDwell]);

    // Handle visibility change
    const handleVisibilityChange = useCallback(() => {
        const isVisible = document.visibilityState === 'visible';
        stateRef.current.isVisible = isVisible;

        if (isVisible) {
            // Reset start time when becoming visible again
            stateRef.current.startTime = Date.now();
        }
    }, []);

    // Handle scroll with debounce
    const handleScroll = useCallback(() => {
        if (!trackScrollDepth) return;

        if (scrollDebounceRef.current) {
            clearTimeout(scrollDebounceRef.current);
        }

        scrollDebounceRef.current = setTimeout(() => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }

            rafRef.current = requestAnimationFrame(() => {
                const depth = calculateScrollDepth();
                stateRef.current.scrollDepth = Math.max(
                    stateRef.current.scrollDepth,
                    depth
                );
            });
        }, scrollDebounceMs);
    }, [trackScrollDepth, scrollDebounceMs, calculateScrollDepth]);

    // Intersection Observer for visibility
    useEffect(() => {
        if (typeof window === 'undefined' || !elementRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    stateRef.current.isVisible = entry.isIntersecting;

                    if (entry.isIntersecting) {
                        // Reset start time when element comes into view
                        stateRef.current.startTime = Date.now();
                        stateRef.current.hasTriggered = false;
                    }
                });
            },
            { threshold: 0.1 } // Trigger when 10% visible
        );

        observer.observe(elementRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    // Setup scroll listener
    useEffect(() => {
        if (typeof window === 'undefined' || !trackScrollDepth) return;

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [trackScrollDepth, handleScroll]);

    // Setup visibility listener
    useEffect(() => {
        if (typeof document === 'undefined') return;

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleVisibilityChange]);

    // Main dwell tracking interval
    useEffect(() => {
        if (!isTracking) return;

        intervalRef.current = setInterval(() => {
            emitDwellSignal();
        }, 1000); // Check every second

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isTracking, emitDwellSignal]);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            if (scrollDebounceRef.current) {
                clearTimeout(scrollDebounceRef.current);
            }
        };
    }, []);

    const ref = useCallback((node: HTMLElement | null) => {
        elementRef.current = node;
    }, []);

    const pauseTracking = useCallback(() => {
        setIsTracking(false);
        stateRef.current.isVisible = false;
    }, []);

    const resumeTracking = useCallback(() => {
        setIsTracking(true);
        stateRef.current.startTime = Date.now();
        stateRef.current.isVisible = true;
        stateRef.current.hasTriggered = false;
    }, []);

    const resetTracking = useCallback(() => {
        stateRef.current = {
            startTime: Date.now(),
            hasTriggered: false,
            scrollDepth: 0,
            isVisible: true
        };
    }, []);

    return {
        ref,
        isTracking,
        pauseTracking,
        resumeTracking,
        resetTracking,
        scrollDepth: stateRef.current.scrollDepth
    };
}

// Helper component wrapper for easier usage
export interface DwellTimeTrackerProps {
    sectionId: string;
    page?: string;
    threshold?: number;
    children: React.ReactNode;
    className?: string;
    onDwell?: (data: DwellTimeEvent) => void;
}

export function DwellTimeTracker({
    sectionId,
    page,
    threshold,
    children,
    className,
    onDwell
}: DwellTimeTrackerProps) {
    const { ref } = useDwellTime({
        sectionId,
        page,
        threshold,
        onDwell
    });

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}

export default useDwellTime;
