import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ObservabilityService } from './observability/observability.service.js';
import { AppModule } from './app.module.js';

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000';
  const origins = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

function safeObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).slice(0, 20);
}

function toSafeParamMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      continue;
    }
    output[key] = entry.length > 80 ? `${entry.slice(0, 77)}...` : entry;
  }
  return output;
}

async function bootstrap() {
  const bodyLimit = Number(process.env.API_BODY_LIMIT_BYTES || 1_048_576);
  const allowedOrigins = parseAllowedOrigins();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: Number.isFinite(bodyLimit) ? bodyLimit : 1_048_576
    })
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true
    })
  );

  const fastify = app.getHttpAdapter().getInstance();
  const observability = app.get(ObservabilityService);

  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

    const forwardedProto = request.headers['x-forwarded-proto'];
    const isHttps = request.protocol === 'https' || forwardedProto === 'https';
    if (isHttps) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    done();
  });

  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    try {
      const method = request.method.toUpperCase();
      const routePath = request.routeOptions?.url ?? request.url.split('?')[0];
      const userId =
        (request as FastifyRequest & { user?: { sub?: string } }).user?.sub ?? null;
      const ipAddress = request.ip ?? null;
      const userAgentHeader = request.headers['user-agent'];
      const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null;
      const requestId = request.id;
      const durationMs = Number.isFinite(reply.elapsedTime)
        ? Math.max(0, Math.round(reply.elapsedTime))
        : 0;

      void observability.recordRequestTelemetry({
        requestId,
        method,
        path: routePath,
        statusCode: reply.statusCode,
        durationMs,
        userId,
        ipAddress,
        userAgent,
        metadata: {
          queryKeys: safeObjectKeys(request.query),
          paramKeys: safeObjectKeys(request.params)
        }
      });

      if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        const segments = routePath.split('/').filter(Boolean);
        const resourceType = segments[0] ?? 'root';
        const params = toSafeParamMap(request.params);
        const resourceId =
          params.id ??
          params.projectId ??
          params.versionId ??
          params.runId ??
          params.gradeId ??
          params.exportId ??
          params.shareToken ??
          null;

        void observability.recordAuditLog({
          userId,
          action: `${method} ${routePath}`,
          resourceType,
          resourceId,
          statusCode: reply.statusCode,
          ipAddress,
          userAgent,
          metadata: {
            requestId,
            durationMs,
            params
          }
        });
      }
    } catch {
      // no-op: telemetry/audit must never block request completion
    }

    done();
  });

  const port = Number(process.env.API_PORT || 3001);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
