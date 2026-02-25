/**
 * Email Processor - Job Handler
 * 
 * Processes email jobs from the queue with:
 * - Rate limiting integration
 * - Exponential backoff retry logic
 * - Provider abstraction
 * - Failure handling and dead letter queue
 * - Comprehensive logging and metrics
 */

import {
  EmailRateLimiter,
  getEmailRateLimiter,
  extractDomain,
  type RateLimitCheck,
} from './rate-limiter';
import {
  EmailQueueService,
  getEmailQueueService,
  type EmailJobData,
  type EmailJobResult,
  type EmailJobProgress,
  QUEUE_NAMES,
} from './email-queue';

// ============================================================================
// TYPES
// ============================================================================

/** Email provider interface */
export interface EmailProvider {
  /** Provider name */
  name: string;
  /** Send email */
  send(data: EmailJobData): Promise<{ messageId: string; response: unknown }>;
  /** Validate provider configuration */
  validate(): Promise<{ valid: boolean; error?: string }>;
  /** Get provider health status */
  health(): Promise<{ healthy: boolean; latency: number }>;
}

/** Processing stage */
export type ProcessingStage = 
  | 'initialized'
  | 'validating'
  | 'rate_limit_check'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'retrying'
  | 'failed'
  | 'dead_letter';

/** Processing event */
export interface ProcessingEvent {
  eventId: string;
  jobId: string;
  stage: ProcessingStage;
  timestamp: Date;
  message?: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/** Email processor configuration */
export interface EmailProcessorConfig {
  /** Email provider for sending */
  provider: EmailProvider;
  /** Rate limiter instance */
  rateLimiter?: EmailRateLimiter;
  /** Queue service instance */
  queueService?: EmailQueueService;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Callback for processing events */
  onEvent?: (event: ProcessingEvent) => void;
  /** Callback for rate limit hits */
  onRateLimit?: (job: EmailJobData, check: RateLimitCheck) => void;
  /** Maximum retry attempts per job */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  baseDelayMs?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Maximum delay between retries (ms) */
  maxDelayMs?: number;
  /** Simulate sends (for testing) */
  simulate?: boolean;
}

/** Processing result */
export interface ProcessingResult {
  success: boolean;
  jobId: string;
  messageId?: string;
  error?: string;
  retryAfterMs?: number;
  stage: ProcessingStage;
  durationMs: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates email job data before processing
 */
function validateJobData(data: EmailJobData): { valid: boolean; error?: string } {
  // Required fields
  if (!data.to || typeof data.to !== 'string') {
    return { valid: false, error: 'Missing or invalid recipient email' };
  }
  
  if (!data.from || typeof data.from !== 'string') {
    return { valid: false, error: 'Missing or invalid sender email' };
  }
  
  if (!data.subject || typeof data.subject !== 'string') {
    return { valid: false, error: 'Missing or invalid subject' };
  }
  
  if (!data.html && !data.text) {
    return { valid: false, error: 'Email must have html or text content' };
  }
  
  if (!data.accountId || typeof data.accountId !== 'string') {
    return { valid: false, error: 'Missing or invalid account ID' };
  }
  
  if (typeof data.accountAgeInDays !== 'number' || data.accountAgeInDays < 0) {
    return { valid: false, error: 'Missing or invalid account age' };
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(data.to)) {
    return { valid: false, error: 'Invalid recipient email format' };
  }
  
  if (!emailRegex.test(data.from)) {
    return { valid: false, error: 'Invalid sender email format' };
  }
  
  // Size validation
  const totalSize = JSON.stringify(data).length;
  if (totalSize > 10 * 1024 * 1024) { // 10MB limit
    return { valid: false, error: 'Email data exceeds 10MB size limit' };
  }
  
  return { valid: true };
}

// ============================================================================
// SIMULATION PROVIDER (for development/testing)
// ============================================================================

class SimulatedEmailProvider implements EmailProvider {
  name = 'simulated';
  private shouldFail: boolean = false;
  private failureRate: number = 0;

  constructor(options?: { shouldFail?: boolean; failureRate?: number }) {
    this.shouldFail = options?.shouldFail ?? false;
    this.failureRate = options?.failureRate ?? 0;
  }

  async send(_data: EmailJobData): Promise<{ messageId: string; response: unknown }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for simulated failure
    if (this.shouldFail || Math.random() < this.failureRate) {
      throw new Error('Simulated send failure');
    }
    
