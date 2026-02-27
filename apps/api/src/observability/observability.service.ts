import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

type RequestTelemetryInput = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
};

type AuditLogInput = {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
};

type JobTelemetryInput = {
  queueName: string;
  jobType: string;
  jobId: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  attempt?: number;
  durationMs?: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly requestTelemetrySampleRate: number;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    const raw = Number(process.env.REQUEST_TELEMETRY_SAMPLE_RATE ?? 1);
    if (!Number.isFinite(raw)) {
      this.requestTelemetrySampleRate = 1;
    } else {
      this.requestTelemetrySampleRate = Math.max(0, Math.min(1, raw));
    }
  }

  async recordRequestTelemetry(input: RequestTelemetryInput): Promise<void> {
    if (!this.shouldSampleRequestTelemetry()) {
      return;
    }

    try {
      await this.prisma.requestTelemetry.create({
        data: {
          requestId: input.requestId,
          method: input.method,
          path: input.path,
          statusCode: input.statusCode,
          durationMs: input.durationMs,
          userId: input.userId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist request telemetry for ${input.method} ${input.path}: ${this.errorMessage(error)}`
      );
    }
  }

  async recordAuditLog(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          statusCode: input.statusCode,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to persist audit log ${input.action}: ${this.errorMessage(error)}`);
    }
  }

  async recordJobTelemetry(input: JobTelemetryInput): Promise<void> {
    try {
      await this.prisma.jobTelemetry.create({
        data: {
          queueName: input.queueName,
          jobType: input.jobType,
          jobId: input.jobId,
          state: input.state,
          attempt: input.attempt ?? 0,
          durationMs: input.durationMs ?? null,
          errorMessage: input.errorMessage ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist job telemetry for ${input.queueName}/${input.jobId}: ${this.errorMessage(error)}`
      );
    }
  }

  private shouldSampleRequestTelemetry(): boolean {
    if (this.requestTelemetrySampleRate >= 1) {
      return true;
    }
    if (this.requestTelemetrySampleRate <= 0) {
      return false;
    }
    return Math.random() <= this.requestTelemetrySampleRate;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
