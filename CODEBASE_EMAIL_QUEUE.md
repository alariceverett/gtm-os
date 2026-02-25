# Email Queue System Documentation

## Overview

This document describes the Bull/Redis-based email queue system with warm-up rate limiting for the GTM OS platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Email Queue System                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │  Priority    │   │   Normal     │   │    Bulk      │         │
│  │   Queue      │   │   Queue      │   │   Queue      │         │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘         │
│         │                  │                  │                  │
│         └────────────┬─────┴──────────────────┘                  │
│                      ▼                                           │
│           ┌─────────────────────┐                              │
│           │    Email Processor    │                              │
│           └───────────┬───────────┘                              │
│                       │                                          │
│         ┌─────────────┼─────────────┐                         │
│         ▼             ▼             ▼                            │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────────┐            │
│  │Rate Limiter │ │    Send     │ │ Dead Letter    │            │
│  │   (Warm-up) │ │   Provider  │ │    Queue       │            │
│  └─────────────┘ └─────────────┘ └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. lib/email-queue.ts - Queue Management

**Features:**
- Multiple queue support (high priority, normal, bulk)
- In-memory queue simulation (development mode)
- Redis/BullMQ support (production mode)
- Job scheduling with delays
- Priority ordering
- Dead letter queue for failures

**Queues:**
- `email:priority` - Critical/high priority emails (immediate delivery)
- `email:normal` - Standard emails (default queue)
- `email:bulk` - Low priority/marketing emails (bulk delivery)
- `email:dead-letter` - Failed jobs that exceeded retry attempts

**Key Exports:**
```typescript
- EmailQueueService        // Main queue service class
- getEmailQueueService()   // Singleton accessor
- validateEmailJob()       // Job validation utility
- generateJobId()          // ID generation
- QUEUE_NAMES              // Queue name constants
- PRIORITY_QUEUES          // Priority-to-queue mapping
```

### 2. lib/rate-limiter.ts - Warm-up Rate Limiting

**Rate Tiers:**

| Account Age | Daily Limit | Hourly Limit | Per-Minute | Tier Name |
|-------------|-------------|--------------|-----------|-----------|
| Day 1-3     | 50          | 10           | 2         | New |
| Day 4-7     | 100         | 20           | 5         | Building |
| Day 8-14    | 200         | 40           | 10        | Growing |
| Day 15-30   | 400         | 80           | 20        | Established |
| Day 31+     | 1000        | 200          | 50        | Mature |

**Features:**
- Per-domain and per-account tracking
- Time-windowed counters (daily, hourly, minute)
- Consecutive failure detection
- Hard limit enforcement
- Event subscription for alerts

**Key Exports:**
```typescript
- EmailRateLimiter         // Rate limiter class
- getEmailRateLimiter()    // Singleton accessor
- getRateLimitTier(age)    // Get tier for account age
- extractDomain(email)     // Domain extraction
- RATE_TIERS               // Tier constants
```

**Usage:**
```typescript
const limiter = getEmailRateLimiter({ hardLimit: true });

// Check before sending
const result = limiter.checkLimit('example.com', 'account-1', 1);
if (!result.allowed) {
  // Queue for retry with retryAfterMs
  console.log(`Rate limited, retry after ${result.retryAfterMs}ms`);
}

// Record outcomes
limiter.recordSuccess(domain, accountId);
limiter.recordFailure(domain, accountId);
```

### 3. lib/email-processor.ts - Job Processing

**Features:**
- Automatic validation of job data
- Rate limit checking
- Provider abstraction
- Exponential backoff retry logic
- Event emission for monitoring
- Graceful error handling

**Retry Logic:**
- Max 3 retry attempts (configurable)
- Exponential backoff: 5s, 15s, 45s with ±20% jitter
- Rate limit errors trigger queue delay with retryAfterMs

**Key Exports:**
```typescript
- EmailProcessor           // Processor class
- getEmailProcessor()      // Singleton accessor
- createEmailJob(data)     // Job creation helper
- createSimulatedProvider() // Mock provider for testing
- isRateLimitError(error)  // Error type check
```

**Usage:**
```typescript
const processor = new EmailProcessor({
  provider: emailProvider,
  maxRetries: 3,
  baseDelayMs: 5000,
  logLevel: 'info',
  onEvent: (event) => handleEvent(event),
  onRateLimit: (job, check) => handleRateLimit(job, check),
});

// Process a job directly
const result = await processor.processJob(job);
```