    return {
      messageId: `simulated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      response: { status: 'sent', timestamp: new Date().toISOString() },
    };
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  async health(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    return {
      healthy: !this.shouldFail,
      latency: Date.now() - start,
    };
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
}

// ============================================================================
// EMAIL PROCESSOR
// ============================================================================

/**
 * Email Processor
 * 
 * Handles the full lifecycle of email job processing with retry logic,
 * rate limiting, and comprehensive error handling.
 */
export class EmailProcessor {
  private config: Required<EmailProcessorConfig>;
  private eventListeners: Set<(event: ProcessingEvent) => void> = new Set();
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private successCount: number = 0;
  private failureCount: number = 0;

  constructor(config: EmailProcessorConfig) {
    this.config = {
      provider: config.provider,
      rateLimiter: config.rateLimiter ?? getEmailRateLimiter(),
      queueService: config.queueService ?? getEmailQueueService(),
      logLevel: config.logLevel ?? 'info',
      onEvent: config.onEvent,
      onRateLimit: config.onRateLimit,
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 5000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxDelayMs: config.maxDelayMs ?? 300000, // 5 minutes
      simulate: config.simulate ?? false,
    };

    if (this.config.onEvent) {
      this.subscribe(this.config.onEvent);
    }

    this.initialize();
  }

  /**
   * Subscribe to processing events
   */
  subscribe(callback: (event: ProcessingEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Emit a processing event
   */
  private emit(event: ProcessingEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        // Soft failure
      }
    });
  }

  /**
   * Log message based on level
   */
  private log(level: NonNullable<EmailProcessorConfig['logLevel']>, message: string, meta?: Record<string, unknown>): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[this.config.logLevel]) {
      const timestamp = new Date().toISOString();
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      // eslint-disable-next-line no-console
      console.log(`[${timestamp}] [${level.toUpperCase()}] EmailProcessor: ${message}${metaStr}`);
    }
  }

  /**
   * Initialize the processor
   */
  private initialize(): void {
    // Set up queue processor
    this.config.queueService.process(async (job) => {
      const result = await this.processJob(job.data);
      return result;
    });

    this.log('info', 'Email processor initialized');
  }

  /**
   * Calculate delay for retry with jitter
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    
    // Add jitter (±20%) to prevent thundering herd
    const jitter = 0.8 + Math.random() * 0.4;
    return Math.floor(cappedDelay * jitter);
  }

  /**
   * Process a single email job
   */
  async processJob(data: EmailJobData): Promise<EmailJobResult> {
    const startTime = Date.now();
    const jobId = data.jobId;
    
    this.log('info', `Processing email job ${jobId}`, {
      to: data.to,
      from: data.from,
      accountId: data.accountId,
    });

    // Step 1: Validate job data
    this.emit({
      eventId: `${jobId}-validate`,
      jobId,
      stage: 'validating',
      timestamp: new Date(),
      message: 'Validating job data',
    });

    const validation = validateJobData(data);
    if (!validation.valid) {
      this.log('error', `Validation failed for job ${jobId}: ${validation.error}`);
      
      this.emit({
        eventId: `${jobId}-invalid`,
        jobId,
        stage: 'failed',
        timestamp: new Date(),
        message: validation.error,
      });

      this.failureCount++;
      this.processedCount++;

      return {
        success: false,
        sentAt: new Date(),
        error: validation.error,
      };
    }

    // Step 2: Check rate limits
    this.emit({
      eventId: `${jobId}-rate-check`,
      jobId,
      stage: 'rate_limit_check',
      timestamp: new Date(),
      message: 'Checking rate limits',
    });

    const domain = extractDomain(data.from);
    const rateCheck = this.config.rateLimiter.checkLimit(
      domain,
      data.accountId,
      data.accountAgeInDays
    );

    if (!rateCheck.allowed) {
      this.log('warn', `Rate limit hit for job ${jobId}: ${rateCheck.reason}`, {
        domain,
        accountId: data.accountId,
        retryAfter: rateCheck.retryAfterMs,
      });

      this.emit({
        eventId: `${jobId}-rate-limited`,
        jobId,
        stage: 'retrying',
        timestamp: new Date(),
        message: `Rate limited: ${rateCheck.reason}`,
        metadata: { retryAfterMs: rateCheck.retryAfterMs },
      });

      if (this.config.onRateLimit) {
        this.config.onRateLimit(data, rateCheck);
      }

      // Throw rate limit error - this will trigger queue retry
      const error = new Error(`RATE_LIMITED: ${rateCheck.reason}`);
      (error as Error & { retryAfterMs: number }).retryAfterMs = rateCheck.retryAfterMs || 60000;
      throw error;
    }

    this.log('debug', `Rate check passed for job ${jobId}`, {
      tier: rateCheck.limits.description,
      usage: rateCheck.currentUsage,
    });

    // Step 3: Send email
    this.emit({
      eventId: `${jobId}-sending`,
      jobId,
      stage: 'sending',
      timestamp: new Date(),
      message: 'Sending email',
    });

    try {
      const response = await this.sendEmail(data);

      // Step 4: Record success
      this.config.rateLimiter.recordSuccess(domain, data.accountId);

      this.log('info', `Email sent successfully for job ${jobId}`, {
        messageId: response.messageId,
        duration: Date.now() - startTime,
      });

      this.emit({
        eventId: `${jobId}-sent`,
        jobId,
        stage: 'sent',
        timestamp: new Date(),
        message: 'Email sent successfully',
        metadata: { messageId: response.messageId },
      });

      this.successCount++;
      this.processedCount++;

      return {
        success: true,
        messageId: response.messageId,
        providerResponse: response.response,
        sentAt: new Date(),
      };
    } catch (error) {
      // Record failure
      this.config.rateLimiter.recordFailure(domain, data.accountId);

      this.log('error', `Email send failed for job ${jobId}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      this.emit({
        eventId: `${jobId}-failed`,
        jobId,
        stage: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
        message: error instanceof Error ? error.message : String(error),
      });

      this.failureCount++;
      this.processedCount++;

      // Re-throw for queue retry handling
      throw error;
    }
  }

