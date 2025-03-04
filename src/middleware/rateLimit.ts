import { NextRequest } from 'next/server';
import Redis from 'ioredis';
import { env } from '@/env';

// Default Redis instance
const defaultRedis = new Redis(env.REDIS_URL);

/**
 * Options for configuring a rate limiter.
 */
export interface RateLimitOptions {
  /**
   * The time window for rate limiting in milliseconds.
   */
  windowMs: number;
  /**
   * The maximum number of allowed requests within the time window.
   */
  max: number;
  /**
   * A prefix for the Redis key used to track requests.
   */
  keyPrefix: string;
  /**
   * Optional custom key generator function.
   * @param request The incoming request.
   * @param customKey Optional custom key that may override the default.
   * @returns The generated key as a string.
   */
  keyGenerator?: (request: NextRequest, customKey?: string) => string;
  /**
   * Optional custom Redis instance.
   */
  redisInstance?: Redis;
}

/**
 * Retrieves the client's IP address from the request headers.
 * It attempts to get the IP from 'x-real-ip', 'x-forwarded-for', or 'x-client-ip'.
 * Returns 'unknown' if none are found.
 *
 * @param request The NextRequest object.
 * @returns The client's IP address.
 */
function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-client-ip') ||
    'unknown'
  );
}

/**
 * A class to handle rate limiting using Redis.
 */
export class RateLimiter {
  private windowMs: number;
  private max: number;
  private keyPrefix: string;
  private keyGenerator: (request: NextRequest, customKey?: string) => string;
  private redis: Redis;

  /**
   * Creates a new instance of RateLimiter.
   * @param options Configuration options for the rate limiter.
   */
  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.keyPrefix = options.keyPrefix;
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    this.redis = options.redisInstance || defaultRedis;
  }

  /**
   * Default key generator function.
   * Generates a key using the keyPrefix and the client's IP address.
   *
   * @param request The incoming request.
   * @returns The generated key.
   */
  private defaultKeyGenerator(request: NextRequest): string {
    const ip = getRequestIp(request);
    return `${this.keyPrefix}${ip}`;
  }

  /**
   * Checks whether the current request exceeds the rate limit.
   * Uses an atomic Lua script to increment the counter and set the expiration if necessary.
   *
   * @param request The NextRequest object.
   * @param customKey Optional custom key that will override the default key generation.
   * @returns An object containing the success flag, the current count, and the remaining allowed requests.
   */
  async check(request: NextRequest, customKey?: string): Promise<{ success: boolean; current: number; remaining: number }> {
    const key = this.keyGenerator(request, customKey);
    const expireSeconds = Math.ceil(this.windowMs / 1000);
    const luaScript = `
      local current = redis.call("INCR", KEYS[1])
      if tonumber(current) == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[1])
      end
      return current
    `;
    let current: number;
    try {
      current = Number(await this.redis.eval(luaScript, 1, key, expireSeconds));
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.error("Redis error during rate limit check:", err);
      }
      // In case of a Redis error, allow the request but log the error.
      return { success: true, current: 0, remaining: this.max };
    }

    return {
      success: current <= this.max,
      current,
      remaining: Math.max(this.max - current, 0)
    };
  }
}

// Registration rate limiter: 10 requests per minute per IP.
export const registerLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per IP per minute
  keyPrefix: 'rl:register:'
});

// Forgot password rate limiter: 3 requests per hour per email or IP.
export const forgotPasswordLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per email per hour
  keyPrefix: 'rl:forgot-password:',
  keyGenerator: (request: NextRequest, email?: string) => {
    const ip = getRequestIp(request);
    return `rl:forgot-password:${email || ip}`;
  }
});

// Reset password rate limiter: 5 requests per hour per token.
export const resetPasswordLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per token per hour
  keyPrefix: 'rl:reset-password:',
  keyGenerator: (request: NextRequest, token?: string) => {
    const ip = getRequestIp(request);
    return `rl:reset-password:${token || ip}`;
  }
});

// Login rate limiter: 5 failed attempts per 15 minutes per username/IP.
export const loginLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per username/IP per 15 minutes
  keyPrefix: 'rl:login:',
  keyGenerator: (request: NextRequest, username?: string) => {
    const ip = getRequestIp(request);
    return `rl:login:${ip}:${username || 'unknown'}`;
  }
});

// Password change rate limiter: 5 requests per hour per user.
export const passwordLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per user per hour
  keyPrefix: 'rl:password:',
  keyGenerator: (request: NextRequest, userId?: string) => {
    return `rl:password:${userId || 'unknown'}`;
  }
});

// Email verification rate limiter: 3 requests per day per user.
export const emailVerificationLimiter = new RateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 attempts per user per day
  keyPrefix: 'rl:email-verify:',
  keyGenerator: (request: NextRequest, userId?: string) => {
    return `rl:email-verify:${userId || 'unknown'}`;
  }
});