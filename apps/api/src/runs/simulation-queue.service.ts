import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SimulationRunQueueJob } from '@sdc/shared-types';
import { ObservabilityService } from '../observability/observability.service.js';

@Injectable()
export class SimulationQueueService implements OnModuleDestroy {
  private readonly queue: Queue<SimulationRunQueueJob>;

  constructor(@Inject(ObservabilityService) private readonly observability: ObservabilityService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.queue = new Queue<SimulationRunQueueJob>('simulation-runs', {
      connection: { url: redisUrl }
    });
  }

  async enqueueSimulationRun(job: SimulationRunQueueJob): Promise<void> {
    await this.queue.add('simulate-version', job, {
      jobId: job.runId,
      attempts: 1,
      removeOnComplete: 500,
      removeOnFail: 500
    });

    await this.observability.recordJobTelemetry({
      queueName: 'simulation-runs',
      jobType: 'simulate-version',
      jobId: job.runId,
      state: 'queued',
      attempt: 0
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