  /**
   * Send email through provider
   */
  private async sendEmail(data: EmailJobData): Promise<{ messageId: string; response: unknown }> {
    if (this.config.simulate) {
      const simProvider = new SimulatedEmailProvider();
      return simProvider.send(data);
    }

    return this.config.provider.send(data);
  }

  /**
   * Validate provider configuration
   */
  async validateProvider(): Promise<{ valid: boolean; error?: string }> {
    return this.config.provider.validate();
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(): Promise<{ healthy: boolean; latency: number }> {
    return this.config.provider.health();
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.config.queueService.pauseAll();
    this.isRunning = false;
    this.log('info', 'Email processor paused');
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.config.queueService.resumeAll();
    this.isRunning = true;
    this.log('info', 'Email processor resumed');
  }

  /**
   * Get processor statistics
   */  getStats(): {    processed: number;
    succeeded: number;
    failed: number;
    successRate: number;
    isRunning: boolean;
  } {
    return {
      processed: this.processedCount,
      succeeded: this.successCount,
      failed: this.failureCount,
      successRate: this.processedCount > 0 ? this.successCount / this.processedCount : 0,
      isRunning: this.isRunning,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<Record<string, unknown>> {
    return this.config.queueService.getAllStats();
  }

  /**
   * Requeue a failed job
   */
  async requeueJob(jobId: string): Promise<boolean> {
    return this.config.queueService.retryJob(jobId);
  }

  /**
   * Remove a job from queues
   */
  async removeJob(jobId: string): Promise<boolean> {
    return this.config.queueService.removeJob(jobId);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/** Singleton instance */
let globalEmailProcessor: EmailProcessor | null = null;

/**
 * Get or create the global email processor
 */
export function getEmailProcessor(config?: Partial<Omit<EmailProcessorConfig, 'provider'>> & { provider: EmailProvider }): EmailProcessor {
  if (!globalEmailProcessor) {
    const provider = config?.provider ?? new SimulatedEmailProvider();
    globalEmailProcessor = new EmailProcessor({ ...config, provider });
  }
  return globalEmailProcessor;
}

/**
 * Reset the global email processor
 */
export function resetEmailProcessor(): void {
  globalEmailProcessor = null;
}

/**
 * Create a simulated provider for testing
 */
export function createSimulatedProvider(options?: { failureRate?: number }): SimulatedEmailProvider {
  return new SimulatedEmailProvider(options);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Create email job data with defaults
 */
export function createEmailJob(
  data: Partial<EmailJobData> & { to: string; from: string; subject: string }
): EmailJobData {
  return {
    jobId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    html: data.text ? undefined : '<p>Email content</p>',
    text: data.html ? undefined : 'Email content',
    accountId: 'default',
    accountAgeInDays: 1,
    priority: 'normal',
    maxRetries: 3,
    tags: [],
    metadata: {},
    ...data,
  };
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is Error & { retryAfterMs: number } {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith('RATE_LIMITED:');
}
