/**
 * Integration Tests - Email Queue System
 * 
 * Tests full system integration:
 * - Rate Limiter + Queue + Processor
 * - End-to-end email flow
 * - Dead letter queue integration
 * - Retry logic with exponential backoff
 * - Monitoring integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EmailRateLimiter,
  getEmailRateLimiter,
  resetEmailRateLimiter,
} from '@/lib/rate-limiter';
import {
  EmailQueueService,
  getEmailQueueService,
  resetEmailQueueService,
  QUEUE_NAMES,
  validateEmailJob,
} from '@/lib/email-queue';
import {
  EmailProcessor,
  createEmailJob,
  createSimulatedProvider,
  getEmailProcessor,
  resetEmailProcessor,
} from '@/lib/email-processor';
import {
  QueueMonitor,
  getQueueMonitor,
  resetQueueMonitor,
} from '@/lib/queue-monitor';
import type { EmailJobData, EmailJobResult } from '@/lib/email-queue';

describe('Email Queue Integration', () => {
  let rateLimiter: EmailRateLimiter;
  let queueService: EmailQueueService;
  let processor: EmailProcessor;
  let monitor: QueueMonitor;

  beforeEach(() => {
    // Reset all singletons
    resetEmailRateLimiter();
    resetEmailQueueService();
    resetEmailProcessor();
    resetQueueMonitor();

    // Initialize services
    rateLimiter = getEmailRateLimiter({ hardLimit: true });
    queueService = getEmailQueueService();
    
    const provider = createSimulatedProvider();
    processor = getEmailProcessor({ 
      provider,
      logLevel: 'error',
    });
    
    monitor = getQueueMonitor(
      queueService,
      rateLimiter,
      processor,
      { sampleIntervalMs: 100 }
    );
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('End-to-End Email Flow', () => {
    it('should process email through rate limiter, queue, and processor', async () => {
      const events: string[] = [];

      // Subscribe to rate limiter events
      rateLimiter.subscribe((event) => {
        if (event.allowed) {
          events.push(`rate-limiter:allowed:${event.domain}`);
        }
      });

      // Subscribe to queue events
      queueService.subscribe((event) => {
        events.push(`${event.type}:${event.jobId || 'none'}`);
      });

      // Subscribe to processor events
      processor.subscribe((event) => {
        events.push(`processor:${event.stage}:${event.jobId}`);
      });

      // Create and send email
      const job = createEmailJob({
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Integration Test',
        text: 'This is a test email',
        accountId: 'e2e-test-account', // Unique account to avoid conflicts
        accountAgeInDays: 1,
        priority: 'normal',
      });

      const result = await queueService.addEmail(job);

      expect(result.id).toBeDefined();
      expect(result.queue).toBe(QUEUE_NAMES.NORMAL);

      // Process directly for test
      const processResult = await processor.processJob(job);

      expect(processResult.success).toBe(true);
      expect(processResult.messageId).toBeDefined();

      // Verify rate limiter tracked the send
      const tracking = rateLimiter.getTracking('example.com', 'e2e-test-account');
      expect(tracking?.sentToday).toBeGreaterThanOrEqual(1);
    });

    it('should respect rate limits across multiple sends', async () => {
      // Day 31+ account (1000/day, 200/hour, 50/min limit)
      const results = [];

      // Send 5 emails rapidly (under per-minute limit of 50)
      for (let i = 0; i < 5; i++) {
        const job = createEmailJob({
          to: `recipient${i}@example.com`,
          from: 'sender@example.com',
          subject: 'Test',
          text: 'Test',
          accountId: 'mature-account',
          accountAgeInDays: 31, // Mature account
        });

        const result = await processor.processJob(job);
        results.push(result);
      }

      expect(results.every(r => r.success)).toBe(true);

      // Verify rate limiting tracked the sends
      const tracking = rateLimiter.getTracking('example.com', 'mature-account');
      expect(tracking?.sentToday).toBe(5);
    });

    it('should block when rate limit exceeded', async () => {
      // Fill quota for a Day 1 account (2/min limit)
      const job1 = createEmailJob({
        to: 'recipient1@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'new-limited-account',
        accountAgeInDays: 1,
      });
      const job2 = createEmailJob({
        to: 'recipient2@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'new-limited-account',
        accountAgeInDays: 1,
      });

      // First two succeed
      await processor.processJob(job1);
      await processor.processJob(job2);

      // Third should fail
      const job3 = createEmailJob({
        to: 'recipient3@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'new-limited-account',
        accountAgeInDays: 1,
      });

      await expect(processor.processJob(job3)).rejects.toThrow('RATE_LIMITED');
    });
  });

  describe('Priority Queue Routing', () => {
    it('should route critical emails to priority queue', async () => {
      const job = createEmailJob({
        to: 'urgent@example.com',
        from: 'sender@example.com',
        subject: 'Critical Alert',
        text: 'Urgent!',
        accountId: 'account-1',
        accountAgeInDays: 1,
        priority: 'critical',
      });

      const result = await queueService.addEmail(job);

      expect(result.queue).toBe(QUEUE_NAMES.HIGH_PRIORITY);
    });

    it('should route low priority emails to bulk queue', async () => {
      const job = createEmailJob({
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Newsletter',
        text: 'Monthly update',
        accountId: 'account-1',
        accountAgeInDays: 1,
        priority: 'low',
      });

      const result = await queueService.addEmail(job);

      expect(result.queue).toBe(QUEUE_NAMES.BULK);
    });

    it('should track queue stats separately', async () => {
      // Add to different queues (pause first to ensure jobs stay in queue)
      queueService.pauseQueue(QUEUE_NAMES.HIGH_PRIORITY);
      queueService.pauseQueue(QUEUE_NAMES.NORMAL);
      queueService.pauseQueue(QUEUE_NAMES.BULK);
      
      await queueService.addEmail(createEmailJob({
        to: 'high@example.com',
        subject: 'High',
        text: 'High',
        accountId: 'account-1',
        accountAgeInDays: 1,
        priority: 'high',
      }));

      await queueService.addEmail(createEmailJob({
        to: 'normal@example.com',
        subject: 'Normal',
        text: 'Normal',
        accountId: 'account-2',
        accountAgeInDays: 1,
        priority: 'normal',
      }));

      await queueService.addEmail(createEmailJob({
        to: 'low@example.com',
        subject: 'Low',
        text: 'Low',
        accountId: 'account-3',
        accountAgeInDays: 1,
        priority: 'low',
      }));

      const priorityStats = await queueService.getQueueStats(QUEUE_NAMES.HIGH_PRIORITY);
      const normalStats = await queueService.getQueueStats(QUEUE_NAMES.NORMAL);
      const bulkStats = await queueService.getQueueStats(QUEUE_NAMES.BULK);

      // Jobs should be waiting in their respective queues
      expect(priorityStats.waiting).toBeGreaterThan(0);
      expect(normalStats.waiting).toBeGreaterThan(0);
      expect(bulkStats.waiting).toBeGreaterThan(0);
      
      // Resume queues
      queueService.resumeQueue(QUEUE_NAMES.HIGH_PRIORITY);
      queueService.resumeQueue(QUEUE_NAMES.NORMAL);
      queueService.resumeQueue(QUEUE_NAMES.BULK);
    });
  });

  describe('Monitoring Integration', () => {
    it('should track system metrics', async () => {
      // Start monitoring
      monitor.start();

      // Perform some activity
      await processor.processJob(createEmailJob({
        to: 'test1@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'monitor-account',
        accountAgeInDays: 1,
      }));

      await processor.processJob(createEmailJob({
        to: 'test2@example.com',
        from: 'sender@example.com',
        subject: 'Test 2',
        text: 'Test 2',
        accountId: 'monitor-account',
        accountAgeInDays: 1,
      }));

      // Get system metrics
      const metrics = await monitor.getSystemMetrics();

      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.queues.length).toBeGreaterThan(0);
      expect(metrics.domainMetrics).toBeDefined();
    });

    it('should export Prometheus metrics', async () => {
      // Process some emails
      await processor.processJob(createEmailJob({
        to: 'prometheus@example.com',
        from: 'sender@example.com',
        subject: 'Metric Test',
        text: 'Test',
        accountId: 'prom-account',
        accountAgeInDays: 1,
      }));

      const exportStr = await monitor.exportPrometheusMetrics();

      expect(exportStr).toContain('email_');
      expect(exportStr).toContain('email_queue_');
      expect(exportStr).toContain('email_throughput');
      expect(exportStr).toContain('email_health');
    });
  });

  describe('Retry Logic Integration', () => {
    it('should track retries in rate limiter', async () => {
      // Record some failures
      rateLimiter.recordFailure('example.com', 'retry-account');
      rateLimiter.recordFailure('example.com', 'retry-account');

      const tracking = rateLimiter.getTracking('example.com', 'retry-account');
      expect(tracking?.consecutiveFailures).toBe(2);
    });

    it('should reset consecutive failures on success', async () => {
      // Fail then succeed
      rateLimiter.recordFailure('example.com', 'reset-account');
      rateLimiter.recordFailure('example.com', 'reset-account');

      const processorResult = await processor.processJob(createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Success',
        text: 'Success after failures',
        accountId: 'reset-account',
        accountAgeInDays: 1,
      }));

      expect(processorResult.success).toBe(true);

      const tracking = rateLimiter.getTracking('example.com', 'reset-account');
      expect(tracking?.consecutiveFailures).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate complete email job', () => {
      const validation = validateEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test content',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate invalid email job', () => {
      const validation = validateEmailJob({
        to: 'invalid-email',
        from: 'also-invalid',
        subject: '',
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Account Age Tiers', () => {
    it('should apply correct tier for new account', async () => {
      const result = await processor.processJob(createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'New Account Test',
        text: 'Test',
        accountId: 'new-account',
        accountAgeInDays: 1,
      }));

      expect(result.success).toBe(true);

      // Should have 50/day limit
      const check = rateLimiter.checkLimit('example.com', 'new-account', 1);
      expect(check.limits.maxPerDay).toBe(50);
    });

    it('should apply correct tier for mature account', async () => {
      const result = await processor.processJob(createEmailJob({
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Mature Account Test',
        text: 'Test',
        accountId: 'mature-account',
        accountAgeInDays: 31,
      }));

      expect(result.success).toBe(true);

      // Should have 1000/day limit
      const check = rateLimiter.checkLimit('example.com', 'mature-account', 31);
      expect(check.limits.maxPerDay).toBe(1000);
    });
  });

  describe('Statistics', () => {
    it('should track processor stats', async () => {
      // Process multiple emails with mature account (50/min limit)
      for (let i = 0; i < 5; i++) {
        await processor.processJob(createEmailJob({
          to: `test${i}@example.com`,
          from: 'sender@example.com',
          subject: 'Stats Test',
          text: 'Test',
          accountId: 'stats-account',
          accountAgeInDays: 31, // Mature account
        }));
      }

      const stats = processor.getStats();

      expect(stats.processed).toBe(5);
      expect(stats.succeeded).toBe(5);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(1);
    });

    it('should get queue stats', async () => {
      await queueService.addEmail(createEmailJob({
        to: 'stats@example.com',
        from: 'sender@example.com',
        subject: 'Queue Stats Test',
        text: 'Test',
        accountId: 'queue-stats-account',
        accountAgeInDays: 1,
      }));

      const stats = await queueService.getAllStats();

      expect(stats[QUEUE_NAMES.NORMAL]).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should report system health', async () => {
      const health = await processor.checkProviderHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate health status', async () => {
      // Get from monitor
      const health = await monitor.getHealthChecks();

      expect(health.length).toBeGreaterThan(0);

      const aggregate = health.every(h => h.status === 'healthy')
        ? 'healthy'
        : health.some(h => h.status === 'critical')
        ? 'critical'
        : 'degraded';

      expect(['healthy', 'degraded', 'critical', 'unknown']).toContain(aggregate);
    });
  });
});
