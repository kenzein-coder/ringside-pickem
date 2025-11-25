import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, throttle, debounce } from '../rateLimiter.js';

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter(5, 1000); // 5 requests per 1000ms
  });

  it('should allow requests within limit', () => {
    expect(limiter.isAllowed('user1')).toBe(true);
    expect(limiter.isAllowed('user1')).toBe(true);
    expect(limiter.isAllowed('user1')).toBe(true);
    expect(limiter.isAllowed('user1')).toBe(true);
    expect(limiter.isAllowed('user1')).toBe(true);
  });

  it('should block requests exceeding limit', () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('user2')).toBe(true);
    }

    // 6th request should be blocked
    expect(limiter.isAllowed('user2')).toBe(false);
  });

  it('should track different keys separately', () => {
    // User 1 makes 5 requests
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('user1')).toBe(true);
    }

    // User 2 should still be allowed
    expect(limiter.isAllowed('user2')).toBe(true);
  });

  it('should allow requests after time window expires', async () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('user3')).toBe(true);
    }

    // Should be blocked
    expect(limiter.isAllowed('user3')).toBe(false);

    // Wait for time window to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should be allowed again
    expect(limiter.isAllowed('user3')).toBe(true);
  });

  it('should calculate time until next request correctly', () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed('user4');
    }

    const timeUntilNext = limiter.getTimeUntilNext('user4');
    expect(timeUntilNext).toBeGreaterThan(0);
    expect(timeUntilNext).toBeLessThanOrEqual(1000);
  });

  it('should clear rate limit for a key', () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed('user5');
    }

    // Should be blocked
    expect(limiter.isAllowed('user5')).toBe(false);

    // Clear
    limiter.clear('user5');

    // Should be allowed again
    expect(limiter.isAllowed('user5')).toBe(true);
  });
});

describe('throttle', () => {
  it('should limit function calls', async () => {
    let callCount = 0;
    const fn = throttle(() => {
      callCount++;
    }, 100);

    // Call multiple times rapidly
    fn();
    fn();
    fn();
    fn();

    // Should only be called once immediately
    expect(callCount).toBe(1);

    // Wait for throttle period
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be callable again
    fn();
    expect(callCount).toBe(2);
  });
});

describe('debounce', () => {
  it('should delay function execution', async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 100);

    // Call multiple times rapidly
    fn();
    fn();
    fn();
    fn();

    // Should not be called yet
    expect(callCount).toBe(0);

    // Wait for debounce period
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be called once
    expect(callCount).toBe(1);
  });
});
