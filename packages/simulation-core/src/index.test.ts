import { defaultTrafficProfile, type SimulationInputContract } from '@sdc/shared-types';
import { describe, expect, it } from 'vitest';
import { applyFailureInjection, deriveBlastRadiusSummary, runArchitectureSimulation, runBasicSimulation } from './index';

describe('runBasicSimulation', () => {
  it('marks as saturated when load exceeds capacity', () => {
    const output = runBasicSimulation({ requestsPerSecond: 500, replicas: 2, capacityPerReplica: 200 });
    expect(output.saturated).toBe(true);
    expect(output.throughput).toBe(400);
  });
});

describe('runArchitectureSimulation', () => {
  it('returns deterministic metrics and bottlenecks for constrained topology', () => {
    const input: SimulationInputContract = {
      components: [
        {
          id: 'gateway',
          type: 'api-gateway',
          label: 'Gateway',
          position: { x: 20, y: 20 },
          capacity: {
            opsPerSecond: 900,
            cpuCores: 2,
            memoryGb: 4
          },
          scaling: {
            replicas: 1,
            verticalTier: 'small'
          },
          behavior: {
            stateful: false
          }
        },
        {
          id: 'database',
          type: 'database',
          label: 'Primary DB',
          position: { x: 240, y: 80 },
          capacity: {
            opsPerSecond: 500,
            cpuCores: 2,
            memoryGb: 4
          },
          scaling: {
            replicas: 1,
            verticalTier: 'small'
          },
          behavior: {
            stateful: true
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          sourceId: 'gateway',
          targetId: 'database'
        }
      ],
      trafficProfile: {
        ...defaultTrafficProfile,
        baselineRps: 2800,
        peakMultiplier: 3,
        burstiness: 'spiky'
      }
    };

    const output = runArchitectureSimulation(input);
    expect(output.metrics.peakRps).toBeGreaterThan(0);
    expect(output.metrics.capacityRps).toBeGreaterThan(0);
    expect(output.metrics.throughputRps).toBeLessThanOrEqual(output.metrics.peakRps);
    expect(output.metrics.p95LatencyMs).toBeGreaterThan(output.metrics.p50LatencyMs);
    expect(output.metrics.errorRatePercent).toBeGreaterThanOrEqual(0);
    expect(output.bottlenecks.length).toBeGreaterThan(0);
    expect(output.timeline.length).toBeGreaterThan(1);
  });

  it('applies traffic surge failure injection and increases demand', () => {
    const baseInput: SimulationInputContract = {
      components: [
        {
          id: 'svc',
          type: 'service',
          label: 'Service',
          position: { x: 10, y: 10 },
          capacity: { opsPerSecond: 1200, cpuCores: 4, memoryGb: 8 },
          scaling: { replicas: 2, verticalTier: 'medium' },
          behavior: { stateful: false }
        }
      ],
      edges: [],
      trafficProfile: {
        ...defaultTrafficProfile,
        baselineRps: 1000
      }
    };

    const injected = applyFailureInjection(baseInput, {
      mode: 'traffic-surge',
      surgeMultiplier: 3
    });

    expect(injected.input.trafficProfile.baselineRps).toBeGreaterThan(baseInput.trafficProfile.baselineRps);

    const result = runArchitectureSimulation(injected.input);
    const blastRadius = deriveBlastRadiusSummary(
      {
        mode: 'traffic-surge',
        surgeMultiplier: 3
      },
      result
    );

    expect(blastRadius.mode).toBe('traffic-surge');
    expect(blastRadius.estimatedUserImpactPercent).toBeGreaterThanOrEqual(0);
  });
});
