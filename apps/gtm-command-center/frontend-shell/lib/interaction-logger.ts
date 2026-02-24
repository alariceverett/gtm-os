/**
 * Interaction Logger
 * 
 * Captures: clicks, hovers, scrolls, key presses
 * Batches: Sends to backend every 30s or on session end
 * Privacy: Doesn't capture sensitive inputs
 */

// Types
export interface InteractionEvent {
    id: string;
    type: 'click' | 'hover' | 'scroll' | 'keypress' | 'focus' | 'blur' | 'view';
    timestamp: number;
    element?: {
        tag: string;
        id?: string;
        className?: string;
        text?: string;
        role?: string;
    };
    position?: {
        x: number;
        y: number;
    };
    metadata?: Record<string, any>;
}

export interface InteractionBatch {
    userId: string;
    sessionId: string;
    startTime: number;
    endTime: number;
    events: InteractionEvent[];
    pageUrl: string;
}

export interface LoggerConfig {
    /** Batch interval in milliseconds (default: 30000 = 30s) */
    batchIntervalMs?: number;
    /** Max events before immediate flush (default: 50) */
    maxEvents?: number;
    /** Enable/disable logging (default: true) */
    enabled?: boolean;
    /** User ID resolver */
    getUserId?: () => string;
    /** Session ID resolver */
    getSessionId?: () => string;
    /** Privacy mode - exclude sensitive elements */
    privacyMode?: boolean;
    /** Callback when batch is sent */
    onBatchSent?: (batch: InteractionBatch) => void;
    /** Elements to exclude from tracking (selectors) */
    excludeSelectors?: string[];
}

// Constants
const DEFAULT_BATCH_INTERVAL = 30000;
const DEFAULT_MAX_EVENTS = 50;
const EXCLUDED_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const EXCLUDED_INPUT_TYPES = ['password', 'email', 'tel', 'credit-card'];
const EXCLUDED_SELECTORS = ['[data-private]', '[data-sensitive]', '.no-track'];

// Generate unique IDs
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get or create session ID
function getSessionId(): string {
    if (typeof window === 'undefined') return 'server';

    let sessionId = sessionStorage.getItem('interaction_session_id');
    if (!sessionId) {
        sessionId = generateId();
        sessionStorage.setItem('interaction_session_id', sessionId);
    }
    return sessionId;
}

// Get or create user ID
function getUserId(): string {
    if (typeof window === 'undefined') return 'anonymous';

    let userId = localStorage.getItem('interaction_user_id');
    if (!userId) {
        userId = generateId();
        localStorage.setItem('interaction_user_id', userId);
    }
    return userId;
}

// Check if element is sensitive
function isSensitiveElement(element: Element | null): boolean {
    if (!element) return false;

    // Check tag name
    const tagName = element.tagName.toUpperCase();

    // Check input type
    if (tagName === 'INPUT') {
        const inputType = (element as HTMLInputElement).type?.toLowerCase();
        if (EXCLUDED_INPUT_TYPES.includes(inputType)) return true;
    }

    // Check for sensitive classes or attributes
    const hasSensitiveClass = EXCLUDED_SELECTORS.some(selector =>
        element.matches(selector)
    );

    return hasSensitiveClass || EXCLUDED_TAGS.includes(tagName);
}

// Sanitize element data
function sanitizeElementData(element: Element | null, privacyMode: boolean): InteractionEvent['element'] {
    if (!element) return undefined;

    // Never capture sensitive elements
    if (isSensitiveElement(element)) {
        return { tag: element.tagName.toLowerCase() };
    }

    const sanitized: InteractionEvent['element'] = {
        tag: element.tagName.toLowerCase()
    };

    // Safe attributes to capture
    const id = element.id;
    if (id) sanitized.id = id;

    const className = element.className;
    if (className && typeof className === 'string') {
        // Limit class string length
        sanitized.className = className.split(' ').slice(0, 5).join(' ');
    }

    const role = element.getAttribute('role');
    if (role) sanitized.role = role;

    // Only capture text for non-private mode
    if (!privacyMode) {
        const text = element.textContent?.trim().slice(0, 50);
        if (text) sanitized.text = text;
    }

    return sanitized;
}

