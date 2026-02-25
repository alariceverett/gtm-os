/**
 * Unit Tests - Email Queue
 * 
 * Tests Bull/Redis queue simulation:
 * - Queue creation and management
 * - Priority handling
 * - Dead letter queue
 * - Job lifecycle
 * - Retry logic
 * Target: >80% coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmailQueueService,
  getEmailQueueService,
  resetEmailQueueService,
  QUEUE_NAMES,
  PRIORITY_QUEUES,
  DEFAULT_BACKOFF,
  MAX_RETRIES,
  RETRY_DELAYS,
  generateJobId,
  validateEmailJob,
} from '@/lib/email-queue';
import type { EmailJobData } from '@/lib/email-queue';

describe('Email Queue - Constants', () => {
  describe('QUEUE_NAMES', () => {
    it('should have all required queue names', () => {
      expect(QUEUE_NAMES.HIGH_PRIORITY).toBe('email:priority');
      expect(QUEUE_NAMES.NORMAL).toBe('email:normal');
      expect(QUEUE_NAMES.BULK).toBe('email:bulk');
      expect(QUEUE_NAMES.DEAD_LETTER).toBe('email:dead-letter');
    });
  });

  describe('PRIORITY_QUEUES', () => {
    it('should map priorities to correct queues', () => {
      expect(PRIORITY_QUEUES.critical).toBe(QUEUE_NAMES.HIGH_PRIORITY);
      expect(PRIORITY_QUEUES.high).toBe(QUEUE_NAMES.HIGH_PRIORITY);
      expect(PRIORITY_QUEUES.normal).toBe(QUEUE_NAMES.NORMAL);
      expect(PRIORITY_QUEUES.low).toBe(QUEUE_NAMES.BULK);
    });
  });

  describe('DEFAULT_BACKOFF', () => {
    it('should use exponential backoff by default', () => {
      expect(DEFAULT_BACKOFF.type).toBe('exponential');
      expect(DEFAULT_BACKOFF.delay).toBe(5000);
    });
  });

  describe('RETRY_DELAYS', () => {
    it('should have correct backoff delays', () => {
      expect(RETRY_DELAYS).toEqual([5000, 15000, 45000]);
    });
  });

  describe('MAX_RETRIES', () => {
    it('should be 3 by default', () => {
      expect(MAX_RETRIES).toBe(3);
    });
  });
});

describe('EmailQueueService - Queue Management', () => {
  let queueService: EmailQueueService;

  beforeEach(() => {
    resetEmailQueueService();
    queueService = getEmailQueueService();
  });

  describe('Initialization', () => {
    it('should create all queues on initialization', () => {
      expect(queueService.getQueue(QUEUE_NAMES.HIGH_PRIORITY)).toBeDefined();
      expect(queueService.getQueue(QUEUE_NAMES.NORMAL)).toBeDefined();
      expect(queueService.getQueue(QUEUE_NAMES.BULK)).toBeDefined();
      expect(queueService.getQueue(QUEUE_NAMES.DEAD_LETTER)).toBeDefined();
    });
  });

  describe('Add Email', () => {
    it('should add email to correct queue based on priority', async () => {
      const email: EmailJobData = {
        jobId: 'test-1',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        accountId: 'account-1',
        accountAgeInDays: 1,
        priority: 'high',
      };

      const result = await queueService.addEmail(email);
      
      expect(result.id).toBeDefined();
      expect(result.queue).toBe(QUEUE_NAMES.HIGH_PRIORITY);
    });

    it('should add normal priority to normal queue', async () => {
      const email: EmailJobData = {
        jobId: 'test-2',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
        priority: 'normal',
      };

      const result = await queueService.addEmail(email);
      expect(result.queue).toBe(QUEUE_NAMES.NORMAL);
    });

    it('should add low priority to bulk queue', async () => {
      const email: EmailJobData = {
        jobId: 'test-3',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
        priority: 'low',
      };

      const result = await queueService.addEmail(email);
      expect(result.queue).toBe(QUEUE_NAMES.BULK);
    });

    it('should default to normal queue when priority not specified', async () => {
      const email: EmailJobData = {
        jobId: 'test-4',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      const result = await queueService.addEmail(email);
      expect(result.queue).toBe(QUEUE_NAMES.NORMAL);
    });

    it('should generate job ID if not provided', async () => {
      const email: Partial<EmailJobData> = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      const result = await queueService.addEmail(email as EmailJobData);
      
      expect(result.id).toContain('email');
      expect(result.id.length).toBeGreaterThan(10);
    });
  });

  describe('Queue Stats', () => {
    it('should return stats for all queues', async () => {
      const stats = await queueService.getAllStats();
      
      expect(stats[QUEUE_NAMES.HIGH_PRIORITY]).toBeDefined();
      expect(stats[QUEUE_NAMES.NORMAL]).toBeDefined();
      expect(stats[QUEUE_NAMES.BULK]).toBeDefined();
      expect(stats[QUEUE_NAMES.DEAD_LETTER]).toBeDefined();
    });

    it('should return 0 counts for empty queues', async () => {
      const stats = await queueService.getQueueStats(QUEUE_NAMES.NORMAL);
      
      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.delayed).toBe(0);
    });

    it('should return empty stats for unknown queue', async () => {
      const stats = await queueService.getQueueStats('unknown-queue');
      
      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);
    });
  });

  describe('Queue Control', () => {
    it('should pause specific queue', () => {
      const events: string[] = [];
      
      queueService.subscribe((evt) => {
        if (evt.type === 'queue:paused') {
          events.push('paused');
        }
      });
      
      queueService.pauseQueue(QUEUE_NAMES.NORMAL);
      
      // Should not throw
      expect(events).toContain('paused');
    });

    it('should resume specific queue', () => {
      queueService.pauseQueue(QUEUE_NAMES.NORMAL);
      
      expect(() => {
        queueService.resumeQueue(QUEUE_NAMES.NORMAL);
      }).not.toThrow();
    });

    it('should pause all queues', () => {
      expect(() => {
        queueService.pauseAll();
      }).not.toThrow();
    });

    it('should resume all queues', () => {
      queueService.pauseAll();
      
      expect(() => {
        queueService.resumeAll();
      }).not.toThrow();
    });
  });

  describe('Job Management', () => {
    it('should get job by ID', async () => {
      const email: EmailJobData = {
        jobId: 'find-test',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      await queueService.addEmail(email);
      const job = await queueService.getJob('find-test');
      
      expect(job).toBeDefined();
      expect(job?.data.jobId).toBe('find-test');
    });

    it('should return undefined for unknown job', async () => {
      const job = await queueService.getJob('non-existent');
      expect(job).toBeUndefined();
    });

    it('should remove job from queue', async () => {
      const email: EmailJobData = {
        jobId: 'remove-test',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      await queueService.addEmail(email);
      const removed = await queueService.removeJob('remove-test');
      
      expect(removed).toBe(true);
      
      const job = await queueService.getJob('remove-test');
      expect(job).toBeUndefined();
    });

    it('should return false when removing unknown job', async () => {
      const removed = await queueService.removeJob('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to queue events', () => {
      const events: string[] = [];
      
      const unsubscribe = queueService.subscribe((evt) => {
        if (evt.type === 'job:added') {
          events.push('added');
        }
      });
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should emit job:added events', async () => {
      const events: { type: string; jobId?: string }[] = [];
      
      queueService.subscribe((evt) => {
        events.push({ type: evt.type, jobId: evt.jobId });
      });

      const email: EmailJobData = {
        jobId: 'event-test',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      await queueService.addEmail(email);
      
      const addedEvents = events.filter(e => e.type === 'job:added');
      expect(addedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Dead Letter Queue', () => {
    it('should get failed jobs from dead letter queue', async () => {
      const failed = await queueService.getFailedJobs();
      expect(Array.isArray(failed)).toBe(true);
    });

    it('should retry failed job', async () => {
      // This tests that the method exists and returns a value
      // Actual retry logic is tested in integration
      const result = await queueService.retryJob('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Obliterate', () => {
    it('should clear all queues', async () => {
      const email: EmailJobData = {
        jobId: 'clear-test',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      await queueService.addEmail(email);
      
      let stats = await queueService.getQueueStats(QUEUE_NAMES.NORMAL);
      expect(stats.waiting).toBeGreaterThan(0);
      
      await queueService.obliterate();
      
      // Re-initialize and check
      stats = await getEmailQueueService().getQueueStats(QUEUE_NAMES.NORMAL);
      expect(stats.waiting).toBe(0);
    });
  });
});

describe('EmailQueueService - Singleton', () => {
  it('should return the same instance', () => {
    const service1 = getEmailQueueService();
    const service2 = getEmailQueueService();
    
    expect(service1).toBe(service2);
  });

  it('should create new instance after reset', () => {
    const service1 = getEmailQueueService();
    
    resetEmailQueueService();
    
    const service2 = getEmailQueueService();
    
    expect(service1).not.toBe(service2);
  });
});

describe('Email Job Validation', () => {
  it('should validate required fields', () => {
    const validation = validateEmailJob({});
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Recipient email (to) is required');
    expect(validation.errors).toContain('Sender email (from) is required');
    expect(validation.errors).toContain('Subject is required');
  });

  it('should validate content requirement', () => {
    const validation = validateEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
    });
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Either html or text content is required');
  });

  it('should validate email format', () => {
    const validation = validateEmailJob({
      to: 'invalid-email',
      from: 'invalid-sender',
      subject: 'Test',
      text: 'Content',
      accountId: 'account-1',
      accountAgeInDays: 1,
    });
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Invalid recipient email format');
    expect(validation.errors).toContain('Invalid sender email format');
  });

  it('should validate account ID', () => {
    const validation = validateEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Content',
    });
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Account ID is required');
  });

  it('should validate account age', () => {
    const validation = validateEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Content',
      accountId: 'account-1',
    });
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Valid account age in days is required');
  });

  it('should validate valid email job', () => {
    const validation = validateEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Content',
      accountId: 'account-1',
      accountAgeInDays: 1,
    });
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should accept html content', () => {
    const validation = validateEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      html: '<p>Content</p>',
      accountId: 'account-1',
      accountAgeInDays: 1,
    });
    
    expect(validation.valid).toBe(true);
  });

  it('should accept both html and text content', () => {
    const validation = validateEmailJob({
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      html: '<p>Content</p>',
      text: 'Content',
      accountId: 'account-1',
      accountAgeInDays: 1,
    });
    
    expect(validation.valid).toBe(true);
  });
});

describe('generateJobId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateJobId();
    const id2 = generateJobId();
    
    expect(id1).not.toBe(id2);
    expect(id1).toContain('email');
  });

  it('should include timestamp', () => {
    const id = generateJobId();
    const timestamp = Date.now();
    
    // Should contain a timestamp
    expect(id).toMatch(/email-\d+-/);
  });
});
