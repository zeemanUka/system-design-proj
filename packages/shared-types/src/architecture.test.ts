import { describe, expect, it } from 'vitest';
import {
  ArchitectureComponent,
  ArchitectureEdge,
  validateArchitectureTopology
} from './index';

function component(id: string, type: ArchitectureComponent['type']): ArchitectureComponent {
  return {
    id,
    type,
    label: `${type}-${id}`,
    position: { x: 10, y: 10 },
    capacity: { opsPerSecond: 1000, cpuCores: 2, memoryGb: 4 },
    scaling: { replicas: 1, verticalTier: 'medium' },
    behavior: { stateful: type === 'database' }
  };
}

describe('validateArchitectureTopology', () => {
  it('flags missing edges and SPOF conditions', () => {
    const warnings = validateArchitectureTopology(
      [component('a', 'service'), component('b', 'database')],
      []
    );

    expect(warnings.some((warning) => warning.code === 'DISCONNECTED_NODE')).toBe(true);
    expect(warnings.some((warning) => warning.code === 'SPOF')).toBe(true);
  });

  it('flags invalid links', () => {
    const nodes = [component('a', 'service'), component('b', 'database')];
    const edges: ArchitectureEdge[] = [
      { id: '1', sourceId: 'a', targetId: 'a' },
      { id: '2', sourceId: 'a', targetId: 'missing' },
      { id: '3', sourceId: 'a', targetId: 'b' },
      { id: '4', sourceId: 'a', targetId: 'b' }
    ];

    const warnings = validateArchitectureTopology(nodes, edges);
    const invalidWarnings = warnings.filter((warning) => warning.code === 'INVALID_LINK');
    expect(invalidWarnings.length).toBeGreaterThanOrEqual(3);
  });
});