// Main class
class InteractionLogger {
    private events: InteractionEvent[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private sessionStartTime: number = Date.now();
    private config: Required<LoggerConfig>;
    private isActive: boolean = false;
    private flushed: boolean = false;

    constructor(config: LoggerConfig = {}) {
        this.config = {
            batchIntervalMs: config.batchIntervalMs ?? DEFAULT_BATCH_INTERVAL,
            maxEvents: config.maxEvents ?? DEFAULT_MAX_EVENTS,
            enabled: config.enabled ?? true,
            getUserId: config.getUserId ?? getUserId,
            getSessionId: config.getSessionId ?? getSessionId,
            privacyMode: config.privacyMode ?? true,
            onBatchSent: config.onBatchSent ?? (() => { }),
            excludeSelectors: config.excludeSelectors ?? []
        };

        if (typeof window !== 'undefined' && this.config.enabled) {
            this.initialize();
        }
    }

    private initialize() {
        this.isActive = true;
        this.sessionStartTime = Date.now();

        // Start batch timer
        this.startBatchTimer();

        // Setup event listeners
        this.setupEventListeners();

        // Handle page unload
        this.handlePageUnload();
    }

    private setupEventListeners() {
        // Click tracking
        document.addEventListener('click', (e) => {
            if (!this.shouldTrackElement(e.target as Element)) return;

            this.log('click', {
                element: e.target as Element,
                position: { x: e.clientX, y: e.clientY }
            });
        }, { passive: true });

        // Hover tracking (debounced)
        let hoverTimeout: NodeJS.Timeout;
        document.addEventListener('mouseover', (e) => {
            if (!this.shouldTrackElement(e.target as Element)) return;

            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                this.log('hover', {
                    element: e.target as Element
                });
            }, 500);
        }, { passive: true });

