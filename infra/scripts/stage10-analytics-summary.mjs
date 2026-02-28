#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toPositiveInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.floor(numeric);
}

async function run() {
  const lookbackDays = toPositiveInt(process.env.STAGE10_ANALYTICS_LOOKBACK_DAYS, 7);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const [
    newUsers,
    activatedUsers,
    startedProjects,
    completedRuns,
    failedRuns,
    completedGrades,
    failedGrades
  ] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: {
          gte: since
        }
      }
    }),
    prisma.user.count({
      where: {
        onboardingCompleted: true,
        updatedAt: {
          gte: since
        }
      }
    }),
    prisma.project.count({
      where: {
        createdAt: {
          gte: since
        }
      }
    }),
    prisma.simulationRun.count({
      where: {
        status: 'completed',
        createdAt: {
          gte: since
        }
      }
    }),
    prisma.simulationRun.count({
      where: {
        status: 'failed',
        createdAt: {
          gte: since
        }
      }
    }),
    prisma.gradeReport.count({
      where: {
        status: 'completed',
        createdAt: {
          gte: since
        }
      }
    }),
    prisma.gradeReport.count({
      where: {
        status: 'failed',
        createdAt: {
          gte: since
        }
      }
    })
  ]);

  const regradeCadence = await prisma.gradeReport.groupBy({
    by: ['projectId'],
    where: {
      createdAt: {
        gte: since
      }
    },
    _count: {
      projectId: true
    }
  });

  const averageRegradesPerProject =
    regradeCadence.length === 0
      ? 0
      : regradeCadence.reduce((sum, entry) => sum + entry._count.projectId, 0) / regradeCadence.length;

  const failedRunSamples = await prisma.simulationRun.findMany({
    where: {
      status: 'failed',
      createdAt: {
        gte: since
      }
    },
    select: {
      id: true,
      failureReason: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  const activationRate = newUsers === 0 ? 0 : (activatedUsers / newUsers) * 100;
  const runFailureRate = completedRuns + failedRuns === 0 ? 0 : (failedRuns / (completedRuns + failedRuns)) * 100;
  const gradeFailureRate =
    completedGrades + failedGrades === 0 ? 0 : (failedGrades / (completedGrades + failedGrades)) * 100;

  console.log(`Stage 10 Analytics Summary (last ${lookbackDays} days)
- new users: ${newUsers}
- activated users: ${activatedUsers}
- activation rate: ${activationRate.toFixed(2)}%
- projects started: ${startedProjects}
- completed runs: ${completedRuns}
- failed runs: ${failedRuns} (${runFailureRate.toFixed(2)}%)
- completed grades: ${completedGrades}
- failed grades: ${failedGrades} (${gradeFailureRate.toFixed(2)}%)
- avg regrades/project: ${averageRegradesPerProject.toFixed(2)}

Failed run samples:`);

  if (failedRunSamples.length === 0) {
    console.log('- none');
  } else {
    for (const sample of failedRunSamples) {
      console.log(`- ${sample.id} (${sample.createdAt.toISOString()}): ${sample.failureReason ?? 'unknown error'}`);
    }
  }
}

run()
  .catch((error) => {
    console.error(`Analytics summary failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
