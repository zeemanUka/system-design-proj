import { describe, expect, it } from 'vitest';
import { gradeReportResponseSchema } from './index';

describe('gradeReportResponseSchema', () => {
  it('accepts a completed grade report payload', () => {
    const parsed = gradeReportResponseSchema.safeParse({
      report: {
        id: '3be4dbb2-4855-4fd7-86c3-a16fc7a31d6a',
        projectId: '44c37f7d-5fd8-44d8-b983-935cb39565ab',
        versionId: '450f11f7-b5bb-4260-95f5-173fc6b83326',
        status: 'completed',
        overallScore: 76,
        summary: 'Good overall architecture with reliability risks to address.',
        strengths: ['Clear service boundaries'],
        risks: ['Database is still a SPOF'],
        deterministicNotes: ['2 warnings from topology validator'],
        categoryScores: [
          {
            category: 'high-level-architecture',
            weight: 20,
            score: 16,
            maxScore: 20,
            rationale: 'Architecture has core distributed components.',
            evidence: ['Found gateway, service, and data store components.']
          }
        ],
        actionItems: [
          {
            priority: 'P0',
            title: 'Remove DB SPOF',
            description: 'Add replica and failover strategy for the database tier.',
            evidence: ['SPOF warning on Primary DB']
          }
        ],
        aiProvider: 'mock',
        aiModel: 'mock-v1',
        failureReason: null,
        queuedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    expect(parsed.success).toBe(true);
  });
});
