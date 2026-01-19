/**
 * Rate Limiting Utilities
 * Prevents abuse and protects Firebase quotas
 */

export class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  /**
   * Check if a request should be allowed
   * @param {string} key - Unique identifier for the rate limit (e.g., userId, action)
   * @returns {boolean} True if request should be allowed
   */
  isAllowed(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];

    // Remove old requests outside the time window
    const recentRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true;
  }

  /**
   * Get time until next request is allowed
   * @param {string} key - Unique identifier
   * @returns {number} Milliseconds until next request allowed, or 0 if allowed now
   */
  getTimeUntilNext(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);

    if (recentRequests.length < this.maxRequests) {
      return 0;
    }

    // Return time until oldest request expires
    const oldestRequest = Math.min(...recentRequests);
    return this.windowMs - (now - oldestRequest);
  }

  /**
   * Clear rate limit for a key
   * @param {string} key - Unique identifier
   */
  clear(key) {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits (useful for testing)
   */
  clearAll() {
    this.requests.clear();
  }
}

// Create rate limiters for different actions
export const predictionRateLimiter = new RateLimiter(10, 60000); // 10 predictions per minute
export const authRateLimiter = new RateLimiter(5, 60000); // 5 auth attempts per minute
export const imageSearchRateLimiter = new RateLimiter(20, 60000); // 20 image searches per minute

/**
 * Throttle function - limits how often a function can be called
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, delay) {
  let lastCall = 0;
  let timeoutId = null;

  return function throttled(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    } else {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Schedule call for when delay period ends
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function - delays function execution until after delay period
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
  let timeoutId = null;

  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
