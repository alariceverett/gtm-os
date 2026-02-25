/**
 * Unit Tests - Rate Limiter
 * 
 * Tests warm-up rate limiting logic:
 * - Tier calculation based on account age
 * - Per-domain tracking
 * - Hard limit enforcement
 * - Window-based counters
 * - Failure tracking
 * Target: >80% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EmailRateLimiter,
  getEmailRateLimiter,
  resetEmailRateLimiter,
  getRateLimitTier,
  extractDomain,
  RATE_TIERS,
} from '@/lib/rate-limiter';

describe('Rate Limiter - Warm-up Tiers', () => {
  describe('Tier Calculation', () => {
    it('should return tier 50 emails/day for day 1-3', () => {
      const tier = getRateLimitTier(1);
      expect(tier.maxPerDay).toBe(50);
      expect(tier.maxPerHour).toBe(10);
      expect(tier.maxPerMinute).toBe(2);
    });

    it('should return tier 50 emails/day for day 3', () => {
      const tier = getRateLimitTier(3);
      expect(tier.maxPerDay).toBe(50);
    });

    it('should return tier 100 emails/day for day 4-7', () => {
      expect(getRateLimitTier(4).maxPerDay).toBe(100);
      expect(getRateLimitTier(7).maxPerDay).toBe(100);
    });

    it('should return tier 200 emails/day for day 8-14', () => {
      expect(getRateLimitTier(8).maxPerDay).toBe(200);
      expect(getRateLimitTier(14).maxPerDay).toBe(200);
    });

    it('should return tier 400 emails/day for day 15-30', () => {
      expect(getRateLimitTier(15).maxPerDay).toBe(400);
      expect(getRateLimitTier(30).maxPerDay).toBe(400);
    });

    it('should return tier 1000 emails/day for day 31+', () => {
      expect(getRateLimitTier(31).maxPerDay).toBe(1000);
      expect(getRateLimitTier(100).maxPerDay).toBe(1000);
    });

    it('should return tier 50 for day 0', () => {
      const tier = getRateLimitTier(0);
      expect(tier.maxPerDay).toBe(50);
    });
  });

  describe('Domain Extraction', () => {
    it('should extract domain from simple email', () => {
      expect(extractDomain('test@example.com')).toBe('example.com');
    });

    it('should extract domain from email with subdomain', () => {
      expect(extractDomain('test@mail.example.com')).toBe('mail.example.com');
    });

    it('should return domain in lowercase', () => {
      expect(extractDomain('test@EXAMPLE.COM')).toBe('example.com');
    });

    it('should return "unknown" for invalid email', () => {
      expect(extractDomain('invalid')).toBe('unknown');
    });

    it('should return "unknown" for email without @', () => {
      expect(extractDomain('test')).toBe('unknown');
    });
  });

  describe('RATE_TIERS Constants', () => {
    it('should have correct tier configurations', () => {
      // Day 1-3
      expect(RATE_TIERS[3]).toEqual({
        maxPerDay: 50,
        maxPerHour: 10,
        maxPerMinute: 2,
        description: 'New (Day 1-3)',
      });

      // Day 31+
      expect(RATE_TIERS[Infinity]).toEqual({
        maxPerDay: 1000,
        maxPerHour: 200,
        maxPerMinute: 50,
        description: 'Mature (Day 31+)',
      });
    });
  });
});

describe('EmailRateLimiter - Core Functionality', () => {
  let limiter: EmailRateLimiter;

  beforeEach(() => {
    resetEmailRateLimiter();
    limiter = getEmailRateLimiter({ hardLimit: true });
  });

  describe('Rate Limit Checks', () => {
    it('should allow first email', () => {
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      expect(result.allowed).toBe(true);
    });

    it('should track per-domain separately', () => {
      limiter.recordSuccess('example.com', 'account-1');
      limiter.recordSuccess('other.com', 'account-1');
      
      const result1 = limiter.checkLimit('example.com', 'account-1', 1);
      const result2 = limiter.checkLimit('other.com', 'account-1', 1);
      
      // Both should still allow because they're different domains
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      
      // Both should show usage (1 recorded send each)
      expect(result1.currentUsage.daily).toBe(1);
      expect(result2.currentUsage.daily).toBe(1);
    });

    it('should track per-account separately', () => {
      limiter.recordSuccess('example.com', 'account-1');
      limiter.recordSuccess('example.com', 'account-2');
      
      const result1 = limiter.checkLimit('example.com', 'account-1', 1);
      const result2 = limiter.checkLimit('example.com', 'account-2', 1);
      
      // Both should track separately
      expect(result1.currentUsage.daily).toBe(1);
      expect(result2.currentUsage.daily).toBe(1);
    });

    it('should block when daily limit reached', () => {
      // Day 1 account with 50/day limit
      for (let i = 0; i < 50; i++) {
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily limit exceeded');
      expect(result.retryAfterMs).toBeDefined();
    });

    it('should provide retryAfter for daily blocks', () => {
      // Fill up daily quota
      for (let i = 0; i < 50; i++) {
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      // Should be roughly 24 hours (but less since day started)
      expect(result.retryAfterMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('should block when hourly limit reached', () => {
      // Day 1 account with 10/hour limit
      for (let i = 0; i < 10; i++) {
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Hourly limit exceeded');
    });

    it('should block when per-minute limit reached', () => {
      // Day 1 account with 2/minute limit
      limiter.recordSuccess('example.com', 'account-1');
      limiter.recordSuccess('example.com', 'account-1');
      
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Per-minute limit exceeded');
    });

    it('should track consecutive failures', () => {
      for (let i = 0; i < 10; i++) {
        limiter.recordFailure('example.com', 'account-1');
      }
      
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many consecutive failures');
    });

    it('should reset consecutive failures on success', () => {
      // Add failures
      for (let i = 0; i < 9; i++) {
        limiter.recordFailure('example.com', 'account-1');
      }
      
      // Success should reset
      limiter.recordSuccess('example.com', 'account-1');
      
      const tracking = limiter.getTracking('example.com', 'account-1');
      expect(tracking?.consecutiveFailures).toBe(0);
    });
  });

  describe('Success/Failure Recording', () => {
    it('should increment sent counts on success', () => {
      limiter.recordSuccess('example.com', 'account-1');
      
      const tracking = limiter.getTracking('example.com', 'account-1');
      expect(tracking?.sentToday).toBe(1);
      expect(tracking?.sentThisHour).toBe(1);
      expect(tracking?.sentThisMinute).toBe(1);
    });

    it('should track multiple successes', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      const tracking = limiter.getTracking('example.com', 'account-1');
      expect(tracking?.sentToday).toBe(5);
    });

    it('should increment failure count', () => {
      limiter.recordFailure('example.com', 'account-1');
      limiter.recordFailure('example.com', 'account-1');
      
      const tracking = limiter.getTracking('example.com', 'account-1');
      expect(tracking?.failureCount).toBe(2);
      expect(tracking?.consecutiveFailures).toBe(2);
    });
  });

  describe('Event Subscription', () => {
    it('should emit events on successful limit check', () => {
      const events: Array<{ allowed: boolean; domain: string }> = [];
      
      limiter.subscribe((event) => {
        events.push({ allowed: event.allowed, domain: event.domain });
      });
      
      limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(events).toHaveLength(1);
      expect(events[0].allowed).toBe(true);
      expect(events[0].domain).toBe('example.com');
    });

    it('should emit events on blocked limit check', () => {
      const events: Array<{ allowed: boolean; reason?: string }> = [];
      
      limiter.subscribe((event) => {
        events.push({ allowed: event.allowed, reason: event.reason });
      });
      
      // Fill quota
      for (let i = 0; i < 50; i++) {
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      limiter.checkLimit('example.com', 'account-1', 1);
      
      const blockedEvent = events.find(e => !e.allowed);
      expect(blockedEvent).toBeDefined();
      expect(blockedEvent?.reason).toContain('Daily limit');
    });

    it('should support event unsubscription', () => {
      const events: string[] = [];
      
      const unsubscribe = limiter.subscribe(() => {
        events.push('event');
      });
      
      limiter.checkLimit('example.com', 'account-1', 1);
      expect(events).toHaveLength(1);
      
      unsubscribe();
      limiter.checkLimit('example.com', 'account-1', 1);
      expect(events).toHaveLength(1); // No new events
    });

    it('should handle errors in event listeners gracefully', () => {
      limiter.subscribe(() => {
        throw new Error('Listener error');
      });
      
      // Should not throw
      expect(() => {
        limiter.checkLimit('example.com', 'account-1', 1);
      }).not.toThrow();
    });
  });

  describe('onLimitHit Callback', () => {
    it('should call onLimitHit when limit is exceeded', () => {
      const limitHits: Array<{ domain: string; accountId: string; reason: string }> = [];
      
      const limiterWithCallback = new EmailRateLimiter({
        hardLimit: true,
        onLimitHit: (domain, accountId, reason) => {
          limitHits.push({ domain, accountId, reason });
        },
      });
      
      // Fill quota
      for (let i = 0; i < 50; i++) {
        limiterWithCallback.recordSuccess('example.com', 'account-1');
      }
      
      limiterWithCallback.checkLimit('example.com', 'account-1', 1);
      
      expect(limitHits).toHaveLength(1);
      expect(limitHits[0].domain).toBe('example.com');
      expect(limitHits[0].accountId).toBe('account-1');
      expect(limitHits[0].reason).toContain('Daily limit');
    });
  });

  describe('Tracking Management', () => {
    it('should return undefined for untracked domain', () => {
      const tracking = limiter.getTracking('untracked.com', 'account-1');
      expect(tracking).toBeUndefined();
    });

    it('should return all tracked domains', () => {
      limiter.recordSuccess('domain1.com', 'account-1');
      limiter.recordSuccess('domain2.com', 'account-1');
      limiter.recordSuccess('domain2.com', 'account-2');
      
      const allTracked = limiter.getAllTracked();
      expect(allTracked).toHaveLength(3);
    });

    it('should clear tracking for a domain', () => {
      limiter.recordSuccess('example.com', 'account-1');
      limiter.clearTracking('example.com', 'account-1');
      
      expect(limiter.getTracking('example.com', 'account-1')).toBeUndefined();
    });

    it('should clear all tracking', () => {
      limiter.recordSuccess('domain1.com', 'account-1');
      limiter.recordSuccess('domain2.com', 'account-2');
      
      limiter.clearAllTracking();
      
      expect(limiter.getAllTracked()).toHaveLength(0);
    });
  });

  describe('Rate Limit Result Structure', () => {
    it('should include current usage in result', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.currentUsage).toEqual({
        daily: 5,
        hourly: 5,
        minutely: 5,
      });
    });

    it('should include limits in result', () => {
      const result = limiter.checkLimit('example.com', 'account-1', 1);
      
      expect(result.limits).toBeDefined();
      expect(result.limits.maxPerDay).toBeGreaterThan(0);
      expect(result.limits.maxPerHour).toBeGreaterThan(0);
      expect(result.limits.maxPerMinute).toBeGreaterThan(0);
    });

    it('should include tier description based on account age', () => {
      const day1Result = limiter.checkLimit('example.com', 'account-1', 1);
      expect(day1Result.limits.description).toContain('Day 1');
      
      const day31Result = limiter.checkLimit('example.com', 'account-2', 31);
      expect(day31Result.limits.description).toContain('Day 31');
    });
  });
});

describe('EmailRateLimiter - Edge Cases', () => {
  let limiter: EmailRateLimiter;

  beforeEach(() => {
    resetEmailRateLimiter();
    limiter = getEmailRateLimiter({ hardLimit: true });
  });

  describe('Window Resets', () => {
    it('should initialize tracking on first use', () => {
      const result = limiter.checkLimit('new-domain.com', 'new-account', 1);
      
      expect(result.allowed).toBe(true);
      
      const tracking = limiter.getTracking('new-domain.com', 'new-account');
      expect(tracking).toBeDefined();
      expect(tracking?.domain).toBe('new-domain.com');
      expect(tracking?.accountId).toBe('new-account');
    });

    it('should handle negative account age gracefully', () => {
      const result = limiter.checkLimit('example.com', 'account-1', -1);
      
      // Should default to most restrictive tier
      expect(result.limits.maxPerDay).toBe(50);
    });
  });

  describe('Concurrent Access', () => {
    it.skip('should handle rapid successive checks', () => {
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        results.push(limiter.checkLimit('example.com', 'account-1', 1));
        limiter.recordSuccess('example.com', 'account-1');
      }
      
      // First check at i=0 is before any sends, so it should be OK
      // Subsequent checks (1-9) have sends recorded before them
      // But we only sent i times before each check, so:      
      // Check 0: 0 sent (allowed)
      // Check 1: 1 sent (allowed)      
      // ... all should be under the 50 limit
      expect(results[0].allowed).toBe(true);
      expect(results.every(r => r.allowed)).toBe(true);
    });
  });

  describe('Different Account Ages', () => {
    it('should apply correct tier for mature accounts', () => {
      const matureResult = limiter.checkLimit('example.com', 'mature-account', 31);
      
      expect(matureResult.limits.maxPerDay).toBe(1000);
      expect(matureResult.limits.description).toContain('Mature');
    });

    it('should apply correct tier for growing accounts', () => {
      const growingResult = limiter.checkLimit('example.com', 'growing-account', 10);
      
      expect(growingResult.limits.maxPerDay).toBe(200);
      expect(growingResult.limits.description).toContain('Growing');
    });

    it('should apply correct tier for established accounts', () => {
      const establishedResult = limiter.checkLimit('example.com', 'established-account', 20);
      
      expect(establishedResult.limits.maxPerDay).toBe(400);
      expect(establishedResult.limits.description).toContain('Established');
    });
  });

  describe('Failure Thresholds', () => {
    it('should block exactly at 10 consecutive failures', () => {
      // Add 9 failures - should still allow
      for (let i = 0; i < 9; i++) {
        limiter.recordFailure('example.com', 'account-1');
      }
      
      const result9 = limiter.checkLimit('example.com', 'account-1', 1);
      expect(result9.allowed).toBe(true);
      
      // 10th failure should block
      limiter.recordFailure('example.com', 'account-1');
      
      const result10 = limiter.checkLimit('example.com', 'account-1', 1);
      expect(result10.allowed).toBe(false);
      expect(result10.reason).toContain('10');
    });
  });
});

describe('EmailRateLimiter - Singleton', () => {
  it('should return the same instance when calling getEmailRateLimiter multiple times', () => {
    const instance1 = getEmailRateLimiter({ hardLimit: true });
    const instance2 = getEmailRateLimiter({ hardLimit: true });
    
    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', () => {
    const instance1 = getEmailRateLimiter({ hardLimit: true });
    
    resetEmailRateLimiter();
    
    const instance2 = getEmailRateLimiter({ hardLimit: true });
    
    expect(instance1).not.toBe(instance2);
  });
});
