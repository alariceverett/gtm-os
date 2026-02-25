/**
 * Email Queue - Bull/Redis Queue Setup
 * 
 * Manages email sending queue with:
 * - Multiple queue types (high priority, normal, bulk)
 * - Dead letter queue for failed emails
 * - Retry logic with exponential backoff
 * - Job scheduling and rate limiting integration
 */

/** Email job data structure */
export interface EmailJobData {
  /** Unique job ID */
  jobId: string;
  /** Email recipient */
  to: string;
  /** Email sender */
  from: string;
  /** Email subject */
  subject: string;
  /** HTML content */
  html?: string;
  /** Plain text content */
  text?: string;
  /** Account identifier for rate limiting */
  accountId: string;
  /** Account age in days for tier calculation */
  accountAgeInDays: number;
  /** Sequence/campaign ID if applicable */
  campaignId?: string;
  /** Sequence step number */
  stepNumber?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Scheduled send time */
  scheduledFor?: Date;
  /** Priority level */
  priority?: 'critical' | 'high' | 'normal' | 'low';
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Tags for categorization */
  tags?: string[];
}

/** Email job result */
export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  providerResponse?: unknown;
  sentAt: Date;
  error?: string;
}

/** Job progress information */
export interface EmailJobProgress {
  stage: 'queued' | 'rate_limit_check' | 'sending' | 'sent' | 'failed';
  progress: number; // 0-100
  message?: string;
}

/** Queue configuration options */
export interface QueueConfig {
  /** Redis connection URL */
  redisUrl?: string;
  /** Redis connection options */
  redisOptions?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  /** Default job options */
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type?: 'fixed' | 'exponential';
      delay?: number;
    };
    delay?: number;
    priority?: number;
  };
  /** Max concurrent jobs */
  concurrency?: number;
  /** Queue limit settings */
  limits?: {
    maxWaiting?: number;
    maxActive?: number;
    maxCompleted?: number;
    maxFailed?: number;
    maxDelayed?: number;
  };
}

/** Queue statistics */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized: number;
}

/** Queue event types */
export type QueueEventType = 
  | 'job:added'
  | 'job:completed'
  | 'job:failed'
  | 'job:retry'
  | 'job:delayed'
  | 'job:removed'
  | 'queue:paused'
  | 'queue:resumed'
  | 'queue:drained'
  | 'dead:letter:moved';

/** Queue event */
export interface QueueEvent {
  type: QueueEventType;
  timestamp: Date;
  jobId?: string;
  data?: unknown;
  error?: Error;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Queue names */
export const QUEUE_NAMES = {
  /** High priority queue for critical emails */
  HIGH_PRIORITY: 'email:priority',
  /** Normal queue for standard emails */
  NORMAL: 'email:normal',
  /** Bulk queue for mass campaigns */
  BULK: 'email:bulk',
  /** Dead letter queue for failed emails */
  DEAD_LETTER: 'email:dead-letter',
} as const;

/** Priority to queue mapping */
export const PRIORITY_QUEUES: Record<NonNullable<EmailJobData['priority']>, typeof QUEUE_NAMES.HIGH_PRIORITY | typeof QUEUE_NAMES.NORMAL | typeof QUEUE_NAMES.BULK> = {
  critical: QUEUE_NAMES.HIGH_PRIORITY,
  high: QUEUE_NAMES.HIGH_PRIORITY,
  normal: QUEUE_NAMES.NORMAL,
  low: QUEUE_NAMES.BULK,
};

/** Default delay settings (ms) */
export const DEFAULT_BACKOFF = {
  type: 'exponential' as const,
  delay: 5000, // 5 seconds initial delay
};

/** Maximum retry attempts */
export const MAX_RETRIES = 3;

/** Delay between retries (exponential backoff) */
export const RETRY_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s

// ============================================================================
// BULLMQ MOCK IMPLEMENTATION (for development without Redis)
// ============================================================================

/** Simulated job for in-memory queue */
interface SimulatedJob {
  id: string;
  data: EmailJobData;
  attemptsMade: number;
  failedReason?: string;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  priority: number;
  delayUntil?: Date;
}

/** In-memory queue implementation for development/testing */
class InMemoryQueue {
  private jobs: Map<string, SimulatedJob> = new Map();
  private waiting: string[] = [];
  private processor?: (job: SimulatedJob) => Promise<EmailJobResult>;
  private eventListeners: Set<(event: QueueEvent) => void> = new Set();
  private isPaused = false;
  private isProcessing = false;
  private config: QueueConfig;
  private name: string;
  private deadLetterQueue?: InMemoryQueue;

