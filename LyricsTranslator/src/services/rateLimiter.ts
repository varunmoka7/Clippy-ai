import { RateLimitInfo, ServiceConfig } from '../types';

class RateLimiter {
  private limits: Map<string, RateLimitInfo> = new Map();
  private requestCounts: Map<string, number[]> = new Map();

  isAllowed(serviceName: string, config: ServiceConfig): boolean {
    const now = Date.now();
    const key = serviceName;
    
    // Get or create rate limit info
    let limitInfo = this.limits.get(key);
    if (!limitInfo) {
      limitInfo = {
        remaining: config.rateLimit.requests,
        resetTime: now + config.rateLimit.window,
        lastRequest: 0,
      };
      this.limits.set(key, limitInfo);
      this.requestCounts.set(key, []);
    }

    // Clean old requests outside the time window
    const requests = this.requestCounts.get(key) || [];
    const validRequests = requests.filter(timestamp => 
      now - timestamp < config.rateLimit.window
    );
    this.requestCounts.set(key, validRequests);

    // Check if we've exceeded the limit
    if (validRequests.length >= config.rateLimit.requests) {
      const oldestRequest = Math.min(...validRequests);
      limitInfo.resetTime = oldestRequest + config.rateLimit.window;
      limitInfo.remaining = 0;
      return false;
    }

    // Update counters
    limitInfo.remaining = config.rateLimit.requests - validRequests.length - 1;
    limitInfo.lastRequest = now;
    
    // Add this request
    validRequests.push(now);
    this.requestCounts.set(key, validRequests);

    return true;
  }

  recordRequest(serviceName: string): void {
    const key = serviceName;
    const limitInfo = this.limits.get(key);
    if (limitInfo && limitInfo.remaining > 0) {
      limitInfo.remaining--;
      limitInfo.lastRequest = Date.now();
    }
  }

  getRemainingRequests(serviceName: string): number {
    const limitInfo = this.limits.get(serviceName);
    return limitInfo ? limitInfo.remaining : 0;
  }

  getResetTime(serviceName: string): number {
    const limitInfo = this.limits.get(serviceName);
    return limitInfo ? limitInfo.resetTime : Date.now();
  }

  // Force reset for testing or manual override
  reset(serviceName: string): void {
    this.limits.delete(serviceName);
    this.requestCounts.delete(serviceName);
  }

  // Get time until next allowed request
  getRetryAfter(serviceName: string, config: ServiceConfig): number {
    const requests = this.requestCounts.get(serviceName) || [];
    if (requests.length < config.rateLimit.requests) {
      return 0;
    }

    const oldestRequest = Math.min(...requests);
    const resetTime = oldestRequest + config.rateLimit.window;
    return Math.max(0, resetTime - Date.now());
  }
}

export const rateLimiter = new RateLimiter();