        // Scroll tracking (throttled)
        let lastScrollTime = 0;
        window.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScrollTime < 500) return; // Throttle to 500ms
            lastScrollTime = now;

            this.log('scroll', {
                metadata: {
                    scrollY: window.scrollY,
                    scrollX: window.scrollX
                }
            });
        }, { passive: true });

        // Focus tracking
        document.addEventListener('focus', (e) => {
            if (!this.shouldTrackElement(e.target as Element)) return;
            this.log('focus', { element: e.target as Element });
        }, { passive: true });

        // Blur tracking
        document.addEventListener('blur', (e) => {
            if (!this.shouldTrackElement(e.target as Element)) return;
            this.log('blur', { element: e.target as Element });
        }, { passive: true });

        // View tracking (using Page Visibility API)
        document.addEventListener('visibilitychange', () => {
            this.log('view', {
                metadata: { visible: document.visibilityState === 'visible' }
            });
        });
    }

    private handlePageUnload() {
        // Send final batch on page unload
        const flushOnUnload = () => {
            this.flushSync();
        };

        window.addEventListener('pagehide', flushOnUnload);
        window.addEventListener('beforeunload', flushOnUnload);
    }

    private shouldTrackElement(element: Element | null): boolean {
        if (!element) return false;

        // Skip if matches exclude selectors
        const { excludeSelectors } = this.config;
        for (const selector of excludeSelectors) {
            if (element.matches(selector) || element.closest(selector)) {
                return false;
            }
        }

        return true;
    }

    private startBatchTimer() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }

        this.batchTimer = setInterval(() => {
            this.flush();
        }, this.config.batchIntervalMs);
    }

    public log(type: InteractionEvent['type'], data: {
        element?: Element | null;
        position?: { x: number; y: number };
        metadata?: Record<string, any>;
    }) {
        if (!this.isActive || this.flushed) return;

        const event: InteractionEvent = {
            id: generateId(),
            type,
            timestamp: Date.now(),
            element: data.element ? sanitizeElementData(data.element, this.config.privacyMode) : undefined,
            position: data.position,
            metadata: data.metadata
        };

        this.events.push(event);

        // Flush if max events reached
        if (this.events.length >= this.config.maxEvents) {
            this.flush();
        }
    }

    public flush(): Promise<void> {
        if (this.events.length === 0) return Promise.resolve();

        const batch: InteractionBatch = {
            userId: this.config.getUserId(),
            sessionId: this.config.getSessionId(),
            startTime: this.sessionStartTime,
            endTime: Date.now(),
            events: [...this.events],
            pageUrl: typeof window !== 'undefined' ? window.location.href : ''
        };

        // Clear events immediately
        this.events = [];

        // Send to backend
        return this.sendBatch(batch);
    }

    private flushSync() {
        if (this.events.length === 0) return;

        const batch: InteractionBatch = {
            userId: this.config.getUserId(),
            sessionId: this.config.getSessionId(),
            startTime: this.sessionStartTime,
            endTime: Date.now(),
            events: [...this.events],
            pageUrl: typeof window !== 'undefined' ? window.location.href : ''
        };

        this.events = [];

        // Try to use sendBeacon for sync send on unload
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' });
            navigator.sendBeacon('/api/feedback/batch', blob);
        } else {
            // Fallback: store in localStorage for next session
            try {
                const pending = JSON.parse(localStorage.getItem('pending_batches') || '[]');
                pending.push(batch);
                localStorage.setItem('pending_batches', JSON.stringify(pending.slice(-10)));
            } catch {
                // Ignore storage errors
            }
        }

        this.config.onBatchSent(batch);
    }

    private async sendBatch(batch: InteractionBatch): Promise<void> {
        // Store in localStorage first (as backup)
        try {
            const pending = JSON.parse(localStorage.getItem('pending_batches') || '[]');
            pending.push(batch);
            localStorage.setItem('pending_batches', JSON.stringify(pending.slice(-20)));
        } catch {
            // Ignore storage errors
        }

        // Send to backend
        try {
            const response = await fetch('/api/feedback/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: batch.userId,
                    session_id: batch.sessionId,
                    batch_data: {
                        events: batch.events,
                        page_url: batch.pageUrl,
                        start_time: batch.startTime,
                        end_time: batch.endTime
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to send batch');

            // Remove from pending on success
            try {
                const pending = JSON.parse(localStorage.getItem('pending_batches') || '[]');
                const filtered = pending.filter(
                    (p: InteractionBatch) => p.sessionId !== batch.sessionId || p.startTime !== batch.startTime
                );
                localStorage.setItem('pending_batches', JSON.stringify(filtered));
            } catch {
                // Ignore storage errors
            }
        } catch (error) {
            console.warn('Failed to send interaction batch:', error);
            // Batch remains in localStorage for retry
        }

        this.config.onBatchSent(batch);
    }

    public pause() {
        this.isActive = false;
    }

    public resume() {
        this.isActive = true;
    }

    public destroy() {
        this.isActive = false;
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        this.flushSync();
    }

    public getQueueSize(): number {
        return this.events.length;
    }
}

// Export singleton instance
let loggerInstance: InteractionLogger | null = null;

export function createInteractionLogger(config?: LoggerConfig): InteractionLogger {
    if (!loggerInstance) {
        loggerInstance = new InteractionLogger(config);
    }
    return loggerInstance;
}

export function getInteractionLogger(): InteractionLogger | null {
    return loggerInstance;
}

export function pauseInteractionLogger() {
    loggerInstance?.pause();
}

export function resumeInteractionLogger() {
    loggerInstance?.resume();
}

export function flushInteractionLogger() {
    return loggerInstance?.flush();
}

// React hook for component tracking
export function useInteractionLogger() {
    return {
        log: (type: InteractionEvent['type'], data: Parameters<InteractionLogger['log']>[1]) => {
            loggerInstance?.log(type, data);
        },
        pause: pauseInteractionLogger,
        resume: resumeInteractionLogger,
        flush: flushInteractionLogger
    };
}

// Auto-initialize on import (for Next.js)
if (typeof window !== 'undefined') {
    createInteractionLogger();
}

export default InteractionLogger;
