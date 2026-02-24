/**
 * Self-Healing Engine
 * 
 * Monitors tasks and automatically attempts recovery with exponential backoff.
 * Escalates to operator after 3 failed attempts.
 */

/** Represents a healing attempt record */
export interface HealingAttempt {
  /** Unique identifier for this attempt */
  attemptId: string;
  /** Reference to the task being healed */
  taskId: string;
  /** The error that triggered healing */
  error: Error;
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Timestamp when attempt started */
  startedAt: Date;
  /** Timestamp when attempt completed (if finished) */
  completedAt?: Date;
  /** Whether the attempt succeeded */
  succeeded?: boolean;
  /** Recovery action that was taken */
  action: string;
  /** Additional context/metadata */
  metadata?: Record<string, unknown>;
}

/** Represents a healing event for logging/tracking */
export interface HealingEvent {
  /** Unique identifier for this event */
  eventId: string;
  /** Type of healing event */
  type: 'started' | 'retrying' | 'succeeded' | 'failed' | 'escalated';
  /** Associated task ID */
  taskId: string;
  /** Timestamp of the event */
  timestamp: Date;
  /** Human-readable message */
  message: string;
  /** The error being handled (if applicable) */
  error?: Error;
  /** Current attempt number */
  attemptNumber?: number;
  /** Delay before next retry (ms) */
  retryDelayMs?: number;
}

/** Configuration for the self-healing engine */
export interface SelfHealingConfig {
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs: number;
  /** Maximum number of retry attempts before escalation (default: 3) */
  maxAttempts: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Callback when escalation is required */
  onEscalate?: (taskId: string, error: Error, attempts: HealingAttempt[]) => void;
  /** Callback for healing events */
  onEvent?: (event: HealingEvent) => void;
}

/** Default configuration values */
const DEFAULT_CONFIG: SelfHealingConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  maxAttempts: 3,
  backoffMultiplier: 2,
};

/**
 * Self-Healing Engine
 * 
 * Provides automatic recovery mechanisms for failed tasks
 * with exponential backoff and operator escalation.
 */
export class SelfHealingEngine {
  private config: SelfHealingConfig;
  private attempts: Map<string, HealingAttempt[]> = new Map();
  private eventListeners: Set<(event: HealingEvent) => void> = new Set();

