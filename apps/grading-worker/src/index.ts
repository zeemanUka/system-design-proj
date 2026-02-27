import { Prisma, PrismaClient } from '@prisma/client';
import { evaluateDeterministicRubric } from '@sdc/grading-core';
import {
  ArchitectureComponent,
  ArchitectureEdge,
  GradeActionItem,
  GradeRunQueueJob,
  TrafficProfile,
  architectureComponentSchema,
  architectureEdgeSchema,
  defaultTrafficProfile,
  gradeCategoryScoreSchema,
  gradeRunQueueJobSchema,
  trafficProfileSchema
} from '@sdc/shared-types';
import { Worker } from 'bullmq';
import { createAiFeedbackClient } from './ai/client.js';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const aiClient = createAiFeedbackClient();

function toComponentArray(value: Prisma.JsonValue): ArchitectureComponent[] {
  const parsed = architectureComponentSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

function toEdgeArray(value: Prisma.JsonValue): ArchitectureEdge[] {
  const parsed = architectureEdgeSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

function toTrafficProfile(value: Prisma.JsonValue): TrafficProfile {
  const parsed = trafficProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultTrafficProfile;
}

function actionItemsToFeedbackRows(
  gradeReportId: string,
  actionItems: GradeActionItem[]
): Array<{
  gradeReportId: string;
  priority: string;
  title: string;
  description: string;
  evidence: Prisma.InputJsonValue;
}> {
  return actionItems.map((item) => ({
    gradeReportId,
    priority: item.priority,
    title: item.title,
    description: item.description,
    evidence: item.evidence as unknown as Prisma.InputJsonValue
  }));
}

async function failGradeReport(gradeReportId: string, message: string): Promise<void> {
  await prisma.gradeReport.update({
    where: { id: gradeReportId },
    data: {
      status: 'failed',
      failureReason: message,
      completedAt: new Date()
    }
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
    console.warn('[grading-worker] failed to write job telemetry', error);
  }
}

const worker = new Worker<GradeRunQueueJob>(
  'grading-runs',
  async (job) => {
    const parsedJob = gradeRunQueueJobSchema.safeParse(job.data);
    if (!parsedJob.success) {
      throw new Error('Invalid grading queue payload.');
    }

    const gradeReportId = parsedJob.data.gradeReportId;
    const startedAt = Date.now();
    const attempt = job.attemptsMade + 1;

    await recordJobTelemetry({
      queueName: 'grading-runs',
      jobType: 'grade-version',
      jobId: gradeReportId,
      state: 'running',
      attempt
    });

    const report = await prisma.gradeReport.findUnique({
      where: {
        id: gradeReportId
      },
      include: {
        version: true
      }
    });

    if (!report) {
      throw new Error(`Grade report ${gradeReportId} not found.`);
    }

    await prisma.gradeReport.update({
      where: {
        id: gradeReportId
      },
      data: {
        status: 'running',
        startedAt: new Date(),
        failureReason: null
      }
    });

    try {
      const components = toComponentArray(report.version.components);
      const edges = toEdgeArray(report.version.edges);
      const trafficProfile = toTrafficProfile(report.version.trafficProfile);

      const deterministic = evaluateDeterministicRubric({
        components,
        edges,
        trafficProfile,
        notes: report.version.notes
      });

      const aiFeedback = await aiClient.generateFeedback({
        overallScore: deterministic.overallScore,
        categoryScores: deterministic.categoryScores,
        strengths: deterministic.strengths,
        risks: deterministic.risks,
        deterministicNotes: deterministic.deterministicNotes,
        actionItems: deterministic.actionItems
      });

      const mergedActionItems: GradeActionItem[] = (
        aiFeedback.actionItems.length > 0 ? aiFeedback.actionItems : deterministic.actionItems
      ).map((item, index) => ({
        priority: item.priority,
        title: item.title,
        description: item.description,
        evidence: deterministic.actionItems[index]?.evidence ?? ['Derived from deterministic rubric evidence.']
      }));

      const parsedCategoryScores = gradeCategoryScoreSchema.array().parse(deterministic.categoryScores);

      await prisma.$transaction(async (tx) => {
        await tx.gradeReport.update({
          where: {
            id: gradeReportId
          },
          data: {
            status: 'completed',
            overallScore: deterministic.overallScore,
            categoryScores: parsedCategoryScores as unknown as Prisma.InputJsonValue,
            strengths: aiFeedback.strengths as unknown as Prisma.InputJsonValue,
            risks: aiFeedback.risks as unknown as Prisma.InputJsonValue,
            deterministicNotes: deterministic.deterministicNotes as unknown as Prisma.InputJsonValue,
            actionItems: mergedActionItems as unknown as Prisma.InputJsonValue,
            summary: aiFeedback.summary,
            aiProvider: aiFeedback.provider,
            aiModel: aiFeedback.model,
            completedAt: new Date(),
            failureReason: null
          }
        });

        await tx.feedbackItem.deleteMany({
          where: {
            gradeReportId
          }
        });

        const rows = actionItemsToFeedbackRows(gradeReportId, mergedActionItems);
        if (rows.length > 0) {
          await tx.feedbackItem.createMany({
            data: rows
          });
        }
      });

      await recordJobTelemetry({
        queueName: 'grading-runs',
        jobType: 'grade-version',
        jobId: gradeReportId,
        state: 'completed',
        attempt,
        durationMs: Date.now() - startedAt,
        metadata: {
          score: deterministic.overallScore,
          actionCount: mergedActionItems.length
        }
      });

      return {
        gradeReportId,
        status: 'completed',
        score: deterministic.overallScore
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected grading worker failure.';
      await failGradeReport(gradeReportId, message);
      await recordJobTelemetry({
        queueName: 'grading-runs',
        jobType: 'grade-version',
        jobId: gradeReportId,
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
  console.log(`[grading-worker] listening on queue grading-runs via ${redisUrl}`);
});

worker.on('failed', (job, error) => {
  console.error('[grading-worker] job failed', job?.id, error.message);
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
