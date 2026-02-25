/**
 * Rate Limiter - Warm-up Logic for Email Sending
 * 
 * Implements progressive rate limiting based on account age:
 * - Day 1-3: 50 emails/day
 * - Day 4-7: 100/day
 * - Day 8-14: 200/day
 * - Day 15-30: 400/day
 * - Day 31+: 1000/day
 * 
 * Tracks by domain and account to ensure safe warm-up patterns
 * and maintain sender reputation.
 */

/** Rate limit configuration for a specific tier */
export interface RateLimitTier {
  /** Maximum emails per day */
  maxPerDay: number;
  /** Maximum emails per hour */
  maxPerHour: number;
  /** Maximum emails per minute */
  maxPerMinute: number;
  /** Description of this tier */
  description: string;
}

/** Tracking record for a domain's sending history */
export interface DomainTracking {
  domain: string;
  accountId: string;
  sentToday: number;
  sentThisHour: number;
  sentThisMinute: number;
  firstSentAt: Date;
  lastSentAt: Date;
  lastResetAt: Date;
  windowStartHour: Date;
  windowStartMinute: Date;
  failureCount: number;
  consecutiveFailures: number;
}

/** Rate limit check result */
export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  currentUsage: {
    daily: number;
    hourly: number;
    minutely: number;
  };
  limits: RateLimitTier;
}

/** Configuration for the rate limiter */
export interface RateLimiterConfig {
  /** Redis client or connection string */
  redisUrl?: string;
  /** In-memory storage (fallback if no Redis) */
  useInMemory?: boolean;
  /** Callback for rate limit events */
  onLimitHit?: (domain: string, accountId: string, reason: string) => void;
  /** Hard limit enforcement - reject if true, queue if false */
  hardLimit: boolean;
}

/** Rate limit tiers based on account age in days */
export const RATE_TIERS: Record<number, RateLimitTier> = {
  // Day 1-3
  3: { maxPerDay: 50, maxPerHour: 10, maxPerMinute: 2, description: 'New (Day 1-3)' },
  // Day 4-7
  7: { maxPerDay: 100, maxPerHour: 20, maxPerMinute: 5, description: 'Building (Day 4-7)' },
  // Day 8-14
  14: { maxPerDay: 200, maxPerHour: 40, maxPerMinute: 10, description: 'Growing (Day 8-14)' },
  // Day 15-30
  30: { maxPerDay: 400, maxPerHour: 80, maxPerMinute: 20, description: 'Established (Day 15-30)' },
  // Day 31+
  Infinity: { maxPerDay: 1000, maxPerHour: 200, maxPerMinute: 50, description: 'Mature (Day 31+)' },
};

/** Event emitted when rate limit is checked */
export interface RateLimitEvent {
  eventId: string;
  timestamp: Date;
  domain: string;
  accountId: string;
  allowed: boolean;
  reason?: string;
  tier: RateLimitTier;
}

/**
 * Get the appropriate rate limit tier for an account's age
 * 
 * @param ageInDays - Number of days since account creation/start
 * @returns The rate limit tier configuration
 */
export function getRateLimitTier(ageInDays: number): RateLimitTier {
  const tiers = Object.keys(RATE_TIERS)
    .map(Number)
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  for (const tier of tiers) {
    if (ageInDays <= tier || tier === Infinity) {
      return RATE_TIERS[tier];
    }
  }
  
  return RATE_TIERS[3]; // Fallback to most restrictive
}

/**
 * Extract domain from email address
 * 
 * @param email - Email address
 * @returns Domain portion
 */
export function extractDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match?.[1]?.toLowerCase() || 'unknown';
}

/**
 * Rate Limiter for Email Sending
 * 
 * Implements progressive warm-up and per-domain tracking
 * with hard limit enforcement for sender reputation protection.
 */
