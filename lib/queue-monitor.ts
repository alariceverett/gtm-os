/**
 * Queue Monitor - Metrics and Health Monitoring
 * 
 * Tracks queue health, performance metrics, and alerting:
 * - Queue depth monitoring
 * - Processing rate tracking
 * - Error rate analysis
 * - Health check endpoints
 * - Alert generation
 */

import type { EmailQueueService } from './email-queue';
import type { EmailRateLimiter } from './rate-limiter';
import type { EmailProcessor } from './email-processor';

// ============================================================================
// TYPES
// ============================================================================

/** Metric types */
export type MetricType = 
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary';

/** Time series data point */
export interface MetricPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

/** Aggregated metrics */
export interface AggregatedMetrics {
  /** Total counter value */
  total: number;
  /** Average per interval */
  average: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Latest value */
  current: number;
  /** Standard deviation */
  stdDev: number;
  /** 95th percentile */
  p95: number;
}

/** Queue health status */
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

/** Health check result */
export interface HealthCheck {
  component: string;
  status: HealthStatus;
  latency: number;
  lastCheck: Date;
  message?: string;
  details?: Record<string, unknown>;
}

/** Alert severity */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Alert definition */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  component: string;
  message: string;
  timestamp: Date;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
}

/** Rate metrics */
export interface RateMetrics {
  /** Emails processed per minute */
  throughput: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average processing time (ms) */
  avgLatency: number;
  /** Error rate per minute */
  errorRate: number;
}

/** Queue metrics */
export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  /** Processing rate per minute */
  processingRate: number;
  /** Average wait time (ms) */
  avgWaitTime: number;
}

/** Domain rate metrics */
export interface DomainRateMetrics {
  domain: string;
  sentToday: number;
  sentThisHour: number;
  sentThisMinute: number;
  failureCount: number;
  consecutiveFailures: number;
  tier: string;
  maxDaily: number;
  utilization: number; // 0-1
}

/** Monitor configuration */
export interface MonitorConfig {
  /** Sample interval in ms */
  sampleIntervalMs: number;
  /** Maximum samples to retain */
  maxSamples: number;
  /** Alert threshold - queue depth */
  queueDepthWarning: number;
  /** Alert threshold - error rate */
  errorRateThreshold: number;
  /** Alert threshold - processing latency (ms) */
  latencyThresholdMs: number;
  /** Alert threshold - rate limit utilization */
  rateLimitUtilization: number;
  /** Callback for alerts */
  onAlert?: (alert: Alert) => void;
  /** Callback for metrics */
  onMetrics?: (metrics: SystemMetrics) => void;
}

/** System-wide metrics snapshot */
export interface SystemMetrics {
  timestamp: Date;
  queues: QueueMetrics[];
  rates: RateMetrics;
  activeAlerts: Alert[];
  health: HealthCheck[];
  domainMetrics: DomainRateMetrics[];
}

/** Time window for metrics aggregation */
export type TimeWindow = '1m' | '5m' | '15m' | '1h' | '6h' | '24h';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default configuration */
const DEFAULT_CONFIG: MonitorConfig = {
  sampleIntervalMs: 10000, // 10 seconds
  maxSamples: 10080, // ~7 days at 1 minute intervals
  queueDepthWarning: 1000,
  errorRateThreshold: 0.1, // 10%
  latencyThresholdMs: 5000, // 5 seconds
  rateLimitUtilization: 0.8, // 80%
};

/** Metric retention by window */
const WINDOW_DURATIONS: Record<TimeWindow, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// ============================================================================
// QUEUE MONITOR
// ============================================================================

/**
 * Queue Monitor
 * 
 * Monitors queue health, processing metrics, and generates alerts.
 * Tracks historical data for trend analysis.
 */
export class QueueMonitor {
  private config: MonitorConfig;
  private queueService: EmailQueueService;
  private rateLimiter: EmailRateLimiter;
  private processor: EmailProcessor;
  
