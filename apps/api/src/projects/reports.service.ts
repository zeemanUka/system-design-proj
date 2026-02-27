import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  ArchitectureComponent,
  ArchitectureEdge,
  CompareVersionRunSnapshot,
  CompareMetricDelta,
  CompareRubricDelta,
  GradeActionItem,
  ProjectReport,
  ProjectReportResponse,
  ReportExport,
  ReportExportResponse,
  ReportShareResponse,
  SharedReportResponse,
  TrafficProfile,
  VersionCompareResponse,
  VersionCompareResult,
  architectureComponentSchema,
  architectureEdgeSchema,
  compareMetricDeltaSchema,
  defaultTrafficProfile,
  gradeActionItemSchema,
  gradeCategorySchema,
  gradeCategoryScoreSchema,
  projectReportSchema,
  reportSummarySchema,
  trafficProfileSchema,
  validateArchitectureTopology
} from '@sdc/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

type VersionRecord = Prisma.ArchitectureVersionGetPayload<{
  select: {
    id: true;
    projectId: true;
    versionNumber: true;
    notes: true;
    components: true;
    edges: true;
    trafficProfile: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

type CompletedRunRecord = Prisma.SimulationRunGetPayload<{
  select: {
    id: true;
    status: true;
    metrics: true;
    bottlenecks: true;
    completedAt: true;
  };
}>;

type CompletedGradeRecord = Prisma.GradeReportGetPayload<{
  include: {
    feedbackItems: {
      orderBy: {
        createdAt: 'asc';
      };
    };
  };
}>;

type ReportExportRow = {
  id: string;
  projectId: string;
  baselineVersionId: string;
  candidateVersionId: string;
  format: string;
  fileName: string;
  reportSnapshot: Prisma.JsonValue;
  shareToken: string | null;
  shareRevokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getVersionCompare(
    userId: string,
    projectId: string,
    baselineVersionId: string,
    candidateVersionId: string
  ): Promise<VersionCompareResponse> {
    await this.assertProjectOwnership(userId, projectId);

    if (baselineVersionId === candidateVersionId) {
      throw new BadRequestException('baselineVersionId and candidateVersionId must be different.');
    }

    const [baselineVersion, candidateVersion] = await Promise.all([
      this.getVersionById(projectId, baselineVersionId),
      this.getVersionById(projectId, candidateVersionId)
    ]);

    return {
      compare: await this.buildCompareResult(projectId, baselineVersion, candidateVersion)
    };
  }

  async getProjectReport(
    userId: string,
    projectId: string,
    baselineVersionId?: string,
    candidateVersionId?: string
  ): Promise<ProjectReportResponse> {
    await this.assertProjectOwnership(userId, projectId);

    const { baselineVersion, candidateVersion } = await this.resolveReportVersions(
      projectId,
      baselineVersionId,
      candidateVersionId
    );
    const compare = await this.buildCompareResult(projectId, baselineVersion, candidateVersion);

    return {
      report: this.buildReport(projectId, compare)
    };
  }

  async createReportExport(
    userId: string,
    projectId: string,
    baselineVersionId?: string,
    candidateVersionId?: string
  ): Promise<ReportExportResponse> {
    const reportResponse = await this.getProjectReport(
      userId,
      projectId,
      baselineVersionId,
      candidateVersionId
    );

    const report = reportResponse.report;
    const fileName = `system-design-report-v${report.compare.baselineVersion.versionNumber}-v${report.compare.candidateVersion.versionNumber}.pdf`;

    const createdExport = await this.prisma.reportExport.create({
      data: {
        projectId,
        baselineVersionId: report.baselineVersionId,
        candidateVersionId: report.candidateVersionId,
        format: 'pdf',
        fileName,
        reportSnapshot: report as unknown as Prisma.InputJsonValue
      }
    });

    return {
      export: this.toReportExport(createdExport, false),
      report
    };
  }

  async downloadProjectReportPdf(
    userId: string,
    projectId: string,
    exportId: string
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const exportRecord = await this.prisma.reportExport.findFirst({
      where: {
        id: exportId,
        projectId
      },
      include: {
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!exportRecord) {
      throw new NotFoundException('Report export not found.');
    }

    if (exportRecord.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this report export.');
    }

    const report = this.parseStoredReport(exportRecord.reportSnapshot);
    return {
      fileName: exportRecord.fileName,
      buffer: this.renderReportPdf(report)
    };
  }

  async createReportShare(
    userId: string,
    projectId: string,
    exportId: string
  ): Promise<ReportShareResponse> {
    const existingExport = await this.prisma.reportExport.findUnique({
      where: {
        id: exportId
      },
      include: {
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!existingExport || existingExport.projectId !== projectId) {
      throw new NotFoundException('Report export not found for this project.');
    }

    if (existingExport.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this report export.');
    }

    const shareToken = await this.createUniqueShareToken();
    const updatedExport = await this.prisma.reportExport.update({
      where: { id: existingExport.id },
      data: {
        shareToken,
        shareRevokedAt: null
      }
    });

    return {
      export: this.toReportExport(updatedExport, false),
      report: this.parseStoredReport(updatedExport.reportSnapshot)
    };
  }

  async revokeReportShare(
    userId: string,
    projectId: string,
    shareToken: string
  ): Promise<ReportShareResponse> {
    const existingExport = await this.prisma.reportExport.findFirst({
      where: {
        shareToken
      },
      include: {
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!existingExport || existingExport.projectId !== projectId) {
      throw new NotFoundException('Share token not found for this project.');
    }

    if (existingExport.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this shared report.');
    }

    const updatedExport = await this.prisma.reportExport.update({
      where: {
        id: existingExport.id
      },
      data: {
        shareRevokedAt: new Date()
      }
    });

    return {
      export: this.toReportExport(updatedExport, false),
      report: this.parseStoredReport(updatedExport.reportSnapshot)
    };
  }

  async getSharedReport(shareToken: string): Promise<SharedReportResponse> {
    const exportRecord = await this.prisma.reportExport.findFirst({
      where: {
        shareToken
      }
    });

    if (!exportRecord || exportRecord.shareRevokedAt) {
      throw new NotFoundException('Shared report was not found or has been revoked.');
    }

    return {
      export: this.toReportExport(exportRecord, true),
      report: this.parseStoredReport(exportRecord.reportSnapshot)
    };
  }

  async downloadSharedReportPdf(shareToken: string): Promise<{ buffer: Buffer; fileName: string }> {
    const exportRecord = await this.prisma.reportExport.findFirst({
      where: {
        shareToken
      }
    });

    if (!exportRecord || exportRecord.shareRevokedAt) {
      throw new NotFoundException('Shared report was not found or has been revoked.');
    }

    return {
      fileName: exportRecord.fileName,
      buffer: this.renderReportPdf(this.parseStoredReport(exportRecord.reportSnapshot))
    };
  }

  private async buildCompareResult(
    projectId: string,
    baselineVersion: VersionRecord,
    candidateVersion: VersionRecord
  ): Promise<VersionCompareResult> {
    const [baselineRun, candidateRun, baselineGrade, candidateGrade] = await Promise.all([
      this.getLatestCompletedRun(projectId, baselineVersion.id),
      this.getLatestCompletedRun(projectId, candidateVersion.id),
      this.getLatestCompletedGrade(projectId, baselineVersion.id),
      this.getLatestCompletedGrade(projectId, candidateVersion.id)
    ]);

    const baselineComponents = this.toComponentArray(baselineVersion.components);
    const candidateComponents = this.toComponentArray(candidateVersion.components);
    const baselineEdges = this.toEdgeArray(baselineVersion.edges);
    const candidateEdges = this.toEdgeArray(candidateVersion.edges);

    const baselineWarnings = validateArchitectureTopology(baselineComponents, baselineEdges);
    const candidateWarnings = validateArchitectureTopology(candidateComponents, candidateEdges);

    const baselineCategoryScores = this.getGradeCategoryScores(baselineGrade?.categoryScores ?? null);
    const candidateCategoryScores = this.getGradeCategoryScores(candidateGrade?.categoryScores ?? null);

    const baselineCategoryMap = new Map(
      baselineCategoryScores.map((categoryScore) => [categoryScore.category, categoryScore])
    );
    const candidateCategoryMap = new Map(
      candidateCategoryScores.map((categoryScore) => [categoryScore.category, categoryScore])
    );

    const baselineComponentMap = new Map(baselineComponents.map((component) => [component.id, component]));
    const candidateComponentMap = new Map(candidateComponents.map((component) => [component.id, component]));

    const baselineEdgeKeys = new Set(baselineEdges.map((edge) => `${edge.sourceId}->${edge.targetId}`));
    const candidateEdgeKeys = new Set(candidateEdges.map((edge) => `${edge.sourceId}->${edge.targetId}`));

    const addedComponents = candidateComponents
      .filter((component) => !baselineComponentMap.has(component.id))
      .map((component) => ({
        id: component.id,
        label: component.label,
        type: component.type
      }));

    const removedComponents = baselineComponents
      .filter((component) => !candidateComponentMap.has(component.id))
      .map((component) => ({
        id: component.id,
        label: component.label,
        type: component.type
      }));

    const addedConnections = candidateEdges
      .filter((edge) => !baselineEdgeKeys.has(`${edge.sourceId}->${edge.targetId}`))
      .map((edge) => this.edgeDisplay(edge, candidateComponentMap));

    const removedConnections = baselineEdges
      .filter((edge) => !candidateEdgeKeys.has(`${edge.sourceId}->${edge.targetId}`))
      .map((edge) => this.edgeDisplay(edge, baselineComponentMap));

    const rubricDeltas: CompareRubricDelta[] = gradeCategorySchema.options.map((category) => {
      const baseline = baselineCategoryMap.get(category)?.score ?? null;
      const candidate = candidateCategoryMap.get(category)?.score ?? null;
      const delta = baseline !== null && candidate !== null ? candidate - baseline : null;
      return {
        category,
        baselineScore: baseline,
        candidateScore: candidate,
        delta
      };
    });

    return {
      projectId,
      baselineVersion: {
        id: baselineVersion.id,
        versionNumber: baselineVersion.versionNumber,
        notes: baselineVersion.notes,
        createdAt: baselineVersion.createdAt.toISOString(),
        updatedAt: baselineVersion.updatedAt.toISOString(),
        componentCount: baselineComponents.length,
        edgeCount: baselineEdges.length,
        warningCount: baselineWarnings.length,
        warnings: baselineWarnings,
        trafficProfile: this.toTrafficProfile(baselineVersion.trafficProfile),
        latestSimulation: baselineRun ? this.toRunSnapshot(baselineRun) : null,
        latestGrade: baselineGrade ? this.toGradeSnapshot(baselineGrade) : null
      },
      candidateVersion: {
        id: candidateVersion.id,
        versionNumber: candidateVersion.versionNumber,
        notes: candidateVersion.notes,
        createdAt: candidateVersion.createdAt.toISOString(),
        updatedAt: candidateVersion.updatedAt.toISOString(),
        componentCount: candidateComponents.length,
        edgeCount: candidateEdges.length,
        warningCount: candidateWarnings.length,
        warnings: candidateWarnings,
        trafficProfile: this.toTrafficProfile(candidateVersion.trafficProfile),
        latestSimulation: candidateRun ? this.toRunSnapshot(candidateRun) : null,
        latestGrade: candidateGrade ? this.toGradeSnapshot(candidateGrade) : null
      },
      architectureDelta: {
        componentCountDelta: candidateComponents.length - baselineComponents.length,
        edgeCountDelta: candidateEdges.length - baselineEdges.length,
        warningCountDelta: candidateWarnings.length - baselineWarnings.length,
        addedComponents,
        removedComponents,
        addedConnections,
        removedConnections
      },
      kpiDeltas: {
        throughputRps: this.buildMetricDelta(
          baselineRun ? this.toMetricValue(baselineRun.metrics, 'throughputRps') : null,
          candidateRun ? this.toMetricValue(candidateRun.metrics, 'throughputRps') : null
        ),
        p95LatencyMs: this.buildMetricDelta(
          baselineRun ? this.toMetricValue(baselineRun.metrics, 'p95LatencyMs') : null,
          candidateRun ? this.toMetricValue(candidateRun.metrics, 'p95LatencyMs') : null
        ),
        errorRatePercent: this.buildMetricDelta(
          baselineRun ? this.toMetricValue(baselineRun.metrics, 'errorRatePercent') : null,
          candidateRun ? this.toMetricValue(candidateRun.metrics, 'errorRatePercent') : null
        ),
        overallScore: this.buildMetricDelta(
          baselineGrade?.overallScore ?? null,
          candidateGrade?.overallScore ?? null
        )
      },
      rubricDeltas,
      generatedAt: new Date().toISOString()
    };
  }

  private buildReport(projectId: string, compare: VersionCompareResult): ProjectReport {
    const improvements: string[] = [];
    const concerns: string[] = [];
    let improvedCount = 0;
    let regressedCount = 0;

    const throughputDelta = compare.kpiDeltas.throughputRps.absoluteDelta;
    const latencyDelta = compare.kpiDeltas.p95LatencyMs.absoluteDelta;
    const errorDelta = compare.kpiDeltas.errorRatePercent.absoluteDelta;
    const scoreDelta = compare.kpiDeltas.overallScore.absoluteDelta;

    if (throughputDelta !== null) {
      if (throughputDelta > 0) {
        improvedCount += 1;
        improvements.push(`Throughput improved by ${throughputDelta.toFixed(2)} RPS.`)
      } else if (throughputDelta < 0) {
        regressedCount += 1;
        concerns.push(`Throughput dropped by ${Math.abs(throughputDelta).toFixed(2)} RPS.`)
      }
    }

    if (latencyDelta !== null) {
      if (latencyDelta < 0) {
        improvedCount += 1;
        improvements.push(`p95 latency improved by ${Math.abs(latencyDelta).toFixed(2)} ms.`)
      } else if (latencyDelta > 0) {
        regressedCount += 1;
        concerns.push(`p95 latency regressed by ${latencyDelta.toFixed(2)} ms.`)
      }
    }

    if (errorDelta !== null) {
      if (errorDelta < 0) {
        improvedCount += 1;
        improvements.push(`Error rate reduced by ${Math.abs(errorDelta).toFixed(2)} percentage points.`)
      } else if (errorDelta > 0) {
        regressedCount += 1;
        concerns.push(`Error rate increased by ${errorDelta.toFixed(2)} percentage points.`)
      }
    }

    if (scoreDelta !== null) {
      if (scoreDelta > 0) {
        improvedCount += 1;
        improvements.push(`Rubric overall score improved by ${scoreDelta.toFixed(2)} points.`)
      } else if (scoreDelta < 0) {
        regressedCount += 1;
        concerns.push(`Rubric overall score dropped by ${Math.abs(scoreDelta).toFixed(2)} points.`)
      }
    }

    if (compare.architectureDelta.warningCountDelta < 0) {
      improvedCount += 1;
      improvements.push(
        `Topology warnings decreased by ${Math.abs(compare.architectureDelta.warningCountDelta)}.`
      )
    } else if (compare.architectureDelta.warningCountDelta > 0) {
      regressedCount += 1;
      concerns.push(`Topology warnings increased by ${compare.architectureDelta.warningCountDelta}.`)
    }

    const verdict =
      improvedCount === 0 && regressedCount === 0
        ? 'insufficient-data'
        : improvedCount > 0 && regressedCount === 0
          ? 'improved'
          : regressedCount > 0 && improvedCount === 0
            ? 'regressed'
            : 'mixed';

    const headline =
      verdict === 'improved'
        ? `Version ${compare.candidateVersion.versionNumber} shows measurable progress over Version ${compare.baselineVersion.versionNumber}.`
        : verdict === 'regressed'
          ? `Version ${compare.candidateVersion.versionNumber} regressed versus Version ${compare.baselineVersion.versionNumber}.`
          : verdict === 'mixed'
            ? `Version ${compare.candidateVersion.versionNumber} has mixed results versus Version ${compare.baselineVersion.versionNumber}.`
            : 'Insufficient simulation or grading data to evaluate progression.';

    const candidateActions = compare.candidateVersion.latestGrade?.categoryScores.length
      ? this.topRubricActionSuggestions(compare)
      : [];
    const recommendedActions = candidateActions.length > 0 ? candidateActions : this.fallbackActionSuggestions(compare);

    return {
      projectId,
      baselineVersionId: compare.baselineVersion.id,
      candidateVersionId: compare.candidateVersion.id,
      generatedAt: new Date().toISOString(),
      compare,
      summary: reportSummarySchema.parse({
        progressVerdict: verdict,
        headline,
        highlights: improvements,
        concerns,
        recommendedActions
      })
    };
  }

  private topRubricActionSuggestions(compare: VersionCompareResult): GradeActionItem[] {
    const lowestCategories = [...compare.rubricDeltas]
      .filter((delta) => delta.candidateScore !== null)
      .sort((left, right) => (left.candidateScore ?? 0) - (right.candidateScore ?? 0))
      .slice(0, 3);

    return lowestCategories.map((categoryDelta, index) => ({
      priority: index === 0 ? 'P0' : index === 1 ? 'P1' : 'P2',
      title: `Improve ${categoryDelta.category}`,
      description: `Raise the ${categoryDelta.category} score by hardening design assumptions and evidence.`,
      evidence: [
        `Baseline score: ${categoryDelta.baselineScore ?? 'n/a'}`,
        `Candidate score: ${categoryDelta.candidateScore ?? 'n/a'}`
      ]
    }));
  }

  private fallbackActionSuggestions(compare: VersionCompareResult): GradeActionItem[] {
    const suggestions: GradeActionItem[] = [];

    if (compare.architectureDelta.warningCountDelta > 0) {
      suggestions.push({
        priority: 'P0',
        title: 'Resolve new topology warnings',
        description:
          'Address newly introduced SPOF/disconnect/invalid-link warnings before rerunning simulation.',
        evidence: [
          `Warning delta: +${compare.architectureDelta.warningCountDelta}`,
          `Candidate warnings: ${compare.candidateVersion.warningCount}`
        ]
      });
    }

    if ((compare.kpiDeltas.errorRatePercent.absoluteDelta ?? 0) > 0) {
      suggestions.push({
        priority: 'P1',
        title: 'Lower error rate under peak traffic',
        description: 'Add capacity or resilience controls to reduce elevated error rate.',
        evidence: [
          `Error-rate delta: ${compare.kpiDeltas.errorRatePercent.absoluteDelta?.toFixed(2)} points`
        ]
      });
    }

    if ((compare.kpiDeltas.p95LatencyMs.absoluteDelta ?? 0) > 0) {
      suggestions.push({
        priority: 'P2',
        title: 'Reduce p95 latency tail',
        description: 'Investigate bottlenecks and reduce high-latency components in the critical path.',
        evidence: [`Latency delta: ${compare.kpiDeltas.p95LatencyMs.absoluteDelta?.toFixed(2)} ms`]
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'P2',
        title: 'Add another measured iteration',
        description: 'Run a new simulation and grade cycle to produce richer progression signals.',
        evidence: ['Insufficient candidate run/grade data for targeted recommendations.']
      });
    }

    return gradeActionItemSchema.array().parse(suggestions);
  }

  private edgeDisplay(
    edge: ArchitectureEdge,
    componentMap: Map<string, ArchitectureComponent>
  ): string {
    const source = componentMap.get(edge.sourceId)?.label ?? edge.sourceId;
    const target = componentMap.get(edge.targetId)?.label ?? edge.targetId;
    return `${source} -> ${target}`;
  }

  private buildMetricDelta(baseline: number | null, candidate: number | null): CompareMetricDelta {
    if (baseline === null && candidate === null) {
      return compareMetricDeltaSchema.parse({
        baseline: null,
        candidate: null,
        absoluteDelta: null,
        percentDelta: null
      });
    }

    if (baseline === null || candidate === null) {
      return compareMetricDeltaSchema.parse({
        baseline,
        candidate,
        absoluteDelta: null,
        percentDelta: null
      });
    }

    const absoluteDelta = candidate - baseline;
    const percentDelta = baseline === 0 ? null : (absoluteDelta / baseline) * 100;

    return compareMetricDeltaSchema.parse({
      baseline,
      candidate,
      absoluteDelta,
      percentDelta
    });
  }

  private toMetricValue(
    value: Prisma.JsonValue | null,
    key: 'throughputRps' | 'capacityRps' | 'p95LatencyMs' | 'errorRatePercent'
  ) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 0;
    }

    const metric = (value as Prisma.JsonObject)[key];
    return typeof metric === 'number' ? metric : 0;
  }

  private toRunSnapshot(run: CompletedRunRecord): CompareVersionRunSnapshot {
    return {
      runId: run.id,
      status: 'completed',
      throughputRps: this.toMetricValue(run.metrics, 'throughputRps'),
      capacityRps: this.toMetricValue(run.metrics, 'capacityRps'),
      p95LatencyMs: this.toMetricValue(run.metrics, 'p95LatencyMs'),
      errorRatePercent: this.toMetricValue(run.metrics, 'errorRatePercent'),
      bottleneckCount: Array.isArray(run.bottlenecks) ? run.bottlenecks.length : 0,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null
    };
  }

  private toGradeSnapshot(grade: CompletedGradeRecord) {
    return {
      gradeReportId: grade.id,
      overallScore: grade.overallScore ?? 0,
      completedAt: grade.completedAt ? grade.completedAt.toISOString() : null,
      categoryScores: this.getGradeCategoryScores(grade.categoryScores)
    };
  }

  private getGradeCategoryScores(value: Prisma.JsonValue | null) {
    const parsed = gradeCategoryScoreSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  }

  private parseStoredReport(snapshot: Prisma.JsonValue): ProjectReport {
    const parsed = projectReportSchema.safeParse(snapshot);
    if (!parsed.success) {
      throw new InternalServerErrorException('Stored report snapshot is invalid.');
    }
    return parsed.data;
  }

  private toReportExport(record: ReportExportRow, sharedPath: boolean): ReportExport {
    const shareUrl = record.shareToken ? `/shared/reports/${record.shareToken}` : null;
    const downloadPath =
      sharedPath && record.shareToken
        ? `/shared/reports/${record.shareToken}/pdf`
        : `/projects/${record.projectId}/report/exports/${record.id}/pdf`;

    return {
      id: record.id,
      projectId: record.projectId,
      baselineVersionId: record.baselineVersionId,
      candidateVersionId: record.candidateVersionId,
      format: 'pdf',
      fileName: record.fileName,
      downloadPath,
      shareToken: record.shareToken,
      shareUrl,
      shareRevokedAt: record.shareRevokedAt ? record.shareRevokedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private renderReportPdf(report: ProjectReport): Buffer {
    const lines = [
      'System Design Coach Report',
      `Project: ${report.projectId}`,
      `Generated: ${report.generatedAt}`,
      `Compared Versions: v${report.compare.baselineVersion.versionNumber} -> v${report.compare.candidateVersion.versionNumber}`,
      '',
      `Verdict: ${report.summary.progressVerdict}`,
      report.summary.headline,
      '',
      `Throughput Delta: ${this.formatDelta(report.compare.kpiDeltas.throughputRps, 'RPS')}`,
      `p95 Latency Delta: ${this.formatDelta(report.compare.kpiDeltas.p95LatencyMs, 'ms')}`,
      `Error Rate Delta: ${this.formatDelta(report.compare.kpiDeltas.errorRatePercent, '%')}`,
      `Overall Score Delta: ${this.formatDelta(report.compare.kpiDeltas.overallScore, 'pts')}`,
      `Warning Delta: ${report.compare.architectureDelta.warningCountDelta}`,
      '',
      'Highlights:',
      ...report.summary.highlights.map((entry) => `- ${entry}`),
      '',
      'Concerns:',
      ...report.summary.concerns.map((entry) => `- ${entry}`),
      '',
      'Recommended Actions:',
      ...report.summary.recommendedActions.map(
        (item) => `- [${item.priority}] ${item.title}: ${item.description}`
      )
    ];

    return this.createSimplePdf(lines.slice(0, 42));
  }

  private formatDelta(delta: CompareMetricDelta, unit: string): string {
    if (delta.absoluteDelta === null) {
      return 'N/A';
    }
    const sign = delta.absoluteDelta >= 0 ? '+' : '';
    return `${sign}${delta.absoluteDelta.toFixed(2)} ${unit}`;
  }

  private createSimplePdf(lines: string[]): Buffer {
    const escapedLines = lines.map((line) =>
      line
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
    );

    const lineHeight = 14;
    let y = 770;
    let commands = 'BT\n/F1 11 Tf\n';

    for (const line of escapedLines) {
      commands += `1 0 0 1 50 ${y} Tm (${line}) Tj\n`;
      y -= lineHeight;
      if (y < 40) {
        break;
      }
    }

    commands += 'ET\n';

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(commands, 'utf8')} >>\nstream\n${commands}endstream`
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    objects.forEach((objectBody, index) => {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
    });

    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private async createUniqueShareToken(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = randomUUID().replace(/-/g, '');
      const existing = await this.prisma.reportExport.findFirst({
        where: {
          shareToken: candidate
        },
        select: {
          id: true
        }
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new InternalServerErrorException('Unable to allocate share token. Please retry.');
  }

  private async resolveReportVersions(
    projectId: string,
    baselineVersionId?: string,
    candidateVersionId?: string
  ): Promise<{ baselineVersion: VersionRecord; candidateVersion: VersionRecord }> {
    if (baselineVersionId && candidateVersionId) {
      if (baselineVersionId === candidateVersionId) {
        throw new BadRequestException('baselineVersionId and candidateVersionId must be different.');
      }

      const [baselineVersion, candidateVersion] = await Promise.all([
        this.getVersionById(projectId, baselineVersionId),
        this.getVersionById(projectId, candidateVersionId)
      ]);

      return { baselineVersion, candidateVersion };
    }

    const latestVersions = await this.prisma.architectureVersion.findMany({
      where: {
        projectId
      },
      select: {
        id: true,
        projectId: true,
        versionNumber: true,
        notes: true,
        components: true,
        edges: true,
        trafficProfile: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        versionNumber: 'desc'
      },
      take: 2
    });

    if (latestVersions.length < 2) {
      throw new BadRequestException(
        'At least two versions are required to build a progression report.'
      );
    }

    const candidateVersion = latestVersions[0];
    const baselineVersion = latestVersions[1];

    if (!baselineVersion || !candidateVersion) {
      throw new BadRequestException('Unable to resolve baseline/candidate versions.');
    }

    return {
      baselineVersion,
      candidateVersion
    };
  }

  private async getVersionById(projectId: string, versionId: string): Promise<VersionRecord> {
    const version = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      },
      select: {
        id: true,
        projectId: true,
        versionNumber: true,
        notes: true,
        components: true,
        edges: true,
        trafficProfile: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found for this project.');
    }

    return version;
  }

  private async getLatestCompletedRun(
    projectId: string,
    versionId: string
  ): Promise<CompletedRunRecord | null> {
    return this.prisma.simulationRun.findFirst({
      where: {
        projectId,
        versionId,
        status: 'completed'
      },
      select: {
        id: true,
        status: true,
        metrics: true,
        bottlenecks: true,
        completedAt: true
      },
      orderBy: {
        completedAt: 'desc'
      }
    });
  }

  private async getLatestCompletedGrade(
    projectId: string,
    versionId: string
  ): Promise<CompletedGradeRecord | null> {
    return this.prisma.gradeReport.findFirst({
      where: {
        projectId,
        versionId,
        status: 'completed'
      },
      include: {
        feedbackItems: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });
  }

  private toComponentArray(value: Prisma.JsonValue): ArchitectureComponent[] {
    const parsed = architectureComponentSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  }

  private toEdgeArray(value: Prisma.JsonValue): ArchitectureEdge[] {
    const parsed = architectureEdgeSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  }

  private toTrafficProfile(value: Prisma.JsonValue | null): TrafficProfile {
    const parsed = trafficProfileSchema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }
    return defaultTrafficProfile;
  }

  private async assertProjectOwnership(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      select: {
        userId: true
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project.');
    }
  }
}
