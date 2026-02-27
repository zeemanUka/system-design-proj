import { describe, expect, it } from 'vitest';
import { failureInjectionRequestSchema, simulationRunResponseSchema } from './index';

describe('simulationRunResponseSchema', () => {
  it('accepts a completed run payload', () => {
    const parsed = simulationRunResponseSchema.safeParse({
      run: {
        id: '19b447f4-7cc1-4484-bec6-2741cc9efad5',
        projectId: '65f57d1f-8390-4337-a913-ab6dc2ae0c89',
        versionId: 'fbc08ce4-8673-46af-89f7-d637f0546f1b',
        baselineRunId: null,
        failureProfile: null,
        blastRadius: null,
        status: 'completed',
        queuedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        failureReason: null,
        metrics: {
          peakRps: 1000,
          capacityRps: 1200,
          throughputRps: 1000,
          p50LatencyMs: 35,
          p95LatencyMs: 70,
          errorRatePercent: 0,
          saturated: false
        },
        bottlenecks: [],
        events: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid run statuses', () => {
    const parsed = simulationRunResponseSchema.safeParse({
      run: {
        id: '19b447f4-7cc1-4484-bec6-2741cc9efad5',
        projectId: '65f57d1f-8390-4337-a913-ab6dc2ae0c89',
        versionId: 'fbc08ce4-8673-46af-89f7-d637f0546f1b',
        baselineRunId: null,
        failureProfile: null,
        blastRadius: null,
        status: 'done',
        queuedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        failureReason: null,
        metrics: null,
        bottlenecks: [],
        events: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    expect(parsed.success).toBe(false);
  });

  it('validates failure injection request by mode', () => {
    const parsed = failureInjectionRequestSchema.safeParse({
      profile: {
        mode: 'dependency-lag',
        targetComponentId: 'db-main',
        lagMs: 250
      }
    });

    expect(parsed.success).toBe(true);
  });
});
