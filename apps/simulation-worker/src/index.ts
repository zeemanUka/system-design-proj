import { Prisma, PrismaClient } from '@prisma/client';
import { applyFailureInjection, deriveBlastRadiusSummary, runArchitectureSimulation } from '@sdc/simulation-core';
import {
  SimulationRunQueueJob,
  failureInjectionProfileSchema,
  simulationComputationResultSchema,
  simulationInputContractSchema,
  simulationRunQueueJobSchema
} from '@sdc/shared-types';
import { Worker } from 'bullmq';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function nextEventSequence(runId: string): Promise<number> {
  return prisma.simulationRunEvent.count({
    where: { runId }
  });
}

async function appendRunEvent(
  runId: string,
  event: {
    atSecond: number;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    componentId?: string | null;
  }
): Promise<void> {
  const sequence = await nextEventSequence(runId);
  await prisma.simulationRunEvent.create({
    data: {
      runId,
      sequence,
      atSecond: event.atSecond,
      severity: event.severity,
      title: event.title,
      description: event.description,
      componentId: event.componentId ?? null
    }
  });
}

async function markRunFailed(runId: string, message: string): Promise<void> {
  await prisma.simulationRun.update({
    where: { id: runId },
    data: {
      status: 'failed',
      failureReason: message,
      completedAt: new Date()
    }
  });

  await appendRunEvent(runId, {
    atSecond: 0,
    severity: 'critical',
    title: 'Run failed',
    description: message,
    componentId: null
  });
}

async function recordJobTelemetry(
  input: {
    queueName: string;
    jobType: string;
    jobId: string;
    state: 'running' | 'completed' | 'failed';
    attempt: number;
    durationMs?: number;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await prisma.jobTelemetry.create({
      data: {
        queueName: input.queueName,
        jobType: input.jobType,
        jobId: input.jobId,
        state: input.state,
        attempt: input.attempt,
        durationMs: input.durationMs ?? null,
        errorMessage: input.errorMessage ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
      }
    });
  } catch (error) {
    console.warn('[simulation-worker] failed to write job telemetry', error);
  }
}

const worker = new Worker<SimulationRunQueueJob>(
  'simulation-runs',
  async (job) => {
    const parsedJob = simulationRunQueueJobSchema.safeParse(job.data);
    if (!parsedJob.success) {
      throw new Error('Invalid simulation queue payload.');
    }

    const runId = parsedJob.data.runId;
    const startedAt = Date.now();
    const attempt = job.attemptsMade + 1;

    await recordJobTelemetry({
      queueName: 'simulation-runs',
      jobType: 'simulate-version',
      jobId: runId,
      state: 'running',
      attempt
    });

    const run = await prisma.simulationRun.findUnique({
      where: { id: runId }
    });

    if (!run) {
      throw new Error(`Run ${runId} not found.`);
    }

    await prisma.simulationRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
        failureReason: null
      }
    });

    await appendRunEvent(runId, {
      atSecond: 0,
      severity: 'info',
      title: 'Run started',
      description: 'Simulation worker started processing this run.',
      componentId: null
    });

    try {
      const parsedInput = simulationInputContractSchema.safeParse(run.inputContract);
      if (!parsedInput.success) {
        throw new Error('Simulation input contract is invalid.');
      }

      const failureProfile = failureInjectionProfileSchema.safeParse(run.failureProfile);
      const runtimeInput = failureProfile.success
        ? applyFailureInjection(parsedInput.data, failureProfile.data).input
        : parsedInput.data;

      if (failureProfile.success) {
        await appendRunEvent(runId, {
          atSecond: 1,
          severity: 'warning',
          title: 'Failure profile applied',
          description: `Applied ${failureProfile.data.mode} before simulation execution.`,
          componentId: failureProfile.data.targetComponentId ?? null
        });
      }

      const computationResult = runArchitectureSimulation(runtimeInput);
      const parsedResult = simulationComputationResultSchema.parse(computationResult);
      const blastRadius = failureProfile.success
        ? deriveBlastRadiusSummary(failureProfile.data, parsedResult)
        : null;

      const baseSequence = await nextEventSequence(runId);
      const timelineEvents = parsedResult.timeline.map((event, index) => ({
        runId,
        sequence: baseSequence + index,
        atSecond: event.atSecond,
        severity: event.severity,
        title: event.title,
        description: event.description,
        componentId: event.componentId
      }));

      await prisma.$transaction([
        prisma.simulationRun.update({
          where: { id: runId },
          data: {
            status: 'completed',
            metrics: parsedResult.metrics as unknown as Prisma.InputJsonValue,
            bottlenecks: parsedResult.bottlenecks as unknown as Prisma.InputJsonValue,
            blastRadius: blastRadius ? (blastRadius as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            completedAt: new Date(),
            failureReason: null
          }
        }),
        prisma.simulationRunEvent.createMany({
          data: timelineEvents
        })
      ]);

      await recordJobTelemetry({
        queueName: 'simulation-runs',
        jobType: 'simulate-version',
        jobId: runId,
        state: 'completed',
        attempt,
        durationMs: Date.now() - startedAt,
        metadata: {
          timelineCount: timelineEvents.length,
          bottleneckCount: parsedResult.bottlenecks.length
        }
      });

      return {
        runId,
        status: 'completed',
        timelineCount: timelineEvents.length
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected simulation worker failure.';
      await markRunFailed(runId, message);
      await recordJobTelemetry({
        queueName: 'simulation-runs',
        jobType: 'simulate-version',
        jobId: runId,
        state: 'failed',
        attempt,
        durationMs: Date.now() - startedAt,
        errorMessage: message
      });
      throw error;
    }
  },
  {
    connection: {
      url: redisUrl
    },
    concurrency: 2
  }
);

worker.on('ready', () => {
  console.log(`[simulation-worker] listening on queue simulation-runs via ${redisUrl}`);
});

worker.on('failed', (job, error) => {
  console.error('[simulation-worker] job failed', job?.id, error.message);
});

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
