import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GradeReport,
  GradeReportResponse,
  gradeActionItemSchema,
  gradeCategoryScoreSchema,
  gradeReportStatusSchema
} from '@sdc/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import { GradingQueueService } from './grading-queue.service.js';

type GradeReportRecord = Prisma.GradeReportGetPayload<{
  include: {
    project: {
      select: {
        userId: true;
      };
    };
    feedbackItems: true;
  };
}>;

@Injectable()
export class GradesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GradingQueueService) private readonly gradingQueue: GradingQueueService
  ) {}

  async queueGradeReport(userId: string, versionId: string): Promise<GradeReportResponse> {
    const version = await this.prisma.architectureVersion.findUnique({
      where: { id: versionId },
      include: {
        project: {
          select: {
            id: true,
            userId: true
          }
        }
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found.');
    }

    if (version.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this version.');
    }

    const createdReport = await this.prisma.gradeReport.create({
      data: {
        projectId: version.projectId,
        versionId: version.id,
        status: 'pending'
      },
      include: {
        project: {
          select: {
            userId: true
          }
        },
        feedbackItems: true
      }
    });

    try {
      await this.gradingQueue.enqueueGradeRun({ gradeReportId: createdReport.id });
    } catch {
      const failed = await this.prisma.gradeReport.update({
        where: { id: createdReport.id },
        data: {
          status: 'failed',
          failureReason: 'Failed to enqueue grading job.',
          completedAt: new Date()
        },
        include: {
          project: {
            select: {
              userId: true
            }
          },
          feedbackItems: true
        }
      });

      return {
        report: this.toGradeReport(failed)
      };
    }

    return {
      report: this.toGradeReport(createdReport)
    };
  }

  async getGradeReport(userId: string, gradeReportId: string): Promise<GradeReportResponse> {
    const report = await this.prisma.gradeReport.findUnique({
      where: {
        id: gradeReportId
      },
      include: {
        project: {
          select: {
            userId: true
          }
        },
        feedbackItems: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!report) {
      throw new NotFoundException('Grade report not found.');
    }

    if (report.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this report.');
    }

    return {
      report: this.toGradeReport(report)
    };
  }

  private toGradeReport(report: GradeReportRecord): GradeReport {
    const status = gradeReportStatusSchema.safeParse(report.status);
    const categoryScores = gradeCategoryScoreSchema.array().safeParse(report.categoryScores);
    const actionItems = gradeActionItemSchema.array().safeParse(report.actionItems);
    const strengths = this.parseStringArray(report.strengths);
    const risks = this.parseStringArray(report.risks);
    const deterministicNotes = this.parseStringArray(report.deterministicNotes);

    const feedbackActionItems = report.feedbackItems.map((item) => ({
      priority: item.priority === 'P0' || item.priority === 'P1' || item.priority === 'P2' ? item.priority : 'P2',
      title: item.title,
      description: item.description,
      evidence: this.parseStringArray(item.evidence)
    })) as GradeReport['actionItems'];

    return {
      id: report.id,
      projectId: report.projectId,
      versionId: report.versionId,
      status: status.success ? status.data : 'failed',
      overallScore: report.overallScore,
      summary: report.summary,
      strengths,
      risks,
      deterministicNotes,
      categoryScores: categoryScores.success ? categoryScores.data : [],
      actionItems: actionItems.success ? actionItems.data : feedbackActionItems,
      aiProvider: report.aiProvider,
      aiModel: report.aiModel,
      failureReason: report.failureReason,
      queuedAt: report.queuedAt.toISOString(),
      startedAt: report.startedAt ? report.startedAt.toISOString() : null,
      completedAt: report.completedAt ? report.completedAt.toISOString() : null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString()
    };
  }

  private parseStringArray(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
}
