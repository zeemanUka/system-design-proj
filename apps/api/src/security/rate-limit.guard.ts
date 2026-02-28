import { CanActivate, ExecutionContext, HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';

type BucketState = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, BucketState>();
  private readonly redisPrefix: string;
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly authWindowMs: number;
  private readonly authMaxRequests: number;
  private readonly redisClient: Redis | null;
  private cleanupCounter = 0;

  constructor() {
    this.redisPrefix = process.env.RATE_LIMIT_REDIS_PREFIX?.trim() || 'sdc:ratelimit';
    this.windowMs = this.parseEnv('RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000);
    this.maxRequests = this.parseEnv('RATE_LIMIT_MAX_REQUESTS', 120, 1, 10_000);
    this.authWindowMs = this.parseEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000);
    this.authMaxRequests = this.parseEnv('AUTH_RATE_LIMIT_MAX_REQUESTS', 12, 1, 1_000);
    this.redisClient = this.createRedisClient();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const path = request.url.split('?')[0];
    const now = Date.now();
    const isAuthRoute = path === '/auth/login' || path === '/auth/signup';
    const windowMs = isAuthRoute ? this.authWindowMs : this.windowMs;
    const maxRequests = isAuthRoute ? this.authMaxRequests : this.maxRequests;
    const ip = request.ip ?? 'unknown-ip';
    const scope = isAuthRoute ? 'auth' : 'global';
    const key = ip;
    const bucket = await this.incrementBucket(key, scope, now, windowMs);
    const remaining = Math.max(0, maxRequests - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    reply.header('X-RateLimit-Limit', String(maxRequests));
    reply.header('X-RateLimit-Remaining', String(remaining));
    reply.header('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));

    this.cleanupCounter += 1;
    if (this.cleanupCounter % 200 === 0) {
      this.cleanupExpiredBuckets(now);
    }

    if (bucket.count > maxRequests) {
      reply.header('Retry-After', String(retryAfterSeconds));
      throw new HttpException('Rate limit exceeded. Please retry later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private async incrementBucket(
    key: string,
    scope: string,
    now: number,
    windowMs: number
  ): Promise<BucketState> {
    const redisBucket = await this.incrementRedisBucket(key, scope, now, windowMs);
    if (redisBucket) {
      return redisBucket;
    }

    return this.incrementInMemoryBucket(`${scope}:${key}`, now, windowMs);
  }

  private async incrementRedisBucket(
    key: string,
    scope: string,
    now: number,
    windowMs: number
  ): Promise<BucketState | null> {
    if (!this.redisClient) {
      return null;
    }

    const windowStart = Math.floor(now / windowMs) * windowMs;
    const redisKey = `${this.redisPrefix}:${scope}:${key}:${windowStart}`;

    try {
      const count = await this.redisClient.incr(redisKey);
      if (count === 1) {
        await this.redisClient.pexpire(redisKey, windowMs);
      }

      const ttlMs = await this.redisClient.pttl(redisKey);
      const effectiveTtlMs = ttlMs > 0 ? ttlMs : windowMs;

      return {
        count,
        resetAt: now + effectiveTtlMs
      };
    } catch {
      return null;
    }
  }

  private incrementInMemoryBucket(key: string, now: number, windowMs: number): BucketState {
    const existingBucket = this.buckets.get(key);
    const bucket =
      !existingBucket || existingBucket.resetAt <= now
        ? {
            count: 0,
            resetAt: now + windowMs
          }
        : existingBucket;

    bucket.count += 1;
    this.buckets.set(key, bucket);
    return bucket;
  }

  private cleanupExpiredBuckets(now: number): void {
    for (const [key, value] of this.buckets.entries()) {
      if (value.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private createRedisClient(): Redis | null {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      return null;
    }

    return new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }

  private parseEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(raw)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(raw)));
  }
}
