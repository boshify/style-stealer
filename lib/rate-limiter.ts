/**
 * Enhanced rate limiting with multiple strategies
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

interface RateLimitEntry {
  timestamps: number[];
  blocked: boolean;
  blockedUntil?: number;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configurations
const CONFIGS = {
  perIP: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: parseInt(process.env.RATE_LIMIT_PER_HOUR || '10'),
  },
  perApiKey: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: parseInt(process.env.RATE_LIMIT_API_KEY || '100'),
  },
  global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_GLOBAL || '50'),
  },
};

/**
 * Check if a key is rate limited
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = CONFIGS.perIP
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { timestamps: [], blocked: false };

  // Check if temporarily blocked
  if (entry.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
    };
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(
    (timestamp) => now - timestamp < config.windowMs
  );

  // Check if limit exceeded
  if (entry.timestamps.length >= config.maxRequests) {
    // Block for 5 minutes if they exceed the limit
    entry.blocked = true;
    entry.blockedUntil = now + 5 * 60 * 1000;

    rateLimitStore.set(key, entry);

    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
    };
  }

  // Add current timestamp
  entry.timestamps.push(now);
  entry.blocked = false;
  delete entry.blockedUntil;

  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetAt: now + config.windowMs,
  };
}

/**
 * Rate limit by IP address
 */
export function rateLimitByIP(ip: string) {
  return checkRateLimit(`ip:${ip}`, CONFIGS.perIP);
}

/**
 * Rate limit by API key
 */
export function rateLimitByApiKey(apiKey: string) {
  return checkRateLimit(`key:${apiKey}`, CONFIGS.perApiKey);
}

/**
 * Global rate limit (all requests combined)
 */
export function rateLimitGlobal() {
  return checkRateLimit('global', CONFIGS.global);
}

/**
 * Clean up old entries periodically
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  const maxAge = Math.max(CONFIGS.perIP.windowMs, CONFIGS.perApiKey.windowMs);

  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove if all timestamps are expired and not blocked
    const hasValidTimestamps = entry.timestamps.some(
      (timestamp) => now - timestamp < maxAge
    );
    const isBlocked = entry.blocked && entry.blockedUntil && entry.blockedUntil > now;

    if (!hasValidTimestamps && !isBlocked) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof global !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}
