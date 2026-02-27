import { CanActivate, ExecutionContext, HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

type BucketState = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, BucketState>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly authWindowMs: number;
  private readonly authMaxRequests: number;
  private cleanupCounter = 0;

  constructor() {
    this.windowMs = this.parseEnv('RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000);
    this.maxRequests = this.parseEnv('RATE_LIMIT_MAX_REQUESTS', 120, 1, 10_000);
    this.authWindowMs = this.parseEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000);
    this.authMaxRequests = this.parseEnv('AUTH_RATE_LIMIT_MAX_REQUESTS', 12, 1, 1_000);
  }

  canActivate(context: ExecutionContext): boolean {
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
    const key = `${isAuthRoute ? 'auth' : 'global'}:${ip}`;

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

  private cleanupExpiredBuckets(now: number): void {
    for (const [key, value] of this.buckets.entries()) {
      if (value.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private parseEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(raw)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(raw)));
  }
}