### 4. lib/queue-monitor.ts - Metrics & Health

**Features:**
- Real-time queue depth monitoring
- Processing rate tracking
- Success/error rate calculations
- Health check endpoints
- Alert generation
- Prometheus-compatible export

**Metrics Tracked:**
- Queue depth (waiting, active, failed, completed)
- Throughput (emails/minute)
- Success rate (0-1)
- Average latency
- Error rate
- Domain utilization

**Key Exports:**
```typescript
- QueueMonitor             // Monitor class
- getQueueMonitor()        // Singleton accessor
- formatBytes(bytes)       // Byte formatting
- formatDuration(ms)       // Duration formatting
- isCriticalHealth(health) // Health check utility
- aggregateHealth(health)  // Aggregate health status
```

**Prometheus Export:**
```
email_queue_depth{queue="email:priority"} 42 1234567890000
email_throughput 5.3 1234567890000
email_success_rate 0.95 1234567890000
email_domain_sent{domain="example.com"} 25 1234567890000
email_health{component="processor"} 1 1234567890000
```

## Configuration

### Environment Variables

```bash
# Redis Connection (Production)
REDIS_URL=redis://localhost:6379

# Queue Configuration
QUEUE_CONCURRENCY=5
QUEUE_MAX_WAITING=10000
MAX_RETRIES=3

# Rate Limiting
HARD_LIMIT=true

# Monitoring
SAMPLE_INTERVAL_MS=10000
METRICS_RETENTION_DAYS=7
```

### TypeScript Configuration

```typescript
// Queue config
interface QueueConfig {
  redisUrl?: string;
  concurrency?: number;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: 'fixed' | 'exponential'; delay?: number };
  };
}

// Processor config
interface EmailProcessorConfig {
  provider: EmailProvider;
  rateLimiter?: EmailRateLimiter;
  queueService?: EmailQueueService;
  maxRetries?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  onEvent?: (event: ProcessingEvent) => void;
  onRateLimit?: (job: EmailJobData, check: RateLimitCheck) => void;
  simulate?: boolean;
}

// Monitor config
interface MonitorConfig {
  sampleIntervalMs: number;
  maxSamples: number;
  queueDepthWarning: number;
  errorRateThreshold: number;
  latencyThresholdMs: number;
  rateLimitUtilization: number;
  onAlert?: (alert: Alert) => void;
  onMetrics?: (metrics: SystemMetrics) => void;
}
```

## Usage Examples

### Basic Email Send

```typescript
import { getEmailQueueService, createEmailJob } from '@/lib/email-queue';

const queueService = getEmailQueueService();

const job = createEmailJob({
  to: 'recipient@example.com',
  from: 'sender@example.com',
  subject: 'Hello World',
  html: '<p>Hello!</p>',
  accountId: 'account-1',
  accountAgeInDays: 15,
  priority: 'normal',
});

const { id, queue } = await queueService.addEmail(job);
console.log(`Queued email ${id} to ${queue}`);
```

### Advanced Rate Limit Handling

```typescript
import { getEmailProcessor, isRateLimitError } from '@/lib/email-processor';

const processor = getEmailProcessor({ provider });

processor.subscribe((event) => {
  console.log(`Stage: ${event.stage} - ${event.message}`);
});

processor.onRateLimit = (job, check) => {
  console.warn(`Rate limit hit for ${job.accountId}: ${check.reason}`);
  // Can trigger notifications, webhooks, etc.
};

queueService.process(async (job) => {
  try {
    return await processor.processJob(job.data);
  } catch (error) {
    if (isRateLimitError(error)) {
      // Automatically retry after rate limit clears
      throw error; // Queue will handle retry with retryAfterMs
    }
    throw error;
  }
});
```

### Monitoring Setup

```typescript
import { getQueueMonitor } from '@/lib/queue-monitor';

const monitor = getQueueMonitor(
  queueService,
  rateLimiter,
  processor,
  {
    sampleIntervalMs: 10000,
    onAlert: (alert) => {
      slack.send(`🚨 ${alert.severity}: ${alert.message}`);
    },
    onMetrics: (metrics) => {
      // Send to metrics system
      datadog.gauge('email.queue.depth', metrics.queues[0].waiting);
    },
  }
);

monitor.start();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await monitor.getHealthChecks();
  const status = aggregateHealth(health);
  res.status(status === 'healthy' ? 200 : status === 'degraded' ? 503 : 500)
    .json({ status, health });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = await monitor.exportPrometheusMetrics();
  res.set('Content-Type', 'text/plain').send(metrics);
});
```

