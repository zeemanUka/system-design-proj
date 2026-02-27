import { describe, expect, it } from 'vitest';
import {
  projectReportResponseSchema,
  sharedReportResponseSchema,
  versionCompareResponseSchema
} from './index';

function sampleCompare() {
  return {
    compare: {
      projectId: '6a4b0226-3327-4582-a0fd-a8d66eb8b660',
      baselineVersion: {
        id: '5d8fef03-3fce-4aa2-b30a-456acbbf425c',
        versionNumber: 1,
        notes: 'Baseline architecture',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        componentCount: 5,
        edgeCount: 4,
        warningCount: 1,
        warnings: [],
        trafficProfile: {
          baselineRps: 1500,
          peakMultiplier: 3,
          readPercentage: 80,
          writePercentage: 20,
          payloadKb: 10,
          regionDistribution: {
            usEast: 50,
            usWest: 20,
            europe: 20,
            apac: 10
          },
          burstiness: 'steady'
        },
        latestSimulation: {
          runId: 'c9256fff-2c48-4077-a407-bcf4135eb2eb',
          status: 'completed',
          throughputRps: 1450,
          capacityRps: 1600,
          p95LatencyMs: 81.2,
          errorRatePercent: 1.2,
          bottleneckCount: 2,
          completedAt: new Date().toISOString()
        },
        latestGrade: {
          gradeReportId: '8ea1eb39-14ce-4dc7-958c-e89c8e34a247',
          overallScore: 74,
          completedAt: new Date().toISOString(),
          categoryScores: []
        }
      },
      candidateVersion: {
        id: 'cc7fb95d-808a-45d7-95d6-7c6fa3de295f',
        versionNumber: 2,
        notes: 'Added replicas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        componentCount: 6,
        edgeCount: 6,
        warningCount: 0,
        warnings: [],
        trafficProfile: {
          baselineRps: 2000,
          peakMultiplier: 3,
          readPercentage: 78,
          writePercentage: 22,
          payloadKb: 10,
          regionDistribution: {
            usEast: 45,
            usWest: 25,
            europe: 20,
            apac: 10
          },
          burstiness: 'spiky'
        },
        latestSimulation: {
          runId: '58f3fe8b-ab5c-467f-9367-f98ddd4405b6',
          status: 'completed',
          throughputRps: 1980,
          capacityRps: 2300,
          p95LatencyMs: 55.7,
          errorRatePercent: 0.4,
          bottleneckCount: 1,
          completedAt: new Date().toISOString()
        },
        latestGrade: {
          gradeReportId: '89f934c4-c38c-4f5e-a6b9-7f8d9f2204af',
          overallScore: 88,
          completedAt: new Date().toISOString(),
          categoryScores: []
        }
      },
      architectureDelta: {
        componentCountDelta: 1,
        edgeCountDelta: 2,
        warningCountDelta: -1,
        addedComponents: [
          {
            id: 'cache-01',
            label: 'Session Cache',
            type: 'cache'
          }
        ],
        removedComponents: [],
        addedConnections: ['Gateway -> Cache'],
        removedConnections: []
      },
      kpiDeltas: {
        throughputRps: {
          baseline: 1450,
          candidate: 1980,
          absoluteDelta: 530,
          percentDelta: 36.55
        },
        p95LatencyMs: {
          baseline: 81.2,
          candidate: 55.7,
          absoluteDelta: -25.5,
          percentDelta: -31.4
        },
        errorRatePercent: {
          baseline: 1.2,
          candidate: 0.4,
          absoluteDelta: -0.8,
          percentDelta: -66.7
        },
        overallScore: {
          baseline: 74,
          candidate: 88,
          absoluteDelta: 14,
          percentDelta: 18.9
        }
      },
      rubricDeltas: [],
      generatedAt: new Date().toISOString()
    }
  };
}

describe('stage8 compare/report schemas', () => {
  it('accepts compare payload', () => {
    expect(versionCompareResponseSchema.safeParse(sampleCompare()).success).toBe(true);
  });

  it('accepts project report payload', () => {
    const base = sampleCompare();
    const parsed = projectReportResponseSchema.safeParse({
      report: {
        projectId: base.compare.projectId,
        baselineVersionId: base.compare.baselineVersion.id,
        candidateVersionId: base.compare.candidateVersion.id,
        generatedAt: new Date().toISOString(),
        compare: base.compare,
        summary: {
          progressVerdict: 'improved',
          headline: 'Version 2 improved reliability and throughput.',
          highlights: ['Throughput increased 36.55%.'],
          concerns: ['Need stronger DB failover evidence in run output.'],
          recommendedActions: []
        }
      }
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts shared report payload', () => {
    const base = sampleCompare();
    const parsed = sharedReportResponseSchema.safeParse({
      export: {
        id: 'ce7eae64-02f8-4e26-88f7-c43f3875451f',
        projectId: base.compare.projectId,
        baselineVersionId: base.compare.baselineVersion.id,
        candidateVersionId: base.compare.candidateVersion.id,
        format: 'pdf',
        fileName: 'system-design-report-v1-v2.pdf',
        downloadPath: '/projects/6a4b0226-3327-4582-a0fd-a8d66eb8b660/report/exports/ce7eae64-02f8-4e26-88f7-c43f3875451f/pdf',
        shareToken: 'share-token',
        shareUrl: '/shared/reports/share-token',
        shareRevokedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      report: {
        projectId: base.compare.projectId,
        baselineVersionId: base.compare.baselineVersion.id,
        candidateVersionId: base.compare.candidateVersion.id,
        generatedAt: new Date().toISOString(),
        compare: base.compare,
        summary: {
          progressVerdict: 'mixed',
          headline: 'Version 2 improved KPIs with remaining tradeoff risks.',
          highlights: [],
          concerns: [],
          recommendedActions: []
        }
      }
    });

    expect(parsed.success).toBe(true);
  });
});
