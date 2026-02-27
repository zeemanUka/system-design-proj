import { defaultTrafficProfile } from '@sdc/shared-types';
import { describe, expect, it } from 'vitest';
import { calculateTotalScore, evaluateDeterministicRubric } from './index';

describe('calculateTotalScore', () => {
  it('returns weighted percentage', () => {
    const total = calculateTotalScore([
      { category: 'architecture', score: 8, maxScore: 10 },
      { category: 'scalability', score: 7, maxScore: 10 },
      { category: 'reliability', score: 9, maxScore: 10 }
    ]);

    expect(total).toBe(80);
  });
});

describe('evaluateDeterministicRubric', () => {
  it('returns reproducible category scores and action items', () => {
    const output = evaluateDeterministicRubric({
      components: [
        {
          id: 'client-1',
          type: 'client',
          label: 'Client',
          position: { x: 10, y: 10 },
          capacity: { opsPerSecond: 2000, cpuCores: 2, memoryGb: 4 },
          scaling: { replicas: 1, verticalTier: 'small' },
          behavior: { stateful: false }
        },
        {
          id: 'gateway-1',
          type: 'api-gateway',
          label: 'Gateway',
          position: { x: 200, y: 40 },
          capacity: { opsPerSecond: 1800, cpuCores: 4, memoryGb: 8 },
          scaling: { replicas: 2, verticalTier: 'medium' },
          behavior: { stateful: false }
        },
        {
          id: 'db-1',
          type: 'database',
          label: 'Primary DB',
          position: { x: 420, y: 200 },
          capacity: { opsPerSecond: 700, cpuCores: 4, memoryGb: 16 },
          scaling: { replicas: 1, verticalTier: 'medium' },
          behavior: { stateful: true }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          sourceId: 'client-1',
          targetId: 'gateway-1'
        },
        {
          id: 'edge-2',
          sourceId: 'gateway-1',
          targetId: 'db-1'
        }
      ],
      trafficProfile: {
        ...defaultTrafficProfile,
        readPercentage: 85,
        writePercentage: 15
      },
      notes: 'Target: 99.9% availability, low latency reads, and clear tradeoff between cost and consistency.'
    });

    expect(output.overallScore).toBeGreaterThan(0);
    expect(output.categoryScores).toHaveLength(7);
    expect(output.actionItems.length).toBeGreaterThan(0);
    expect(output.deterministicNotes.length).toBeGreaterThan(0);
  });
});
