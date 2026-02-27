import { describe, expect, it } from 'vitest';
import {
  buildSimulationInputContract,
  defaultTrafficProfile,
  trafficProfileSchema
} from './index';

describe('trafficProfileSchema', () => {
  it('accepts the default profile', () => {
    const parsed = trafficProfileSchema.safeParse(defaultTrafficProfile);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid read/write split', () => {
    const parsed = trafficProfileSchema.safeParse({
      ...defaultTrafficProfile,
      readPercentage: 70,
      writePercentage: 20
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid region distribution', () => {
    const parsed = trafficProfileSchema.safeParse({
      ...defaultTrafficProfile,
      regionDistribution: {
        usEast: 40,
        usWest: 20,
        europe: 20,
        apac: 5
      }
    });
    expect(parsed.success).toBe(false);
  });
});

describe('buildSimulationInputContract', () => {
  it('embeds traffic profile with graph payload', () => {
    const result = buildSimulationInputContract([], [], defaultTrafficProfile);
    expect(result.trafficProfile.baselineRps).toBe(defaultTrafficProfile.baselineRps);
  });
});