  constructor(config: Partial<SelfHealingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.onEvent) {
      this.eventListeners.add(this.config.onEvent);
    }
  }

  /**
   * Monitor a task that has encountered an error and begin healing process
   * 
   * @param taskId - Unique identifier for the task
   * @param error - The error that occurred
   * @returns Promise that resolves when healing is complete or escalates
   */
  async monitorTask(taskId: string, error: Error): Promise<void> {
    const attempts = this.attempts.get(taskId) || [];
    const attemptNumber = attempts.length + 1;

    this.emitEvent({
      eventId: this.generateId(),
      type: 'started',
      taskId,
      timestamp: new Date(),
      message: `Healing process started for task ${taskId}`,
      error,
      attemptNumber,
    });

    // Check if we've exceeded max attempts
    if (attemptNumber > this.config.maxAttempts) {
      this.escalateToOperator(taskId, error, attempts);
      return;
    }

    // Create healing attempt record
    const attempt: HealingAttempt = {
      attemptId: this.generateId(),
      taskId,
      error,
      attemptNumber,
      startedAt: new Date(),
      action: this.determineRecoveryAction(error),
    };

    // Calculate delay and wait
    const delayMs = this.retryWithBackoff(attemptNumber);
    
    this.emitEvent({
      eventId: this.generateId(),
      type: 'retrying',
      taskId,
      timestamp: new Date(),
      message: `Retrying task ${taskId} (attempt ${attemptNumber}/${this.config.maxAttempts}) after ${delayMs}ms delay`,
      error,
      attemptNumber,
      retryDelayMs: delayMs,
    });

    await this.delay(delayMs);

    // Execute recovery action
    try {
      await this.executeRecoveryAction(attempt);
      attempt.succeeded = true;
      attempt.completedAt = new Date();

      this.emitEvent({
        eventId: this.generateId(),
        type: 'succeeded',
        taskId,
        timestamp: new Date(),
        message: `Task ${taskId} healed successfully on attempt ${attemptNumber}`,
        attemptNumber,
      });

      // Clear attempts on success
      this.attempts.delete(taskId);
    } catch (recoveryError) {
      attempt.succeeded = false;
      attempt.completedAt = new Date();

      this.emitEvent({
        eventId: this.generateId(),
        type: 'failed',
        taskId,
        timestamp: new Date(),
        message: `Healing attempt ${attemptNumber} failed for task ${taskId}`,
        error: recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)),
        attemptNumber,
      });

      // Store attempt and check if we should escalate or retry
      attempts.push(attempt);
      this.attempts.set(taskId, attempts);

      if (attemptNumber >= this.config.maxAttempts) {
        this.escalateToOperator(taskId, error, attempts);
      }
    }
  }

  /**
   * Calculate exponential backoff delay for a retry attempt
   * 
   * @param attemptNumber - The current attempt number (1-based)
   * @returns Delay in milliseconds before next retry
   */
  retryWithBackoff(attemptNumber: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);
    // Add jitter (±20%) to prevent thundering herd
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.min(Math.floor(delay + jitter), this.config.maxDelayMs);
  }

  /**
   * Get healing attempts for a specific task
   * 
   * @param taskId - The task ID to look up
   * @returns Array of healing attempts (empty if none)
   */
  getAttemptsForTask(taskId: string): HealingAttempt[] {
    return this.attempts.get(taskId) || [];
  }

  /**
   * Clear healing history for a task
   * 
   * @param taskId - The task ID to clear
   */
  clearTaskHistory(taskId: string): void {
    this.attempts.delete(taskId);
  }

  /**
   * Add an event listener for healing events
   * 
   * @param listener - Callback function for events
   * @returns Unsubscribe function
   */
  subscribeToEvents(listener: (event: HealingEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Generate a unique ID */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /** Wait for a specified duration */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Emit an event to all listeners */
  private emitEvent(event: HealingEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[SelfHealingEngine] Event listener failed:', err);
      }
    });
  }

  /** Determine the appropriate recovery action based on error type */
  private determineRecoveryAction(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'retry-with-timeout-extension';
    }
    if (message.includes('rate') || message.includes('too many requests')) {
      return 'retry-with-backoff';
    }
    if (message.includes('network') || message.includes('econnrefused') || message.includes('econnreset')) {
      return 'retry-with-network-check';
    }
    if (message.includes('resource') || message.includes('busy')) {
      return 'retry-after-resource-release';
    }
    
    return 'retry-with-backoff';
  }

  /** Execute the determined recovery action */
  private async executeRecoveryAction(attempt: HealingAttempt): Promise<void> {
    attempt.metadata = { ...attempt.metadata, actionTaken: attempt.action };
    
    // Recovery logic based on action type
    switch (attempt.action) {
      case 'retry-with-timeout-extension':
        // Simulate extended timeout
        await this.delay(500);
        break;
      case 'retry-with-network-check':
        // Simulate network validation
        await this.delay(300);
        break;
      case 'retry-after-resource-release':
        // Simulate resource cleanup wait
        await this.delay(1000);
        break;
      default:
        // Standard retry
        await this.delay(100);
    }

    // For now, simulate success/failure based on random chance
    // In production, this would execute actual recovery logic
    if (Math.random() > 0.7) {
      throw new Error(`Recovery action "${attempt.action}" failed to resolve the issue`);
    }
  }

  /** Escalate to operator after max attempts reached */
  private escalateToOperator(
    taskId: string, 
    originalError: Error, 
    attempts: HealingAttempt[]
  ): void {
    this.emitEvent({
      eventId: this.generateId(),
      type: 'escalated',
      taskId,
      timestamp: new Date(),
      message: `Task ${taskId} escalated to operator after ${attempts.length} failed healing attempts`,
      error: originalError,
      attemptNumber: attempts.length,
    });

    if (this.config.onEscalate) {
      try {
        this.config.onEscalate(taskId, originalError, attempts);
      } catch (err) {
        console.error('[SelfHealingEngine] Escalation callback failed:', err);
      }
    }

    // Keep task history for debugging but mark as escalated
    this.attempts.delete(taskId);
  }
}

export default SelfHealingEngine;
