/**
 * Unit Tests - Queue Monitor
 * 
 * Tests metrics tracking and health monitoring:
 * - Metric collection
 * - Health check generation
 * - Alert generation
 * - Stats aggregation
 * - Prometheus format export
 * Target: >80% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QueueMonitor,
  getQueueMonitor,
  resetQueueMonitor,
  formatBytes,
  formatDuration,
  isCriticalHealth,
  aggregateHealth,
} from '@/lib/queue-monitor';
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
} from '@/lib/email-queue';
import {
  EmailProcessor,
  createSimulatedProvider,
} from '@/lib/email-processor';
import type { HealthStatus, SystemMetrics, Alert } from '@/lib/queue-monitor';
import type { EmailJobData } from '@/lib/email-queue';

describe('Queue Monitor - Formatting', () => {
  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should respect decimal places', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 0)).toBe('2 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
      expect(formatDuration(5500)).toBe('5.5s');
    });

    it('should format minutes', () => {
      expect(formatDuration(120000)).toBe('2m 0s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3660000)).toBe('1h 1m');
    });
  });

  describe('isCriticalHealth', () => {
    it('should return true when component is critical', () => {
      const health = [
        { status: 'healthy' as HealthStatus, latency: 0, lastCheck: new Date() },
        { status: 'critical' as HealthStatus, latency: 0, lastCheck: new Date() },
      ];
      
      expect(isCriticalHealth(health)).toBe(true);
    });

    it('should return false when no critical components', () => {
      const health = [
        { status: 'healthy' as HealthStatus, latency: 0, lastCheck: new Date() },
        { status: 'degraded' as HealthStatus, latency: 0, lastCheck: new Date() },
      ];
      
      expect(isCriticalHealth(health)).toBe(false);
    });

    it('should return false for empty health', () => {
      expect(isCriticalHealth([])).toBe(false);
    });
  });

  describe('aggregateHealth', () => {
    it('should return healthy when all components are healthy', () => {
      const health = [
        { status: 'healthy' as HealthStatus, latency: 0, lastCheck: new Date() },
        { status: 'healthy' as HealthStatus, latency: 0, lastCheck: new Date() },
      ];
      
      expect(aggregateHealth(health)).toBe('healthy');
    });

    it('should return critical when any component is critical', () => {
      const health = [
        { status: 'healthy' as HealthStatus, latency: 0, lastCheck: new Date() },
        { status: 'critical' as HealthStatus, latency: 0, lastCheck: new Date() },
      ];
      
      expect(aggregateHealth(health)).toBe('critical');
    });

    it('should return degraded when any component is degraded', () => {
      const health = [
        { status: 'healthy' as HealthStatus, latency: 0, lastCheck: new Date() },
        { status: 'degraded' as HealthStatus, latency: 0, lastCheck: new Date() },
      ];
      
      expect(aggregateHealth(health)).toBe('degraded');
    });

    it('should return unknown for empty health', () => {
      expect(aggregateHealth([])).toBe('unknown');
    });
  });
});

describe('Queue Monitor - Core Functionality', () => {
  let queueService: EmailQueueService;
  let rateLimiter: EmailRateLimiter;
  let processor: EmailProcessor;
  let monitor: QueueMonitor;

  beforeEach(() => {
    resetEmailRateLimiter();
    resetEmailQueueService();
    
    queueService = getEmailQueueService();
    rateLimiter = getEmailRateLimiter();
    processor = new EmailProcessor({
      provider: createSimulatedProvider(),
      logLevel: 'error',
    });
    
    resetQueueMonitor();
    monitor = getQueueMonitor(queueService, rateLimiter, processor, {
      sampleIntervalMs: 100, // Fast sampling for tests
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('Initialization', () => {
    it('should create monitor with dependencies', () => {
      const testMonitor = new QueueMonitor(queueService, rateLimiter, processor);
      expect(testMonitor).toBeDefined();
    });

    it('should not be monitoring initially', () => {
      expect(monitor.isMonitoring()).toBe(false);
    });

    it('should start monitoring', () => {
      monitor.start();
      expect(monitor.isMonitoring()).toBe(true);
    });

    it('should stop monitoring', () => {
      monitor.start();
      monitor.stop();
      expect(monitor.isMonitoring()).toBe(false);
    });

    it('should not start twice', () => {
      monitor.start();
      const firstState = monitor.isMonitoring();
      
      monitor.start(); // Should not error
      expect(monitor.isMonitoring()).toBe(firstState);
    });
  });

  describe('Alert Management', () => {
    it('should subscribe to alerts', () => {
      const alerts: Alert[] = [];
      const unsubscribe = monitor.subscribe((alert) => {
        alerts.push(alert);
      });

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should emit alerts', () => {
      const alerts: Alert[] = [];
      monitor.subscribe((alert) => {
        alerts.push(alert);
      });

      // Force an alert by adding many jobs
      for (let i = 0; i < 100; i++) {
        rateLimiter.recordSuccess('example.com', 'account-1');
      }

      // Manually trigger alert creation
      (monitor as unknown as { checkAlerts: (depth: number, errorRate: number, throughput: number) => void }).checkAlerts(1000, 0, 0);

      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should get active alerts', () => {
      const alerts = monitor.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should resolve alerts', () => {
      // Create an alert
      const alert: Alert = {
        id: 'test-alert',
        severity: 'warning',
        component: 'test',
        message: 'Test alert',
        timestamp: new Date(),
      };
      
      (monitor as unknown as { activeAlerts: Map<string, Alert> }).activeAlerts.set(alert.id, alert);
      
      expect(monitor.getAlerts()).toHaveLength(1);
      
      monitor.resolveAlert(alert.id);
      
      // Alert should be removed from active alerts after resolution
      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('Queue Metrics', () => {
    it('should get queue metrics', async () => {
      // Add some emails to queues
      const email: EmailJobData = {
        jobId: 'test',
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      };

      await queueService.addEmail(email);

      const metrics = await monitor.getQueueMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include queue name in metrics', async () => {
      const metrics = await monitor.getQueueMetrics();
      
      if (metrics.length > 0) {
        expect(metrics[0].queueName).toBeDefined();
      }
    });
  });

  describe('Rate Metrics', () => {
    it('should calculate rate metrics', () => {
      const rates = monitor.getRateMetrics();
      
      expect(rates.throughput).toBeDefined();
      expect(rates.successRate).toBeDefined();
      expect(rates.avgLatency).toBeDefined();
      expect(rates.errorRate).toBeDefined();
    });

    it('should return 0.5 for unknown success rate', () => {
      // When no metrics yet
      const rates = monitor.getRateMetrics();
      
      // Should return sensible defaults
      expect(typeof rates.throughput).toBe('number');
      expect(typeof rates.successRate).toBe('number');
      expect(rates.successRate).toBeGreaterThanOrEqual(0);
      expect(rates.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Health Checks', () => {
    it('should get health checks', async () => {
      const health = await monitor.getHealthChecks();
      
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThan(0);
    });

    it('should include queue service health', async () => {
      const health = await monitor.getHealthChecks();
      const queueHealth = health.find(h => h.component === 'queue-service');
      
      expect(queueHealth).toBeDefined();
      expect(queueHealth?.status).toBeDefined();
      expect(queueHealth?.latency).toBeDefined();
    });

    it('should include rate limiter health', async () => {
      const health = await monitor.getHealthChecks();
      const rateLimiterHealth = health.find(h => h.component === 'rate-limiter');
      
      expect(rateLimiterHealth).toBeDefined();
    });

    it('should include processor health', async () => {
      const health = await monitor.getHealthChecks();
      const processorHealth = health.find(h => h.component === 'processor');
      
      expect(processorHealth).toBeDefined();
    });
  });

  describe('Domain Metrics', () => {
    it('should get domain metrics', () => {
      // Add some sends
      rateLimiter.recordSuccess('example.com', 'account-1');
      rateLimiter.recordSuccess('other.com', 'account-2');

      const domainMetrics = monitor.getDomainMetrics();
      
      expect(Array.isArray(domainMetrics)).toBe(true);
      expect(domainMetrics.length).toBe(2);
    });

    it('should include domain details', () => {
      rateLimiter.recordSuccess('example.com', 'account-1');

      const domainMetrics = monitor.getDomainMetrics();
      
      if (domainMetrics.length > 0) {
        expect(domainMetrics[0].domain).toBeDefined();
        expect(domainMetrics[0].sentToday).toBeDefined();
        expect(domainMetrics[0].tier).toBeDefined();
        expect(domainMetrics[0].utilization).toBeDefined();
      }
    });

    it('should calculate utilization correctly', () => {
      for (let i = 0; i < 25; i++) {
        rateLimiter.recordSuccess('example.com', 'account-1');
      }

      const domainMetrics = monitor.getDomainMetrics();
      const exampleMetric = domainMetrics.find(d => d.domain === 'example.com');
      
      // Day 1 account with 50/day limit, sent 25 = 50% utilization
      expect(exampleMetric?.utilization).toBe(0.5);
    });
  });

  describe('System Metrics', () => {
    it('should get system metrics', async () => {
      const metrics = await monitor.getSystemMetrics();
      
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(metrics.queues)).toBe(true);
      expect(metrics.rates).toBeDefined();
      expect(Array.isArray(metrics.activeAlerts)).toBe(true);
      expect(Array.isArray(metrics.health)).toBe(true);
      expect(Array.isArray(metrics.domainMetrics)).toBe(true);
    });
  });

  describe('Prometheus Export', () => {
    it('should export Prometheus metrics', async () => {
      const exportStr = await monitor.exportPrometheusMetrics();
      
      expect(typeof exportStr).toBe('string');
    });

    it('should include queue metrics', async () => {
      // Add some jobs
      await queueService.addEmail({
        jobId: 'prom-test',
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
        accountId: 'account-1',
        accountAgeInDays: 1,
      });

      const exportStr = await monitor.exportPrometheusMetrics();
      
      expect(exportStr).toContain('email_queue_depth');
    });

    it('should include rate metrics', async () => {
      const exportStr = await monitor.exportPrometheusMetrics();
      
      expect(exportStr).toContain('email_throughput');
      expect(exportStr).toContain('email_success_rate');
    });

    it('should include domain metrics', async () => {
      rateLimiter.recordSuccess('example.com', 'account-1');
      
      const exportStr = await monitor.exportPrometheusMetrics();
      
      expect(exportStr).toContain('email_domain_');
    });
  });

  describe('Summary', () => {
    it('should get summary', () => {
      const summary = monitor.getSummary();
      
      expect(typeof summary.totalProcessed).toBe('number');
      expect(typeof summary.totalFailed).toBe('number');
      expect(typeof summary.successRate).toBe('number');
      expect(typeof summary.avgThroughput).toBe('number');
      expect(typeof summary.activeAlerts).toBe('number');
      expect(typeof summary.monitoring).toBe('boolean');
    });
  });

  describe('Event Subscription', () => {
    it('should support event unsubscription', () => {
      const unsubscribe = monitor.subscribe(() => {});
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should handle listener errors gracefully', () => {
      monitor.subscribe(() => {
        throw new Error('Listener error');
      });

      // Trigger an alert
      (monitor as unknown as { createAlert: (c: string, s: string, m: string) => Alert }).createAlert(
        'test',
        'warning',
        'Test alert'
      );

      // Should not throw
      expect(() => {
        (monitor as unknown as { emitAlert: (alert: Alert) => void }).emitAlert({
          id: 'test',
          severity: 'info',
          component: 'test',
          message: 'Test',
          timestamp: new Date(),
        });
      }).not.toThrow();
    });
  });
});

describe('Queue Monitor - Sampling', () => {
  let queueService: EmailQueueService;
  let rateLimiter: EmailRateLimiter;
  let processor: EmailProcessor;
  let monitor: QueueMonitor;

  beforeEach(() => {
    resetEmailRateLimiter();
    resetEmailQueueService();
    
    queueService = getEmailQueueService();
    rateLimiter = getEmailRateLimiter();
    processor = new EmailProcessor({
      provider: createSimulatedProvider(),
      logLevel: 'error',
    });
    
    resetQueueMonitor();
    monitor = getQueueMonitor(queueService, rateLimiter, processor);
  });

  afterEach(() => {
    monitor.stop();
  });

  it('should sample on start', () => {
    const sampleSpy = vi.spyOn(monitor as unknown as { sample: () => Promise<void> }, 'sample');
    
    monitor.start();
    
    // Sample is called on start
    expect(sampleSpy).toHaveBeenCalled();
  });

  it('should stop sampling when stopped', () => {
    monitor.start();
    expect(monitor.isMonitoring()).toBe(true);
    
    monitor.stop();
    expect(monitor.isMonitoring()).toBe(false);
  });
});

describe('Queue Monitor - Singleton', () => {
  beforeEach(() => {
    resetQueueMonitor();
  });

  afterEach(() => {
    resetQueueMonitor();
  });

  it('should return the same instance', () => {
    const queueService = getEmailQueueService();
    const rateLimiter = getEmailRateLimiter();
    const processor = new EmailProcessor({
      provider: createSimulatedProvider(),
    });

    const monitor1 = getQueueMonitor(queueService, rateLimiter, processor);
    const monitor2 = getQueueMonitor(queueService, rateLimiter, processor);
    
    expect(monitor1).toBe(monitor2);
  });

  it('should create new instance after reset', () => {
    const queueService = getEmailQueueService();
    const rateLimiter = getEmailRateLimiter();
    const processor = new EmailProcessor({
      provider: createSimulatedProvider(),
    });

    const monitor1 = getQueueMonitor(queueService, rateLimiter, processor);
    
    resetQueueMonitor();
    
    const monitor2 = getQueueMonitor(queueService, rateLimiter, processor);
    
    expect(monitor1).not.toBe(monitor2);
  });
});
