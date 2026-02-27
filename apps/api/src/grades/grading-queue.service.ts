import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { GradeRunQueueJob } from '@sdc/shared-types';
import { Queue } from 'bullmq';
import { ObservabilityService } from '../observability/observability.service.js';

@Injectable()
export class GradingQueueService implements OnModuleDestroy {
  private readonly queue: Queue<GradeRunQueueJob>;

  constructor(@Inject(ObservabilityService) private readonly observability: ObservabilityService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.queue = new Queue<GradeRunQueueJob>('grading-runs', {
      connection: {
        url: redisUrl
      }
    });
  }

  async enqueueGradeRun(job: GradeRunQueueJob): Promise<void> {
    await this.queue.add('grade-version', job, {
      jobId: job.gradeReportId,
      attempts: 1,
      removeOnComplete: 500,
      removeOnFail: 500
    });

    await this.observability.recordJobTelemetry({
      queueName: 'grading-runs',
      jobType: 'grade-version',
      jobId: job.gradeReportId,
      state: 'queued',
      attempt: 0
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