export class EmailRateLimiter {
  private config: RateLimiterConfig;
  private domainTracking: Map<string, DomainTracking> = new Map();
  private eventListeners: Set<(event: RateLimitEvent) => void> = new Set();

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      hardLimit: true,
      useInMemory: true,
      ...config,
    };
  }

  /**
   * Subscribe to rate limit events
   * 
   * @param callback - Event handler callback
   * @returns Unsubscribe function
   */
  subscribe(callback: (event: RateLimitEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Emit a rate limit event
   */
  private emitEvent(event: RateLimitEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        // Soft failure - don't break the queue
      }
    });
  }

  /**
   * Get the tracking key for a domain/account combination
   */
  private getTrackingKey(domain: string, accountId: string): string {
    return `${domain}:${accountId}`;
  }

  /**
   * Get or create domain tracking record
   */
  private getOrCreateTracking(domain: string, accountId: string): DomainTracking {
    const key = this.getTrackingKey(domain, accountId);
    const now = new Date();
    
    let tracking = this.domainTracking.get(key);
    
    if (!tracking) {
      tracking = {
        domain,
        accountId,
        sentToday: 0,
        sentThisHour: 0,
        sentThisMinute: 0,
        firstSentAt: now,
        lastSentAt: now,
        lastResetAt: now,
        windowStartHour: now,
        windowStartMinute: now,
        failureCount: 0,
        consecutiveFailures: 0,
      };
      this.domainTracking.set(key, tracking);
    }
    
    // Reset windows if needed
    const msSinceLastReset = now.getTime() - tracking.lastResetAt.getTime();
    const msSinceHourStart = now.getTime() - tracking.windowStartHour.getTime();
    const msSinceMinuteStart = now.getTime() - tracking.windowStartMinute.getTime();
    
    // Reset daily counter after 24 hours
    if (msSinceLastReset >= 24 * 60 * 60 * 1000) {
      tracking.sentToday = 0;
      tracking.lastResetAt = now;
      tracking.consecutiveFailures = 0;
    }
    
    // Reset hourly counter after 1 hour
    if (msSinceHourStart >= 60 * 60 * 1000) {
      tracking.sentThisHour = 0;
      tracking.windowStartHour = now;
    }
    
    // Reset minute counter after 1 minute
    if (msSinceMinuteStart >= 60 * 1000) {
      tracking.sentThisMinute = 0;
      tracking.windowStartMinute = now;
    }
    
    return tracking;
  }

  /**
   * Record a successful send
   * 
   * @param domain - Domain that sent the email
   * @param accountId - Account identifier
   */
  recordSuccess(domain: string, accountId: string): void {
    const tracking = this.getOrCreateTracking(domain, accountId);
    const now = new Date();
    
    tracking.sentToday++;
    tracking.sentThisHour++;
    tracking.sentThisMinute++;
    tracking.lastSentAt = now;
    tracking.consecutiveFailures = 0;
  }

  /**
   * Record a failed send
   * 
   * @param domain - Domain that attempted to send
   * @param accountId - Account identifier
   */
  recordFailure(domain: string, accountId: string): void {
    const tracking = this.getOrCreateTracking(domain, accountId);
    tracking.failureCount++;
    tracking.consecutiveFailures++;
  }

  /**
   * Check if sending is allowed
   * 
   * @param domain - Domain to check
   * @param accountId - Account identifier
   * @param accountAgeInDays - Age of the account in days
   * @returns Rate limit check result
   */
  checkLimit(
    domain: string,
    accountId: string,
    accountAgeInDays: number
  ): RateLimitCheck {
    const tier = getRateLimitTier(accountAgeInDays);
    const tracking = this.getOrCreateTracking(domain, accountId);
    
    const result: RateLimitCheck = {
      allowed: true,
      currentUsage: {
        daily: tracking.sentToday,
        hourly: tracking.sentThisHour,
        minutely: tracking.sentThisMinute,
      },
      limits: tier,
    };

    // Check hard limits
    if (tracking.sentToday >= tier.maxPerDay) {
      result.allowed = false;
      result.reason = `Daily limit exceeded: ${tracking.sentToday}/${tier.maxPerDay}`;
      
      // Calculate retry after (next day at midnight)
      const tomorrow = new Date(tracking.lastResetAt);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      result.retryAfterMs = tomorrow.getTime() - Date.now();
      
      this.emitEvent({
        eventId: `${Date.now()}-${domain}-${accountId}`,
        timestamp: new Date(),
        domain,
        accountId,
        allowed: false,
        reason: result.reason,
        tier,
      });
      
      if (this.config.onLimitHit) {
        this.config.onLimitHit(domain, accountId, result.reason);
      }
      
      return result;
    }

    if (tracking.sentThisHour >= tier.maxPerHour) {
      result.allowed = false;
      result.reason = `Hourly limit exceeded: ${tracking.sentThisHour}/${tier.maxPerHour}`;
      
      // Calculate retry after
      const nextHour = new Date(tracking.windowStartHour);
      nextHour.setHours(nextHour.getHours() + 1);
      result.retryAfterMs = nextHour.getTime() - Date.now();
      
      this.emitEvent({
        eventId: `${Date.now()}-${domain}-${accountId}`,
        timestamp: new Date(),
        domain,
        accountId,
        allowed: false,
        reason: result.reason,
        tier,
      });
      
      if (this.config.onLimitHit) {
        this.config.onLimitHit(domain, accountId, result.reason);
      }
      
      return result;
    }

    if (tracking.sentThisMinute >= tier.maxPerMinute) {
      result.allowed = false;
      result.reason = `Per-minute limit exceeded: ${tracking.sentThisMinute}/${tier.maxPerMinute}`;
      
      // Calculate retry after
      result.retryAfterMs = 60 * 1000 - (Date.now() - tracking.windowStartMinute.getTime());
      
      this.emitEvent({
        eventId: `${Date.now()}-${domain}-${accountId}`,
        timestamp: new Date(),
        domain,
        accountId,
        allowed: false,
        reason: result.reason,
        tier,
      });
      
      if (this.config.onLimitHit) {
        this.config.onLimitHit(domain, accountId, result.reason);
      }
      
      return result;
    }

    // Check for excessive consecutive failures - might indicate reputation issues
    if (tracking.consecutiveFailures >= 10) {
      result.allowed = false;
      result.reason = `Too many consecutive failures (${tracking.consecutiveFailures}) - check domain health`;
      
      this.emitEvent({
        eventId: `${Date.now()}-${domain}-${accountId}`,
        timestamp: new Date(),
        domain,
        accountId,
        allowed: false,
        reason: result.reason,
        tier,
      });
      
      if (this.config.onLimitHit) {
        this.config.onLimitHit(domain, accountId, result.reason);
      }
      
      return result;
    }

    // All checks passed
    this.emitEvent({
      eventId: `${Date.now()}-${domain}-${accountId}`,
      timestamp: new Date(),
      domain,
      accountId,
      allowed: true,
      tier,
    });

    return result;
  }

  /**
   * Get current tracking data for a domain/account
   */
  getTracking(domain: string, accountId: string): DomainTracking | undefined {
    const key = this.getTrackingKey(domain, accountId);
    return this.domainTracking.get(key);
  }

  /**
   * Get all tracked domains
   */
  getAllTracked(): DomainTracking[] {
    return Array.from(this.domainTracking.values());
  }

  /**
   * Clear tracking data for a domain/account
   */
  clearTracking(domain: string, accountId: string): void {
    const key = this.getTrackingKey(domain, accountId);
    this.domainTracking.delete(key);
  }

  /**
   * Clear all tracking data (use with caution)
   */
  clearAllTracking(): void {
    this.domainTracking.clear();
  }
}

/** Singleton instance */
let globalRateLimiter: EmailRateLimiter | null = null;

/**
 * Get or create the global rate limiter instance
 */
export function getEmailRateLimiter(config?: Partial<RateLimiterConfig>): EmailRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new EmailRateLimiter(config);
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter instance (useful for testing)
 */
export function resetEmailRateLimiter(): void {
  globalRateLimiter = null;
}