## Testing

### Unit Tests

```bash
# Rate limiter
npm run test -- tests/unit/rate-limiter.test.ts

# Email queue
npm run test -- tests/unit/email-queue.test.ts

# Email processor
npm run test -- tests/unit/email-processor.test.ts

# Queue monitor
npm run test -- tests/unit/queue-monitor.test.ts
```

### Integration Tests

```bash
# Full system integration
npm run test -- tests/integration/email-queue-integration.test.ts
```

### Test Coverage

Target: >80% coverage across all modules

- Rate limiter logic: >90%
- Queue operations: >85%
- Processor workflow: >85%
- Monitor metrics: >80%

## Key Concepts

### Warm-up Pattern

New email accounts start with conservative sending limits to establish sender reputation with receiving mail servers. Limits increase progressively as the account ages and reputation builds.

### Hard vs Soft Rate Limits

- **Hard Limit (default)**: Reject emails that exceed limits
- **Soft Limit**: Queue emails for later delivery

### Exponential Backoff

Retry delays follow exponential pattern: baseDelay × (multiplier^(attempt-1)) with jitter to prevent thundering herd:

- Attempt 1: 5s ± 20%
- Attempt 2: 15s ± 20%
- Attempt 3: 45s ± 20%

### Dead Letter Queue

Jobs that fail after max retry attempts are moved to the dead letter queue for manual review. Can be requeued or permanently failed.

### Consecutive Failure Detection

After 10 consecutive failures to a domain/account, rate limiter blocks further sends until manual intervention. This prevents reputation damage from unhealthy configurations.

## Safety Features

1. **Domain Isolation**: Rate limits tracked per-domain, preventing one domain from affecting others
2. **Account Isolation**: Within domains, accounts have separate tracking
3. **Failure Tracking**: Monitors consecutive failures
4. **Time Windows**: Daily/hourly/minute windows reset automatically
5. **Hard Limits**: Enforced by default to protect sender reputation
6. **Event Emissions**: Full observability for monitoring and alerting

## Performance Considerations

- Use Redis in production for persistence and cluster support
- In-memory implementation suitable for development/testing
- Queue polling interval configurable (default: 10s for monitor)
- Max retry attempts prevent infinite loops
- Dead letter queue prevents retry spam for persistent failures

## Development Notes

### Adding a New Provider

```typescript
class MyEmailProvider implements EmailProvider {
  name = 'my-provider';
  
  async send(data: EmailJobData): Promise<{ messageId: string; response: unknown }> {
    // Implement sending logic
    return { messageId: '...', response: { ... } };
  }
  
  async validate(): Promise<{ valid: boolean; error?: string }> {
    // Validate API keys, endpoints, etc.
    return { valid: true };
  }
  
  async health(): Promise<{ healthy: boolean; latency: number }> {
    // Health check
    return { healthy: true, latency: 0 };
  }
}
```

### Custom Event Handling

```typescript
processor.subscribe((event) => {
  // Log to analytics
  analytics.track('email_event', {
    jobId: event.jobId,
    stage: event.stage,
    duration: event.durationMs,
  });
  
  // Trigger webhooks
  webhook.call('/email/events', event);
});
```

## Migration Notes

### From Version X.X

1. Update imports to use new path aliases `@/lib/...`
2. Replace old rate limiter with new `EmailRateLimiter`
3. Update queue service initialization
4. Configure monitoring with new interfaces

## Troubleshooting

### Common Issues

**Queue not processing:**
- Check processor is started: `processor.resume()`
- Verify queue concurrency settings

**Rate limits not enforced:**
- Ensure `hardLimit: true` in config
- Check accountId and domain are correct

**Jobs going to dead letter:**
- Check provider configuration
- Review failure reasons in events
- Verify rate limits not blocking

**Low throughput:**
- Increase queue concurrency
- Check rate tier for account age
- Review processor health

## Related Documentation

- `AGENTS.md` - Agent configuration
- `README.md` - Project overview
- `tests/unit/*.test.ts` - Test examples
