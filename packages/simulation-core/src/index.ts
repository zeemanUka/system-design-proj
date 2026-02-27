import {
  ArchitectureComponent,
  BlastRadiusSummary,
  ComponentType,
  FailureInjectionProfile,
  SimulationComputationResult,
  SimulationTimelineEvent,
  TrafficProfile,
  type SimulationInputContract
} from '@sdc/shared-types';

export type SimulationInput = {
  requestsPerSecond: number;
  replicas: number;
  capacityPerReplica: number;
};

export type SimulationOutput = {
  throughput: number;
  saturated: boolean;
};

const VERTICAL_MULTIPLIER: Record<ArchitectureComponent['scaling']['verticalTier'], number> = {
  small: 0.75,
  medium: 1,
  large: 1.45,
  xlarge: 1.9
};

const BURST_FACTOR: Record<TrafficProfile['burstiness'], number> = {
  steady: 1,
  spiky: 1.2,
  extreme: 1.45
};

type FailureInjectionApplication = {
  input: SimulationInputContract;
  impactedComponentIds: string[];
  notes: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveAzName(component: ArchitectureComponent): 'az-a' | 'az-b' {
  return component.position.x <= 2500 ? 'az-a' : 'az-b';
}

function safeComponentCapacity(value: number): number {
  return Math.max(1, value);
}

function componentDemandWeight(type: ComponentType, trafficProfile: TrafficProfile): number {
  const readRatio = trafficProfile.readPercentage / 100;
  const writeRatio = trafficProfile.writePercentage / 100;

  switch (type) {
    case 'client':
      return 1;
    case 'load-balancer':
      return 1;
    case 'api-gateway':
      return 0.96;
    case 'service':
      return 0.9;
    case 'cache':
      return 0.25 + readRatio * 0.7;
    case 'database':
      return 0.3 + writeRatio * 0.68 + readRatio * 0.12;
    case 'queue':
      return 0.2 + writeRatio * 0.7;
    case 'cdn':
      return 0.18 + readRatio * 0.64;
    case 'object-store':
      return 0.15 + writeRatio * 0.62;
    default:
      return 0.5;
  }
}

function componentEffectiveCapacity(component: ArchitectureComponent): number {
  const verticalFactor = VERTICAL_MULTIPLIER[component.scaling.verticalTier];
  const statefulPenalty = component.behavior.stateful ? 0.86 : 1;
  const cpuBoost = clamp(0.65 + component.capacity.cpuCores * 0.12, 0.6, 1.45);
  const memoryBoost = clamp(0.72 + component.capacity.memoryGb * 0.045, 0.65, 1.5);
  const perReplicaCapacity = component.capacity.opsPerSecond * verticalFactor * cpuBoost * memoryBoost;
  const replicaEfficiency = 0.94;
  const scaledCapacity = perReplicaCapacity * component.scaling.replicas * replicaEfficiency;

  return Math.max(1, scaledCapacity * statefulPenalty);
}

function bottleneckSeverity(utilizationPercent: number): 'low' | 'medium' | 'high' | 'critical' {
  if (utilizationPercent >= 140) {
    return 'critical';
  }
  if (utilizationPercent >= 110) {
    return 'high';
  }
  if (utilizationPercent >= 90) {
    return 'medium';
  }
  return 'low';
}

function timelineFromBottlenecks(
  bottlenecks: SimulationComputationResult['bottlenecks'],
  saturated: boolean
): SimulationTimelineEvent[] {
  const events: SimulationTimelineEvent[] = [
    {
      sequence: 0,
      atSecond: 0,
      severity: 'info',
      title: 'Simulation started',
      description: 'Queued architecture assumptions were loaded for execution.',
      componentId: null
    }
  ];

  const leading = bottlenecks.slice(0, 3);
  for (const [index, bottleneck] of leading.entries()) {
    events.push({
      sequence: index + 1,
      atSecond: 10 + index * 15,
      severity: bottleneck.severity === 'critical' ? 'critical' : 'warning',
      title: `Capacity pressure on ${bottleneck.componentLabel}`,
      description: `${bottleneck.componentLabel} reached ${bottleneck.utilizationPercent.toFixed(1)}% utilization.`,
      componentId: bottleneck.componentId
    });
  }

  events.push({
    sequence: events.length,
    atSecond: saturated ? 60 : 45,
    severity: saturated ? 'critical' : 'info',
    title: saturated ? 'System saturation reached' : 'Run stabilized',
    description: saturated
      ? 'Demand exceeded modeled capacity and error rate increased.'
      : 'System stayed within modeled throughput capacity.',
    componentId: null
  });

  return events;
}

export function runBasicSimulation(input: SimulationInput): SimulationOutput {
  const maxThroughput = input.replicas * input.capacityPerReplica;
  return {
    throughput: Math.min(input.requestsPerSecond, maxThroughput),
    saturated: input.requestsPerSecond > maxThroughput
  };
}

export function applyFailureInjection(
  input: SimulationInputContract,
  profile: FailureInjectionProfile
): FailureInjectionApplication {
  const nextInput: SimulationInputContract = {
    components: input.components.map((component) => ({ ...component, capacity: { ...component.capacity }, scaling: { ...component.scaling }, behavior: { ...component.behavior }, position: { ...component.position } })),
    edges: input.edges.map((edge) => ({ ...edge })),
    trafficProfile: {
      ...input.trafficProfile,
      regionDistribution: { ...input.trafficProfile.regionDistribution }
    }
  };

  const impacted = new Set<string>();
  const notes: string[] = [];

  if (profile.mode === 'node-down' && profile.targetComponentId) {
    nextInput.components = nextInput.components.map((component) => {
      if (component.id !== profile.targetComponentId) {
        return component;
      }

      impacted.add(component.id);
      notes.push(`Forced ${component.label} offline.`);

      return {
        ...component,
        capacity: {
          ...component.capacity,
          opsPerSecond: 1,
          cpuCores: safeComponentCapacity(component.capacity.cpuCores * 0.1),
          memoryGb: safeComponentCapacity(component.capacity.memoryGb * 0.15)
        },
        scaling: {
          ...component.scaling,
          replicas: 1
        }
      };
    });
  }

  if (profile.mode === 'az-down' && profile.azName) {
    nextInput.components = nextInput.components.map((component) => {
      if (resolveAzName(component) !== profile.azName) {
        return component;
      }

      impacted.add(component.id);

      return {
        ...component,
        capacity: {
          ...component.capacity,
          opsPerSecond: safeComponentCapacity(component.capacity.opsPerSecond * 0.28),
          cpuCores: safeComponentCapacity(component.capacity.cpuCores * 0.6),
          memoryGb: safeComponentCapacity(component.capacity.memoryGb * 0.72)
        },
        scaling: {
          ...component.scaling,
          replicas: Math.max(1, Math.floor(component.scaling.replicas * 0.5))
        }
      };
    });

    notes.push(`Applied AZ outage in ${profile.azName}.`);
  }

  if (profile.mode === 'dependency-lag' && profile.targetComponentId) {
    const lagMs = profile.lagMs ?? 250;
    nextInput.components = nextInput.components.map((component) => {
      if (component.id !== profile.targetComponentId) {
        return component;
      }

      impacted.add(component.id);

      return {
        ...component,
        capacity: {
          ...component.capacity,
          opsPerSecond: safeComponentCapacity(component.capacity.opsPerSecond * 0.55),
          cpuCores: safeComponentCapacity(component.capacity.cpuCores * 0.82),
          memoryGb: safeComponentCapacity(component.capacity.memoryGb * 0.9)
        }
      };
    });

    nextInput.trafficProfile = {
      ...nextInput.trafficProfile,
      payloadKb: clamp(nextInput.trafficProfile.payloadKb + lagMs / 15, 0.1, 10_000)
    };

    notes.push(`Injected ${lagMs}ms dependency lag.`);
  }

  if (profile.mode === 'traffic-surge') {
    const multiplier = profile.surgeMultiplier ?? 2;
    nextInput.trafficProfile = {
      ...nextInput.trafficProfile,
      baselineRps: Math.max(
        1,
        Math.floor(clamp(nextInput.trafficProfile.baselineRps * multiplier, 1, 10_000_000))
      ),
      peakMultiplier: clamp(nextInput.trafficProfile.peakMultiplier * (1 + (multiplier - 1) * 0.35), 1, 50)
    };
    notes.push(`Applied traffic surge multiplier x${multiplier.toFixed(2)}.`);
  }

  return {
    input: nextInput,
    impactedComponentIds: [...impacted],
    notes
  };
}

export function runArchitectureSimulation(input: SimulationInputContract): SimulationComputationResult {
  if (input.components.length === 0) {
    return {
      metrics: {
        peakRps: input.trafficProfile.baselineRps * input.trafficProfile.peakMultiplier,
        capacityRps: 0,
        throughputRps: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        errorRatePercent: 100,
        saturated: true
      },
      bottlenecks: [],
      timeline: [
        {
          sequence: 0,
          atSecond: 0,
          severity: 'critical',
          title: 'Invalid topology',
          description: 'No components were found in the version graph.',
          componentId: null
        }
      ]
    };
  }

  const peakRps = input.trafficProfile.baselineRps * input.trafficProfile.peakMultiplier;
  const adjustedDemandRps = peakRps * BURST_FACTOR[input.trafficProfile.burstiness];

  const capacityByComponent = new Map<string, number>();
  let systemCapacityRps = Number.POSITIVE_INFINITY;
  const bottlenecks: SimulationComputationResult['bottlenecks'] = [];

  for (const component of input.components) {
    const capacityRps = componentEffectiveCapacity(component);
    capacityByComponent.set(component.id, capacityRps);

    const demandWeight = componentDemandWeight(component.type, input.trafficProfile);
    const requiredRps = Math.max(1, adjustedDemandRps * demandWeight);
    const normalizedCapacity = capacityRps / demandWeight;
    systemCapacityRps = Math.min(systemCapacityRps, normalizedCapacity);

    const utilizationPercent = (requiredRps / capacityRps) * 100;
    if (utilizationPercent >= 80) {
      bottlenecks.push({
        componentId: component.id,
        componentLabel: component.label,
        componentType: component.type,
        utilizationPercent,
        requiredRps,
        capacityRps,
        severity: bottleneckSeverity(utilizationPercent),
        reason:
          utilizationPercent >= 100
            ? 'Demand is above available component capacity.'
            : 'Component is approaching saturation under peak assumptions.'
      });
    }
  }

  bottlenecks.sort((left, right) => right.utilizationPercent - left.utilizationPercent);
  if (!Number.isFinite(systemCapacityRps)) {
    systemCapacityRps = 0;
  }

  const throughputRps = Math.max(0, Math.min(adjustedDemandRps, systemCapacityRps));
  const saturated = adjustedDemandRps > systemCapacityRps;
  const maxUtilization = bottlenecks[0]?.utilizationPercent ?? 45;

  const payloadPenaltyMs = input.trafficProfile.payloadKb * 0.28;
  const p50LatencyMs = Math.max(
    18,
    24 + payloadPenaltyMs + Math.pow(maxUtilization / 100, 1.6) * 190 + BURST_FACTOR[input.trafficProfile.burstiness] * 6
  );
  const p95LatencyMs = p50LatencyMs * (1.44 + Math.min(maxUtilization / 180, 0.6));
  const errorRatePercent = saturated
    ? clamp(((adjustedDemandRps - systemCapacityRps) / adjustedDemandRps) * 100, 0, 100)
    : clamp(Math.max(0, (maxUtilization - 88) * 0.18), 0, 8);

  return {
    metrics: {
      peakRps: adjustedDemandRps,
      capacityRps: systemCapacityRps,
      throughputRps,
      p50LatencyMs,
      p95LatencyMs,
      errorRatePercent,
      saturated
    },
    bottlenecks,
    timeline: timelineFromBottlenecks(bottlenecks, saturated)
  };
}

export function deriveBlastRadiusSummary(
  profile: FailureInjectionProfile,
  result: SimulationComputationResult
): BlastRadiusSummary {
  const impactedComponents = result.bottlenecks
    .filter((bottleneck) => bottleneck.severity === 'critical' || bottleneck.severity === 'high')
    .slice(0, 6)
    .map((bottleneck) => ({
      componentId: bottleneck.componentId,
      componentLabel: bottleneck.componentLabel,
      componentType: bottleneck.componentType,
      severity: bottleneck.severity,
      reason: bottleneck.reason
    }));

  const criticalCount = impactedComponents.filter((component) => component.severity === 'critical').length;
  const estimatedUserImpactPercent = clamp(
    result.metrics.errorRatePercent + (result.metrics.saturated ? 8 : 0),
    0,
    100
  );

  return {
    mode: profile.mode,
    impactedComponents,
    impactedCount: impactedComponents.length,
    criticalCount,
    estimatedUserImpactPercent,
    summary:
      impactedComponents.length === 0
        ? 'Failure injected with limited blast radius under current assumptions.'
        : `${impactedComponents.length} components are in high/critical pressure after ${profile.mode}.`
  };
}
