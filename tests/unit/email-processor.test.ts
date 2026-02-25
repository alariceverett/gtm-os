/**
 * Unit Tests - Email Processor
 * 
 * Tests email job processing:
 * - Validation
 * - Rate limiting integration
 * - Retry logic with exponential backoff
 * - Failure handling
 * - Event emissions
 * Target: >80% coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmailProcessor,
  createEmailJob,
  isRateLimitError,
} from '@/lib/email-processor';
import { validateEmailJob } from '@/lib/email-queue';
import {
  getEmailRateLimiter,
  resetEmailRateLimiter,
} from '@/lib/rate-limiter';
import {
  getEmailQueueService,
  resetEmailQueueService,
} from '@/lib/email-queue';
import type { EmailProvider, EmailProcessorConfig, EmailJobData, ProcessingEvent } from '@/lib/email-processor';

// Mock provider for testing
class MockEmailProvider implements EmailProvider {
  name = 'mock';
  private shouldFail: boolean = false;
  private failureRate: number = 0;

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  async send(_data: EmailJobData): Promise<{ messageId: string; response: unknown }> {
    await new Promise(resolve => setTimeout(resolve, 1));
    
    if (this.shouldFail || Math.random() < this.failureRate) {
      throw new Error('Simulated send failure');
    }
    
    return {
      messageId: `mock-${Date.now()}`,
      response: { success: true },
    };
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  async health(): Promise<{ healthy: boolean; latency: number }> {
    return { healthy: !this.shouldFail, latency: 0 };
  }
}

describe('Email Processor - Configuration', () => {
  let mockProvider: MockEmailProvider;

  beforeEach(() => {
    resetEmailRateLimiter();
    resetEmailQueueService();
    mockProvider = new MockEmailProvider();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const processor = new EmailProcessor({
        provider: mockProvider,
      });

      expect(processor).toBeDefined();
      const stats = processor.getStats();
      expect(stats.processed).toBe(0);
    });

    it('should accept custom config', () => {
      const config: EmailProcessorConfig = {
        provider: mockProvider,
        maxRetries: 5,
        baseDelayMs: 1000,
        logLevel: 'debug',
      };

      const processor = new EmailProcessor(config);
      expect(processor).toBeDefined();
    });

    it('should initialize queue processor', () => {
      const processor = new EmailProcessor({
        provider: mockProvider,
      });

      // Queue should be set up
      const queueService = getEmailQueueService();
      expect(queueService).toBeDefined();
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to processing events', () => {
      const processor = new EmailProcessor({
        provider: mockProvider,
      });

      const events: ProcessingEvent[] = [];
      const unsubscribe = processor.subscribe((event) => {
        events.push(event);
      });

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should emit events during processing', async () => {
      const processor = new EmailProcessor({
        provider: mockProvider,
      });

      const events: ProcessingEvent[] = [];
      processor.subscribe((event) => {
        events.push(event);
      });

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test content',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      // Process directly - not through queue for unit test
      // Since we can't easily control the queue processing, we test the processJob method
      const result = await processor.processJob(job);

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      const sentEvent = events.find(e => e.stage === 'sent');
      expect(sentEvent).toBeDefined();
    });

    it('should handle errors in event listeners gracefully', async () => {
      const processor = new EmailProcessor({
        provider: mockProvider,
      });

      processor.subscribe(() => {
        throw new Error('Listener error');
      });

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test content',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      // Should not throw
      await expect(processor.processJob(job)).resolves.not.toThrow();
    });

    it('should emit validation stage event', async () => {
      const processor = new EmailProcessor({
        provider: mockProvider,
      });

      const events: ProcessingEvent[] = [];
      processor.subscribe((event) => {
        events.push(event);
      });

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      await processor.processJob(job);

      const validatingEvent = events.find(e => e.stage === 'validating');
      expect(validatingEvent).toBeDefined();
    });
  });
});

describe('Email Processor - Job Processing', () => {
  let processor: EmailProcessor;
  let mockProvider: MockEmailProvider;

  beforeEach(() => {
    resetEmailRateLimiter();
    resetEmailQueueService();
    mockProvider = new MockEmailProvider();
    processor = new EmailProcessor({
      provider: mockProvider,
      logLevel: 'error', // Suppress logs during tests
    });
  });

  describe('Validation', () => {
    it('should reject email without recipient', async () => {
      const job = createEmailJob({
        to: '',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('recipient');
    });

    it('should reject email without sender', async () => {
      const job = createEmailJob({
        to: 'test@example.com',
        from: '',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('sender');
    });

    it('should reject email without subject', async () => {
      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: '',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('subject');
    });

    it('should reject email without content', async () => {
      const job = {
        jobId: 'test',
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      } as EmailJobData;

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('html or text');
    });

    it('should reject email without account ID', async () => {
      const job = {
        jobId: 'test',
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: '',
        accountAgeInDays: 1,
      } as EmailJobData;

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('account');
    });

    it('should reject email with invalid recipient format', async () => {
      const job = createEmailJob({
        to: 'not-an-email',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('email format');
    });

    it('should reject email with invalid sender format', async () => {
      const job = createEmailJob({
        to: 'test@example.com',
        from: 'not-an-email',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('email format');
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limits before sending', async () => {
      const rateLimitHits: Array<{ domain: string; accountId: string }> = [];
      
      const processorWithCallback = new EmailProcessor({
        provider: mockProvider,
        logLevel: 'error',
        onRateLimit: (job, _check) => {
          const domain = job.from.split('@')[1];
          rateLimitHits.push({ domain: domain || '', accountId: job.accountId });
        },
      });

      // Fill rate limit
      const rateLimiter = getEmailRateLimiter();
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordSuccess('example.com', 'account-1');
      }

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      // This should throw for retry
      await expect(processorWithCallback.processJob(job)).rejects.toThrow('RATE_LIMITED');
      expect(rateLimitHits.length).toBeGreaterThan(0);
    });

    it('should include retryAfterMs in rate limit error', async () => {
      const rateLimiter = getEmailRateLimiter();
      
      // Fill rate limit
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordSuccess('example.com', 'account-1');
      }

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      try {
        await processor.processJob(job);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error & { retryAfterMs: number };
        expect(err.message).toContain('RATE_LIMITED');
        expect(err.retryAfterMs).toBeDefined();
        expect(err.retryAfterMs).toBeGreaterThan(0);
      }
    });

    it('should record success on successful send', async () => {
      const rateLimiter = getEmailRateLimiter();
      
      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      await processor.processJob(job);

      const tracking = rateLimiter.getTracking('example.com', 'account-1');
      expect(tracking?.sentToday).toBe(1);
    });

    it('should record failure on failed send', async () => {
      const rateLimiter = getEmailRateLimiter();
      const failingProvider = new MockEmailProvider();
      failingProvider.setShouldFail(true);
      
      const testProcessor = new EmailProcessor({
        provider: failingProvider,
        logLevel: 'error',
      });

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      try {
        await testProcessor.processJob(job);
      } catch {
        // Expected
      }

      const tracking = rateLimiter.getTracking('example.com', 'account-1');
      expect(tracking?.failureCount).toBe(1);
    });
  });

  describe('Successful Send', () => {
    it('should send email successfully', async () => {
      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const result = await processor.processJob(job);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should emit sent event on success', async () => {
      const events: ProcessingEvent[] = [];
      processor.subscribe((event) => {
        events.push(event);
      });

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      await processor.processJob(job);

      const sentEvent = events.find(e => e.stage === 'sent');
      expect(sentEvent).toBeDefined();
      expect(sentEvent?.message).toContain('success');
    });

    it('should update stats on success', async () => {
      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      await processor.processJob(job);

      const stats = processor.getStats();
      expect(stats.processed).toBe(1);
      expect(stats.succeeded).toBe(1);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Failed Send', () => {
    it('should handle failed send', async () => {
      mockProvider.setShouldFail(true);

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      await expect(processor.processJob(job)).rejects.toThrow('Simulated send failure');

      const stats = processor.getStats();
      expect(stats.failed).toBe(1);
    });

    it('should emit failed event on failure', async () => {
      mockProvider.setShouldFail(true);

      const events: ProcessingEvent[] = [];
      processor.subscribe((event) => {
        events.push(event);
      });

      const job = createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      try {
        await processor.processJob(job);
      } catch {
        // Expected
      }

      const failedEvent = events.find(e => e.stage === 'failed');
      expect(failedEvent).toBeDefined();
    });
  });

  describe('Provider Health', () => {
    it('should validate provider', async () => {
      const result = await processor.validateProvider();
      
      expect(result.valid).toBe(true);
    });

    it('should check provider health', async () => {
      const result = await processor.checkProviderHealth();
      
      expect(result.healthy).toBe(true);
      expect(result.latency).toBeDefined();
    });

    it('should report unhealthy when provider fails', async () => {
      mockProvider.setShouldFail(true);
      
      const result = await processor.checkProviderHealth();
      
      expect(result.healthy).toBe(false);
    });
  });

  describe('Control Methods', () => {
    it('should pause processing', () => {
      processor.pause();
      
      const stats = processor.getStats();
      expect(stats.isRunning).toBe(false);
    });

    it('should resume processing', () => {
      processor.pause();
      processor.resume();
      
      const stats = processor.getStats();
      expect(stats.isRunning).toBe(true);
    });
  });

  describe('Queue Management', () => {
    it('should requeue a failed job', async () => {
      const result = await processor.requeueJob('non-existent');
      expect(result).toBe(false);
    });

    it('should remove a job', async () => {
      const result = await processor.removeJob('non-existent');
      expect(result).toBe(false);
    });

    it('should get queue stats', async () => {
      const stats = await processor.getQueueStats();
      expect(stats).toBeDefined();
    });
  });
});

describe('Email Processor - Stats', () => {
  let processor: EmailProcessor;
  let mockProvider: MockEmailProvider;

  beforeEach(() => {
    resetEmailRateLimiter();
    resetEmailQueueService();
    mockProvider = new MockEmailProvider();
    processor = new EmailProcessor({
      provider: mockProvider,
      logLevel: 'error',
    });
  });

  it('should track processed count', async () => {
    const job = createEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Test',
      accountId: 'account-1',
      accountAgeInDays: 1,
    });

    await processor.processJob(job);

    const stats = processor.getStats();
    expect(stats.processed).toBe(1);
  });

  it('should calculate success rate', async () => {
    // Process 2 successful
    for (let i = 0; i < 2; i++) {
      const job = createEmailJob({
        to: `test${i}@example.com`,
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });
      await processor.processJob(job);
    }

    const stats = processor.getStats();
    expect(stats.succeeded).toBe(2);
    expect(stats.successRate).toBe(1);
  });

  it('should track failure count', async () => {
    mockProvider.setShouldFail(true);

    const job = createEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Test',
      accountId: 'account-1',
      accountAgeInDays: 1,
    });

    try {
      await processor.processJob(job);
    } catch {
      // Expected
    }

    const stats = processor.getStats();
    expect(stats.failed).toBe(1);
  });

  it('should report isRunning status', () => {
    const stats = processor.getStats();
    expect(typeof stats.isRunning).toBe('boolean');
  });
});

describe('createEmailJob', () => {
  it('should create job with defaults', () => {
    const job = createEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
    });

    expect(job.jobId).toContain('email');
    expect(job.text).toBeDefined();
    expect(job.accountId).toBe('default');
    expect(job.accountAgeInDays).toBe(1);
    expect(job.priority).toBe('normal');
    expect(job.tags).toEqual([]);
    expect(job.metadata).toEqual({});
  });

  it('should override defaults with provided values', () => {
    const job = createEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Custom text',
      accountId: 'custom-account',
      accountAgeInDays: 10,
      priority: 'high',
      tags: ['tag1'],
    });

    expect(job.text).toBe('Custom text');
    expect(job.accountId).toBe('custom-account');
    expect(job.accountAgeInDays).toBe(10);
    expect(job.priority).toBe('high');
    expect(job.tags).toEqual(['tag1']);
  });

  it('should prefer html over default text', () => {
    const job = createEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      html: '<p>Custom</p>',
    });

    expect(job.html).toBe('<p>Custom</p>');
    expect(job.text).toBeUndefined();
  });
});

describe('isRateLimitError', () => {
  it('should identify rate limit errors', () => {
    const error = new Error('RATE_LIMITED: Daily limit exceeded');
    (error as { retryAfterMs: number }).retryAfterMs = 3600000;
    
    expect(isRateLimitError(error)).toBe(true);
  });

  it('should not identify regular errors', () => {
    const error = new Error('Some other error');
    expect(isRateLimitError(error)).toBe(false);
  });

  it('should not identify non-errors', () => {
    expect(isRateLimitError('string')).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

// Note: processJob needs to be exported for direct testing
// We can also test queue-based processing via integration tests
