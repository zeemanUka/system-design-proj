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
  const retentionDays = toPositiveInt(process.env.STAGE10_RETENTION_DAYS, 90);
  const inviteRetentionDays = toPositiveInt(process.env.STAGE10_INVITE_RETENTION_DAYS, 30);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const inviteCutoff = new Date(Date.now() - inviteRetentionDays * 24 * 60 * 60 * 1000);

  const expiredInviteUpdate = await prisma.projectInvite.updateMany({
    where: {
      status: 'pending',
      expiresAt: {
        lt: new Date()
      }
    },
    data: {
      status: 'expired'
    }
  });

  const [requestTelemetry, jobTelemetry, auditLog, oldInvites, resolvedComments] = await Promise.all([
    prisma.requestTelemetry.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    }),
    prisma.jobTelemetry.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    }),
    prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    }),
    prisma.projectInvite.deleteMany({
      where: {
        status: {
          in: ['accepted', 'revoked', 'expired']
        },
        updatedAt: {
          lt: inviteCutoff
        }
      }
    }),
    prisma.versionComment.deleteMany({
      where: {
        status: 'resolved',
        updatedAt: {
          lt: cutoff
        }
      }
    })
  ]);

  console.log(`Retention run complete.
- expired invites updated: ${expiredInviteUpdate.count}
- request telemetry deleted: ${requestTelemetry.count}
- job telemetry deleted: ${jobTelemetry.count}
- audit log deleted: ${auditLog.count}
- historical invites deleted: ${oldInvites.count}
- resolved comments deleted: ${resolvedComments.count}`);
}

run()
  .catch((error) => {
    console.error(`Retention job failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
