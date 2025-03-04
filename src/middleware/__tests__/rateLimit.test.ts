import { NextRequest } from 'next/server';
import { RateLimiter } from '@/middleware/rateLimit';
import Redis from 'ioredis';

describe('RateLimiter', () => {
  let redisMock: Partial<Redis>;
  let rateLimiter: RateLimiter;
  let fakeRequest: NextRequest;

  beforeEach(() => {
    // Create a mock Redis instance that includes the eval method.
    redisMock = {
      eval: jest.fn()
    };

    // Construct a fake NextRequest object that returns a fixed IP.
    fakeRequest = {
      headers: {
        get: jest.fn().mockImplementation((headerName: string) => {
          if (headerName === 'x-real-ip') return '127.0.0.1';
          return null;
        })
      }
    } as unknown as NextRequest;
  });

  test('defaultKeyGenerator returns expected key', async () => {
    rateLimiter = new RateLimiter({
      windowMs: 60000,
      max: 10,
      keyPrefix: 'rl:default:',
      redisInstance: redisMock as Redis
    });

    // Simulate redis.eval returning 1 (first call).
    (redisMock.eval as jest.Mock).mockResolvedValue(1);

    await rateLimiter.check(fakeRequest);
    // Verify that the default key generator correctly combines the keyPrefix and request IP.
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("INCR", KEYS[1])'),
      1,
      'rl:default:127.0.0.1',
      Math.ceil(60000 / 1000)
    );
  });

  test('custom key generator returns expected key', async () => {
    const customKeyGen = jest.fn((req: NextRequest, customKey?: string) => {
      return customKey ? `custom:${customKey}` : 'custom:default';
    });

    rateLimiter = new RateLimiter({
      windowMs: 60000,
      max: 10,
      keyPrefix: 'unused:', // Unused since a custom generator is provided.
      keyGenerator: customKeyGen,
      redisInstance: redisMock as Redis
    });

    (redisMock.eval as jest.Mock).mockResolvedValue(1);

    // Invoke the check method with a custom key.
    await rateLimiter.check(fakeRequest, 'testKey');
    expect(customKeyGen).toHaveBeenCalledWith(fakeRequest, 'testKey');
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'custom:testKey',
      Math.ceil(60000 / 1000)
    );
  });

  test('check returns correct values when under limit and sets expire on first hit', async () => {
    const max = 5;
    rateLimiter = new RateLimiter({
      windowMs: 60000, // 60 seconds
      max,
      keyPrefix: 'rl:test:',
      redisInstance: redisMock as Redis
    });

    // Simulate redis.eval returning 1 (first access).
    (redisMock.eval as jest.Mock).mockResolvedValue(1);

    const result = await rateLimiter.check(fakeRequest);
    expect(result.success).toBe(true);
    expect(result.current).toBe(1);
    expect(result.remaining).toBe(max - 1);
  });

  test('check returns success true when count equals max', async () => {
    const max = 3;
    rateLimiter = new RateLimiter({
      windowMs: 60000,
      max,
      keyPrefix: 'rl:test:',
      redisInstance: redisMock as Redis
    });

    // Simulate redis.eval returning exactly max.
    (redisMock.eval as jest.Mock).mockResolvedValue(max);

    const result = await rateLimiter.check(fakeRequest);
    expect(result.success).toBe(true);
    expect(result.current).toBe(max);
    expect(result.remaining).toBe(0);
  });

  test('check returns success false when count exceeds max', async () => {
    const max = 3;
    rateLimiter = new RateLimiter({
      windowMs: 60000,
      max,
      keyPrefix: 'rl:test:',
      redisInstance: redisMock as Redis
    });

    // Simulate redis.eval returning a value greater than max.
    (redisMock.eval as jest.Mock).mockResolvedValue(4);

    const result = await rateLimiter.check(fakeRequest);
    expect(result.success).toBe(false);
    expect(result.current).toBe(4);
    expect(result.remaining).toBe(0);
  });

  test('check returns default values when redis.eval fails', async () => {
    const max = 3;
    rateLimiter = new RateLimiter({
      windowMs: 60000,
      max,
      keyPrefix: 'rl:test:',
      redisInstance: redisMock as Redis
    });

    // Simulate redis.eval throwing an error.
    (redisMock.eval as jest.Mock).mockRejectedValue(new Error('Redis failure'));

    const result = await rateLimiter.check(fakeRequest);
    // In case of a Redis error, the rate limiter should allow the request.
    expect(result.success).toBe(true);
    expect(result.current).toBe(0);
    expect(result.remaining).toBe(max);
  });
});