  constructor(name: string, config: QueueConfig) {
    this.name = name;
    this.config = config;
  }

  setDeadLetterQueue(queue: InMemoryQueue): void {
    this.deadLetterQueue = queue;
  }

  on(event: string, listener: (event: QueueEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: QueueEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        // Soft failure
      }
    });
  }

  async add(jobId: string, data: EmailJobData, opts?: { delay?: number; priority?: number }): Promise<SimulatedJob> {
    const job: SimulatedJob = {
      id: jobId,
      data,
      attemptsMade: 0,
      createdAt: new Date(),
      status: 'waiting',
      priority: opts?.priority ?? 0,
      delayUntil: opts?.delay ? new Date(Date.now() + opts.delay) : undefined,
    };

    this.jobs.set(jobId, job);
    
    if (!opts?.delay || opts.delay <= 0) {
      this.insertInPriorityOrder(jobId, job.priority);
    }

    this.emit({
      type: 'job:added',
      timestamp: new Date(),
      jobId,
      data: { queue: this.name },
    });

    void this.processQueue();
    return job;
  }

  private insertInPriorityOrder(jobId: string, priority: number): void {
    const insertIndex = this.waiting.findIndex(id => {
      const job = this.jobs.get(id);
      return job && job.priority < priority;
    });
    
    if (insertIndex === -1) {
      this.waiting.push(jobId);
    } else {
      this.waiting.splice(insertIndex, 0, jobId);
    }
  }

  async getJob(jobId: string): Promise<SimulatedJob | undefined> {
    return this.jobs.get(jobId);
  }

  async getJobs(status: SimulatedJob['status'][]): Promise<SimulatedJob[]> {
    return Array.from(this.jobs.values()).filter(job => status.includes(job.status));
  }

  async remove(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
    const index = this.waiting.indexOf(jobId);
    if (index > -1) {
      this.waiting.splice(index, 1);
    }

    this.emit({
      type: 'job:removed',
      timestamp: new Date(),
      jobId,
    });
  }

  async getCounts(): Promise<QueueStats> {
    const jobs = Array.from(this.jobs.values());
    return {
      waiting: jobs.filter(j => j.status === 'waiting').length,
      active: jobs.filter(j => j.status === 'active').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      delayed: jobs.filter(j => j.status === 'delayed' || (j.delayUntil && j.delayUntil > new Date())).length,
      paused: this.isPaused ? jobs.filter(j => j.status === 'waiting').length : 0,
      prioritized: jobs.filter(j => j.priority > 0).length,
    };
  }

  process(concurrency: number, processor: (job: SimulatedJob) => Promise<EmailJobResult>): void {
    this.config.concurrency = concurrency;
    this.processor = processor;
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || !this.processor) return;
    
    this.isProcessing = true;

    try {
      while (this.waiting.length > 0 && !this.isPaused) {
        const activeCount = Array.from(this.jobs.values()).filter(j => j.status === 'active').length;
        if (activeCount >= (this.config.concurrency || 1)) {
          break;
        }

        const jobId = this.waiting.shift();
        if (!jobId) continue;

        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'waiting') continue;

        // Check if job has a future delay
        if (job.delayUntil && job.delayUntil > new Date()) {
          const delayMs = job.delayUntil.getTime() - Date.now();
          setTimeout(() => {
            job.status = 'waiting';
            this.insertInPriorityOrder(jobId, job.priority);
            void this.processQueue();
          }, delayMs);
          continue;
        }

        job.status = 'active';
        job.processedAt = new Date();

        void this.processJob(job);
      }

      if (this.waiting.length === 0) {
        const counts = await this.getCounts();
        if (counts.waiting === 0 && counts.active === 0) {
          this.emit({
            type: 'queue:drained',
            timestamp: new Date(),
            data: { queue: this.name },
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: SimulatedJob): Promise<void> {
    if (!this.processor) return;

    try {
      const result = await this.processor(job);
      
      job.status = 'completed';
      job.completedAt = new Date();
      
      this.emit({
        type: 'job:completed',
        timestamp: new Date(),
        jobId: job.id,
        data: result,
      });
    } catch (error) {
      job.attemptsMade++;
      
      const maxRetries = job.data.maxRetries ?? MAX_RETRIES;
      
      if (job.attemptsMade < maxRetries) {
        // Calculate exponential backoff
        const delay = RETRY_DELAYS[Math.min(job.attemptsMade - 1, RETRY_DELAYS.length - 1)];
        
        job.status = 'waiting';
        job.delayUntil = new Date(Date.now() + delay);
        
        this.emit({
          type: 'job:retry',
          timestamp: new Date(),
          jobId: job.id,
          data: { attempt: job.attemptsMade, delay },
        });

        setTimeout(() => {
          job.delayUntil = undefined;
          this.insertInPriorityOrder(job.id, job.priority);
          void this.processQueue();
        }, delay);
      } else {
        job.status = 'failed';
        job.failedReason = error instanceof Error ? error.message : String(error);
        
        this.emit({
          type: 'job:failed',
          timestamp: new Date(),
          jobId: job.id,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        // Move to dead letter queue
        if (this.deadLetterQueue) {
          await this.deadLetterQueue.add(job.id, job.data, { priority: job.priority });
          this.emit({
            type: 'dead:letter:moved',
            timestamp: new Date(),
            jobId: job.id,
            data: { reason: 'max retries exceeded' },
          });
        }
      }
    } finally {
      void this.processQueue();
    }
  }

  pause(): void {
    this.isPaused = true;
    this.emit({
      type: 'queue:paused',
      timestamp: new Date(),
      data: { queue: this.name },
    });
  }

  resume(): void {
    this.isPaused = false;
    this.emit({
      type: 'queue:resumed',
      timestamp: new Date(),
      data: { queue: this.name },
    });
    void this.processQueue();
  }

  obliterate(): Promise<void> {
    this.jobs.clear();
    this.waiting = [];
    return Promise.resolve();
  }
}

// ============================================================================
// EMAIL QUEUE SERVICE
// ============================================================================

/** Email Queue Service */
export class EmailQueueService {
  private queues: Map<string, InMemoryQueue> = new Map();
  private config: QueueConfig;
  private processor?: (job: { data: EmailJobData }) => Promise<EmailJobResult>;
  private eventListeners: Set<(event: QueueEvent) => void> = new Set();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrency: 5,
      defaultJobOptions: {
        attempts: MAX_RETRIES,
        backoff: DEFAULT_BACKOFF,
      },
      ...config,
    };

    // Initialize queues
    this.initializeQueues();
  }

  private initializeQueues(): void {
    // Create all queues
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queue = new InMemoryQueue(queueName, this.config);
      
      // Forward events from all queues
      queue.on('*', (event: QueueEvent) => {
        this.eventListeners.forEach(listener => {
          try {
            listener(event);
          } catch {
            // Soft failure
          }
        });
      });

      this.queues.set(queueName, queue);
    }

    // Set up dead letter relationships
    const deadLetter = this.queues.get(QUEUE_NAMES.DEAD_LETTER);
    if (deadLetter) {
      for (const queueName of [QUEUE_NAMES.HIGH_PRIORITY, QUEUE_NAMES.NORMAL, QUEUE_NAMES.BULK]) {
        const queue = this.queues.get(queueName);
        if (queue) {
          queue.setDeadLetterQueue(deadLetter);
        }
      }
    }
  }

  /**
   * Subscribe to queue events
   */
  subscribe(callback: (event: QueueEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Get a queue by name
   */
  getQueue(name: string): InMemoryQueue | undefined {
    return this.queues.get(name);
  }

  /**
   * Get the appropriate queue for an email job based on priority
   */
  getQueueForPriority(priority: EmailJobData['priority']): InMemoryQueue {
    const queueName = PRIORITY_QUEUES[priority || 'normal'];
    return this.queues.get(queueName) || this.queues.get(QUEUE_NAMES.NORMAL)!;
  }

  /**
   * Add an email job to the queue
   */
  async addEmail(data: EmailJobData): Promise<{ id: string; queue: string }> {
    const jobId = data.jobId || `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queue = this.getQueueForPriority(data.priority);
    const priority = this.calculatePriority(data.priority);
    
    await queue.add(jobId, data, { 
      priority,
      delay: data.scheduledFor ? data.scheduledFor.getTime() - Date.now() : undefined,
    });

    return { id: jobId, queue: queue.name };
  }

  /**
   * Calculate numeric priority for queue ordering
   */
  private calculatePriority(priority?: EmailJobData['priority']): number {
    switch (priority) {
      case 'critical': return 100;
      case 'high': return 75;
      case 'normal': return 50;
      case 'low': return 25;
      default: return 50;
    }
  }

  /**
   * Set up the job processor
   */
  process(processor: (job: { data: EmailJobData }) => Promise<EmailJobResult>): void {
    this.processor = processor;

    // Set up processor on all sending queues
    for (const queueName of [QUEUE_NAMES.HIGH_PRIORITY, QUEUE_NAMES.NORMAL, QUEUE_NAMES.BULK]) {
      const queue = this.queues.get(queueName);
      if (queue) {
        queue.process(this.config.concurrency || 5, async (job: SimulatedJob) => {
          return processor({ data: job.data });
        });
      }
    }
  }

  /**
   * Get statistics for all queues
   */
  async getAllStats(): Promise<Record<string, QueueStats>> {
    const stats: Record<string, QueueStats> = {};
    
    for (const [name, queue] of this.queues) {
      stats[name] = await queue.getCounts();
    }
    
    return stats;
  }

  /**
   * Get statistics for a specific queue
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, prioritized: 0 };
    }
    return queue.getCounts();
  }

  /**
   * Pause a specific queue
   */
  pauseQueue(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.pause();
    }
  }

  /**
   * Resume a specific queue
   */
  resumeQueue(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.resume();
    }
  }

  /**
   * Pause all queues
   */
  pauseAll(): void {
    for (const queue of this.queues.values()) {
      queue.pause();
    }
  }

  /**
   * Resume all queues
   */
  resumeAll(): void {
    for (const queue of this.queues.values()) {
      queue.resume();
    }
  }

  /**
   * Remove a job from any queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) {
        await queue.remove(jobId);
        return true;
      }
    }
    return false;
  }

  /**
   * Get a job by ID from any queue
   */
  async getJob(jobId: string): Promise<SimulatedJob | undefined> {
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) return job;
    }
    return undefined;
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(): Promise<SimulatedJob[]> {
    const deadLetter = this.queues.get(QUEUE_NAMES.DEAD_LETTER);
    if (!deadLetter) return [];
    return deadLetter.getJobs(['failed']);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const deadLetter = this.queues.get(QUEUE_NAMES.DEAD_LETTER);
    if (!deadLetter) return false;

    const job = await deadLetter.getJob(jobId);
    if (!job) return false;

    // Move back to original queue with reset attempts
    await this.addEmail({
      ...job.data,
      jobId: `${jobId}-retry`,
      maxRetries: MAX_RETRIES,
    });

    await deadLetter.remove(jobId);
    return true;
  }

  /**
   * Clear all queues (use with caution)
   */
  async obliterate(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.obliterate();
    }
    this.queues.clear();
    this.initializeQueues();
  }
}

/** Singleton instance */
let globalEmailService: EmailQueueService | null = null;

/**
 * Get or create the global email queue service
 */
export function getEmailQueueService(config?: Partial<QueueConfig>): EmailQueueService {
  if (!globalEmailService) {
    globalEmailService = new EmailQueueService(config);
  }
  return globalEmailService;
}

/**
 * Reset the global email queue service (useful for testing)
 */
export function resetEmailQueueService(): void {
  globalEmailService = null;
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate email job data
 */
export function validateEmailJob(data: Partial<EmailJobData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.to) errors.push('Recipient email (to) is required');
  if (!data.from) errors.push('Sender email (from) is required');
  if (!data.subject) errors.push('Subject is required');
  if (!data.html && !data.text) errors.push('Either html or text content is required');
  if (!data.accountId) errors.push('Account ID is required');
  if (typeof data.accountAgeInDays !== 'number' || data.accountAgeInDays < 0) {
    errors.push('Valid account age in days is required');
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.to && !emailRegex.test(data.to)) errors.push('Invalid recipient email format');
  if (data.from && !emailRegex.test(data.from)) errors.push('Invalid sender email format');

  return { valid: errors.length === 0, errors };
}