  // Metric storage
  private throughput: MetricPoint[] = [];
  private latency: MetricPoint[] = [];
  private errorCount: MetricPoint[] = [];
  private queueDepths: Map<string, MetricPoint[]> = new Map();
  
  // Alerting
  private activeAlerts: Map<string, Alert> = new Map();
  private eventListeners: Set<(event: Alert) => void> = new Set();
  
  // Sampling
  private sampleInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  
  // State tracking
  private lastQueueStats: Map<string, { processed: number; failed: number }> = new Map();
  private lastSampleTime: Date = new Date();

  constructor(
    queueService: EmailQueueService,
    rateLimiter: EmailRateLimiter,
    processor: EmailProcessor,
    config?: Partial<MonitorConfig>
  ) {
    this.queueService = queueService;
    this.rateLimiter = rateLimiter;
    this.processor = processor;
    
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Subscribe to alert events
   */
  subscribe(callback: (alert: Alert) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Emit alert
   */
  private emitAlert(alert: Alert): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(alert);
      } catch {
        // Soft failure
      }
    });
    
    if (this.config.onAlert) {
      this.config.onAlert(alert);
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    component: string,
    severity: AlertSeverity,
    message: string,
    metadata?: Record<string, unknown>
  ): Alert {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const alert: Alert = {
      id,
      severity,
      component,
      message,
      timestamp: new Date(),
      metadata,
    };
    
    this.activeAlerts.set(id, alert);
    this.emitAlert(alert);
    
    return alert;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
    }
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastSampleTime = new Date();
    
    // Initial sample
    void this.sample();
    
    // Set up interval
    this.sampleInterval = setInterval(() => {
      void this.sample();
    }, this.config.sampleIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = undefined;
    }
    this.isRunning = false;
  }

  /**
   * Get running status
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }

  /**
   * Sample current metrics
   */
  private async sample(): Promise<void> {
    const now = new Date();
    const stats = await this.queueService.getAllStats();
    
    // Calculate throughput
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalWaiting = 0;
    
    for (const [name, queueStats] of Object.entries(stats)) {
      totalWaiting += queueStats.waiting;
      totalProcessed += queueStats.completed;
      totalFailed += queueStats.failed;
      
      // Track queue depth
      if (!this.queueDepths.has(name)) {
        this.queueDepths.set(name, []);
      }
      const depths = this.queueDepths.get(name)!;
      depths.push({
        timestamp: now,
        value: queueStats.waiting + queueStats.active,
        labels: { queue: name },
      });
      
      // Prune old data
      this.pruneMetrics(depths);
    }
    
    // Calculate rate since last sample
    const prevProcessed = this.getLastProcessed();
    const prevFailed = this.getLastFailed();
    const timeDiff = (now.getTime() - this.lastSampleTime.getTime()) / 1000; // seconds
    
    const throughput = timeDiff > 0 ? (totalProcessed - prevProcessed) / (timeDiff / 60) : 0;
    const errorRate = throughput > 0 ? (totalFailed - prevFailed) / throughput : 0;
    
    // Store metrics
    this.throughput.push({ timestamp: now, value: throughput });
    this.errorCount.push({ timestamp: now, value: errorRate });
    this.pruneMetrics(this.throughput);
    this.pruneMetrics(this.errorCount);
    
    // Check for alerts
    this.checkAlerts(totalWaiting, errorRate, throughput);
    
    // Emit metrics snapshot
    if (this.config.onMetrics) {
      const metrics = await this.getSystemMetrics();
      this.config.onMetrics(metrics);
    }
    
    this.lastSampleTime = now;
  }

  /**
   * Get last processed count
   */
  private getLastProcessed(): number {
    let total = 0;
    for (const { processed } of this.lastQueueStats.values()) {
      total += processed;
    }
    return total;
  }

  /**
   * Get last failed count
   */
  private getLastFailed(): number {
    let total = 0;
    for (const { failed } of this.lastQueueStats.values()) {
      total += failed;
    }
    return total;
  }

  /**
   * Prune old metrics
   */
  private pruneMetrics(metrics: MetricPoint[]): void {
    const cutoff = Date.now() - WINDOW_DURATIONS['24h'];
    while (metrics.length > 0 && metrics[0].timestamp.getTime() < cutoff) {
      metrics.shift();
    }
    
    // Also limit by count
    while (metrics.length > this.config.maxSamples) {
      metrics.shift();
    }
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(queueDepth: number, errorRate: number, throughput: number): void {
    // Queue depth warning
    if (queueDepth > this.config.queueDepthWarning) {
      const existingAlert = Array.from(this.activeAlerts.values()).find(
        a => a.component === 'queue' && a.message.includes('depth')
      );
      
      if (!existingAlert) {
        this.createAlert(
          'queue',
          'warning',
          `Queue depth exceeded ${this.config.queueDepthWarning} jobs (current: ${queueDepth})`,
          { queueDepth, threshold: this.config.queueDepthWarning }
        );
      }
    }
    
    // Error rate alert
    if (errorRate > this.config.errorRateThreshold) {
      const existingAlert = Array.from(this.activeAlerts.values()).find(
        a => a.component === 'processor' && a.message.includes('error rate')
      );
      
      if (!existingAlert) {
        this.createAlert(
          'processor',
          'error',
          `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(this.config.errorRateThreshold * 100).toFixed(1)}%`,
          { errorRate, threshold: this.config.errorRateThreshold }
        );
      }
    }
    
    // No throughput alert
    if (throughput === 0 && queueDepth > 0) {
      const existingAlert = Array.from(this.activeAlerts.values()).find(
        a => a.component === 'processor' && a.message.includes('No throughput')
      );
      
      if (!existingAlert) {
        this.createAlert(
          'processor',
          'critical',
          `No throughput detected with ${queueDepth} jobs in queue`,
          { queueDepth, throughput }
        );
      }
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics[]> {
    const stats = await this.queueService.getAllStats();
    const metrics: QueueMetrics[] = [];
    
    for (const [name, stat] of Object.entries(stats)) {
      const depths = this.queueDepths.get(name) || [];
      const avgWaitTime = this.calculateAvgWaitTime(depths);
      const processingRate = this.calculateProcessingRate(name, stat.completed);
      
      metrics.push({
        queueName: name,
        waiting: stat.waiting,
        active: stat.active,
        completed: stat.completed,
        failed: stat.failed,
        delayed: stat.delayed,
        processingRate,
        avgWaitTime,
      });
    }
    
    return metrics;
  }

  /**
   * Calculate average wait time
   */
  private calculateAvgWaitTime(depths: MetricPoint[]): number {
    if (depths.length < 2) return 0;
    
    // Estimate based on queue depth changes
    let totalWait = 0;
    let count = 0;
    
    for (let i = 1; i < depths.length; i++) {
      const prev = depths[i - 1];
      const curr = depths[i];
      const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();
      const depthChange = curr.value - prev.value;
      
      if (depthChange < 0) { // Queue is draining
        totalWait += timeDiff;
        count++;
      }
    }
    
    return count > 0 ? totalWait / count : 0;
  }

  /**
   * Calculate processing rate per minute
   */
  private calculateProcessingRate(queueName: string, completed: number): number {
    const last = this.lastQueueStats.get(queueName);
    if (!last) return 0;
    
    const timeDiff = (Date.now() - this.lastSampleTime.getTime()) / 1000 / 60; // minutes
    if (timeDiff <= 0) return 0;
    
    return (completed - last.processed) / timeDiff;
  }

  /**
   * Get rate metrics
   */
  getRateMetrics(): RateMetrics {
    const recentThroughput = this.getRecentAverage(this.throughput, 5);
    const recentErrors = this.getRecentAverage(this.errorCount, 5);
    const recentLatency = this.getRecentAverage(this.latency, 5);
    
    const successRate = this.throughput.length > 0 
      ? 1 - recentErrors 
      : 1;
    
    return {
      throughput: recentThroughput,
      successRate: Math.max(0, Math.min(1, successRate)),
      avgLatency: recentLatency,
      errorRate: recentErrors,
    };
  }

  /**
   * Get recent average of metrics
   */
  private getRecentAverage(metrics: MetricPoint[], count: number): number {
    if (metrics.length === 0) return 0;
    
    const recent = metrics.slice(-count);
    const sum = recent.reduce((acc, m) => acc + m.value, 0);
    return sum / recent.length;
  }

  /**
   * Get health check results
   */
  async getHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const start = performance.now();
    
    // Queue service health
    try {
      const stats = await this.queueService.getAllStats();
      const hasQueues = Object.keys(stats).length > 0;
      const totalDepth = Object.values(stats).reduce((sum, s) => sum + s.waiting, 0);
      
      const queueStatus: HealthStatus = hasQueues 
        ? totalDepth > this.config.queueDepthWarning * 0.8 
          ? 'degraded' 
          : 'healthy'
        : 'unknown';
      
      checks.push({
        component: 'queue-service',
        status: queueStatus,
        latency: performance.now() - start,
        lastCheck: new Date(),
        message: totalDepth > 0 ? `${totalDepth} jobs waiting` : 'No waiting jobs',
        details: { queues: Object.keys(stats).length, totalDepth },
      });
    } catch (error) {
      checks.push({
        component: 'queue-service',
        status: 'critical',
        latency: performance.now() - start,
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Rate limiter health
    try {
      const tracked = this.rateLimiter.getAllTracked();
      checks.push({
        component: 'rate-limiter',
        status: 'healthy',
        latency: 0,
        lastCheck: new Date(),
        message: `Tracking ${tracked.length} domains`,
        details: { domainsTracked: tracked.length },
      });
    } catch (error) {
      checks.push({
        component: 'rate-limiter',
        status: 'critical',
        latency: 0,
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Processor health
    try {
      const procStats = this.processor.getStats();
      const processorStatus: HealthStatus = procStats.successRate > 0.9 
        ? 'healthy' 
        : procStats.successRate > 0.5 
        ? 'degraded' 
        : 'critical';
      
      checks.push({
        component: 'processor',
        status: processorStatus,
        latency: 0,
        lastCheck: new Date(),
        message: `${(procStats.successRate * 100).toFixed(1)}% success rate`,
        details: procStats,
      });
    } catch (error) {
      checks.push({
        component: 'processor',
        status: 'critical',
        latency: 0,
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    return checks;
  }

  /**
   * Get domain rate metrics
   */
  getDomainMetrics(): DomainRateMetrics[] {
    const tracked = this.rateLimiter.getAllTracked();
    
    return tracked.map(t => {
      const age = Math.ceil((Date.now() - t.firstSentAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get tier based on account age
      let tier = 'New';
      let maxDaily = 50;
      
      if (age <= 3) { tier = 'New'; maxDaily = 50; }
      else if (age <= 7) { tier = 'Building'; maxDaily = 100; }
      else if (age <= 14) { tier = 'Growing'; maxDaily = 200; }
      else if (age <= 30) { tier = 'Established'; maxDaily = 400; }
      else { tier = 'Mature'; maxDaily = 1000; }
      
      return {
        domain: t.domain,
        sentToday: t.sentToday,
        sentThisHour: t.sentThisHour,
        sentThisMinute: t.sentThisMinute,
        failureCount: t.failureCount,
        consecutiveFailures: t.consecutiveFailures,
        tier,
        maxDaily,
        utilization: t.sentToday / maxDaily,
      };
    });
  }

  /**
   * Get system-wide metrics snapshot
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [
      queues,
      health,
    ] = await Promise.all([
      this.getQueueMetrics(),
      this.getHealthChecks(),
    ]);
    
    const rates = this.getRateMetrics();
    const domainMetrics = this.getDomainMetrics();
    
    return {
      timestamp: new Date(),
      queues,
      rates,
      activeAlerts: Array.from(this.activeAlerts.values()),
      health,
      domainMetrics,
    };
  }

  /**
   * Get alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get historical metrics for a window
   */
  getHistoricalMetrics(window: TimeWindow): {
    throughput: MetricPoint[];
    errors: MetricPoint[];
    latency: MetricPoint[];
  } {
    const cutoff = Date.now() - WINDOW_DURATIONS[window];
    
    return {
      throughput: this.throughput.filter(m => m.timestamp.getTime() >= cutoff),
      errors: this.errorCount.filter(m => m.timestamp.getTime() >= cutoff),
      latency: this.latency.filter(m => m.timestamp.getTime() >= cutoff),
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  async exportPrometheusMetrics(): Promise<string> {
    const lines: string[] = [];
    const timestamp = Date.now();
    
    // Queue metrics
    const queues = await this.getQueueMetrics();
    for (const q of queues) {
      lines.push(`email_queue_depth{queue="${q.queueName}"} ${q.waiting} ${timestamp}`);
      lines.push(`email_queue_active{queue="${q.queueName}"} ${q.active} ${timestamp}`);
      lines.push(`email_queue_failed{queue="${q.queueName}"} ${q.failed} ${timestamp}`);
    }
    
    // Rate metrics
    const rates = this.getRateMetrics();
    lines.push(`email_throughput ${rates.throughput} ${timestamp}`);
    lines.push(`email_success_rate ${rates.successRate} ${timestamp}`);
    lines.push(`email_error_rate ${rates.errorRate} ${timestamp}`);
    
    // Domain metrics
    const domains = this.getDomainMetrics();
    for (const d of domains) {
      lines.push(`email_domain_sent{domain="${d.domain}"} ${d.sentToday} ${timestamp}`);
      lines.push(`email_domain_utilization{domain="${d.domain}"} ${d.utilization} ${timestamp}`);
    }
    
    // Health metrics
    const health = await this.getHealthChecks();
    for (const h of health) {
      const healthValue = h.status === 'healthy' ? 1 : h.status === 'degraded' ? 0.5 : 0;
      lines.push(`email_health{component="${h.component}"} ${healthValue} ${timestamp}`);
    }
    
    return lines.join('\\n');
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalProcessed: number;
    totalFailed: number;
    successRate: number;
    avgThroughput: number;
    activeAlerts: number;
    monitoring: boolean;
  } {
    const rates = this.getRateMetrics();
    const totalProcessed = this.throughput.reduce((sum, m) => sum + m.value, 0);
    const totalFailed = this.errorCount.reduce((sum, m) => sum + m.value, 0);
    const avgThroughput = this.throughput.length > 0 
      ? this.throughput.reduce((sum, m) => sum + m.value, 0) / this.throughput.length 
      : 0;
    
    return {
      totalProcessed,
      totalFailed,
      successRate: rates.successRate,
      avgThroughput,
      activeAlerts: this.activeAlerts.size,
      monitoring: this.isRunning,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/** Singleton instance */
let globalQueueMonitor: QueueMonitor | null = null;

/**
 * Get or create the global queue monitor
 */
export function getQueueMonitor(
  queueService: EmailQueueService,
  rateLimiter: EmailRateLimiter,
  processor: EmailProcessor,
  config?: Partial<MonitorConfig>
): QueueMonitor {
  if (!globalQueueMonitor) {
    globalQueueMonitor = new QueueMonitor(queueService, rateLimiter, processor, config);
  }
  return globalQueueMonitor;
}

/**
 * Reset the global queue monitor
 */
export function resetQueueMonitor(): void {
  if (globalQueueMonitor) {
    globalQueueMonitor.stop();
  }
  globalQueueMonitor = null;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format duration to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Check if health is critical
 */
export function isCriticalHealth(health: HealthCheck[]): boolean {
  return health.some(h => h.status === 'critical');
}

/**
 * Aggregate health status
 */
export function aggregateHealth(health: HealthCheck[]): HealthStatus {
  if (health.length === 0) return 'unknown';
  if (health.some(h => h.status === 'critical')) return 'critical';
  if (health.some(h => h.status === 'degraded')) return 'degraded';
  if (health.every(h => h.status === 'healthy')) return 'healthy';
  return 'unknown';
}
