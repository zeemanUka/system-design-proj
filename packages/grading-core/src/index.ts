import {
  ArchitectureComponent,
  ArchitectureEdge,
  GradeActionItem,
  GradeCategory,
  GradeCategoryScore,
  TopologyWarning,
  TrafficProfile,
  validateArchitectureTopology
} from '@sdc/shared-types';

export type RubricCategory = 'architecture' | 'scalability' | 'reliability';

export type RubricScore = {
  category: RubricCategory;
  score: number;
  maxScore: number;
};

export type DeterministicGradingInput = {
  components: ArchitectureComponent[];
  edges: ArchitectureEdge[];
  trafficProfile: TrafficProfile;
  notes: string | null;
};

export type DeterministicGradingOutput = {
  overallScore: number;
  categoryScores: GradeCategoryScore[];
  strengths: string[];
  risks: string[];
  deterministicNotes: string[];
  actionItems: GradeActionItem[];
};

const CATEGORY_WEIGHTS: Record<GradeCategory, number> = {
  'requirements-clarification': 10,
  'high-level-architecture': 20,
  'data-model-access-patterns': 15,
  'scalability-decisions': 20,
  'reliability-fault-tolerance': 15,
  'bottleneck-identification': 10,
  'tradeoff-reasoning': 10
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function weightedOverallScore(categoryScores: GradeCategoryScore[]): number {
  const weighted = categoryScores.reduce((sum, item) => {
    const normalized = clamp(item.score / item.maxScore, 0, 1);
    return sum + normalized * item.weight;
  }, 0);
  return Math.round(weighted);
}

function hasType(components: ArchitectureComponent[], type: ArchitectureComponent['type']): boolean {
  return components.some((component) => component.type === type);
}

function avgReplicas(components: ArchitectureComponent[]): number {
  const scalable = components.filter((component) =>
    ['service', 'api-gateway', 'load-balancer', 'cache', 'database'].includes(component.type)
  );
  if (scalable.length === 0) {
    return 1;
  }
  return scalable.reduce((sum, component) => sum + component.scaling.replicas, 0) / scalable.length;
}

function scoreRequirements(notes: string | null): GradeCategoryScore {
  const trimmed = notes?.trim() ?? '';
  const length = trimmed.length;
  const hasKeywords = /rps|latency|availability|sla|throughput|consistency|durability/i.test(trimmed);
  let score = 40;
  const evidence: string[] = [];

  if (length >= 80) {
    score += 35;
    evidence.push('Version notes include meaningful requirement context.');
  } else {
    evidence.push('Version notes are too short for clear requirement framing.');
  }

  if (hasKeywords) {
    score += 20;
    evidence.push('Notes mention measurable system requirements.');
  } else {
    evidence.push('Notes do not include clear measurable requirements.');
  }

  if (length >= 220) {
    score += 5;
    evidence.push('Notes include additional scope assumptions.');
  }

  return {
    category: 'requirements-clarification',
    weight: CATEGORY_WEIGHTS['requirements-clarification'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates clarity of requirements and assumptions captured in design notes.',
    evidence
  };
}

function scoreHighLevelArchitecture(
  components: ArchitectureComponent[],
  edges: ArchitectureEdge[]
): GradeCategoryScore {
  let score = 30;
  const evidence: string[] = [];

  if (components.length >= 4) {
    score += 20;
    evidence.push(`Architecture has ${components.length} components.`);
  } else {
    evidence.push('Architecture has limited component decomposition.');
  }

  if (edges.length >= Math.max(1, components.length - 2)) {
    score += 18;
    evidence.push('Core components are connected by explicit request/data flow edges.');
  } else {
    evidence.push('Topology has too few edges for clear end-to-end flow.');
  }

  if (hasType(components, 'api-gateway') || hasType(components, 'load-balancer')) {
    score += 15;
    evidence.push('Traffic ingress component exists.');
  } else {
    evidence.push('Missing ingress layer (gateway/load balancer).');
  }

  if (hasType(components, 'service') && (hasType(components, 'database') || hasType(components, 'object-store'))) {
    score += 17;
    evidence.push('Service and persistence layers are represented.');
  } else {
    evidence.push('Missing clear service-to-storage split.');
  }

  return {
    category: 'high-level-architecture',
    weight: CATEGORY_WEIGHTS['high-level-architecture'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates whether the design has complete layers and explicit data flow.',
    evidence
  };
}

function scoreDataModel(components: ArchitectureComponent[], trafficProfile: TrafficProfile): GradeCategoryScore {
  let score = 35;
  const evidence: string[] = [];

  const hasDatabase = hasType(components, 'database');
  const hasObjectStore = hasType(components, 'object-store');
  const hasCache = hasType(components, 'cache');
  const hasQueue = hasType(components, 'queue');

  if (hasDatabase || hasObjectStore) {
    score += 25;
    evidence.push('Persistent storage component exists.');
  } else {
    evidence.push('Persistent storage layer is missing.');
  }

  if (trafficProfile.readPercentage >= 70 && hasCache) {
    score += 20;
    evidence.push('Read-heavy profile is supported by a cache layer.');
  } else if (trafficProfile.readPercentage >= 70 && !hasCache) {
    evidence.push('Read-heavy profile lacks an explicit cache strategy.');
  } else {
    score += 10;
    evidence.push('Read/write profile does not require aggressive cache optimization.');
  }

  if (trafficProfile.writePercentage >= 30 && hasQueue) {
    score += 15;
    evidence.push('Write-heavy behavior includes queue buffering.');
  } else if (trafficProfile.writePercentage >= 30) {
    evidence.push('Write-heavy behavior lacks queue buffering.');
  } else {
    score += 10;
    evidence.push('Write percentage is moderate for direct persistence path.');
  }

  if (hasDatabase && hasObjectStore) {
    score += 10;
    evidence.push('Multiple storage primitives exist for different access patterns.');
  }

  return {
    category: 'data-model-access-patterns',
    weight: CATEGORY_WEIGHTS['data-model-access-patterns'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates storage and data access strategy against traffic profile.',
    evidence
  };
}

function scoreScalability(components: ArchitectureComponent[], trafficProfile: TrafficProfile): GradeCategoryScore {
  let score = 30;
  const evidence: string[] = [];

  const replicasAverage = avgReplicas(components);
  if (replicasAverage >= 2) {
    score += 30;
    evidence.push(`Average replicas ${replicasAverage.toFixed(2)} indicates horizontal scaling.`);
  } else {
    evidence.push('Replica counts are low for critical components.');
  }

  const hasLargeTier = components.some((component) =>
    ['large', 'xlarge'].includes(component.scaling.verticalTier)
  );
  if (hasLargeTier) {
    score += 15;
    evidence.push('Vertical scaling decisions are represented.');
  } else {
    evidence.push('No strong vertical scaling choices found.');
  }

  if (trafficProfile.peakMultiplier >= 3 && replicasAverage >= 2) {
    score += 20;
    evidence.push('Scaling plan aligns with expected peak multiplier.');
  } else if (trafficProfile.peakMultiplier >= 3) {
    evidence.push('Peak multiplier is high but scaling posture is weak.');
  } else {
    score += 10;
    evidence.push('Peak assumptions are moderate.');
  }

  if (hasType(components, 'cdn') || hasType(components, 'queue')) {
    score += 15;
    evidence.push('Edge distribution or async buffering improves scalability posture.');
  }

  return {
    category: 'scalability-decisions',
    weight: CATEGORY_WEIGHTS['scalability-decisions'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates horizontal/vertical scaling strategy against expected load shape.',
    evidence
  };
}

function scoreReliability(
  components: ArchitectureComponent[],
  warnings: TopologyWarning[]
): GradeCategoryScore {
  let score = 85;
  const evidence: string[] = [];

  const spofWarnings = warnings.filter((warning) => warning.code === 'SPOF');
  const disconnectedWarnings = warnings.filter((warning) => warning.code === 'DISCONNECTED_NODE');
  const invalidWarnings = warnings.filter((warning) => warning.code === 'INVALID_LINK');

  if (spofWarnings.length > 0) {
    score -= Math.min(45, spofWarnings.length * 12);
    evidence.push(`${spofWarnings.length} SPOF warning(s) detected.`);
  } else {
    evidence.push('No SPOF warnings detected.');
  }

  if (disconnectedWarnings.length > 0) {
    score -= Math.min(25, disconnectedWarnings.length * 6);
    evidence.push(`${disconnectedWarnings.length} disconnected-node warning(s) detected.`);
  }

  if (invalidWarnings.length > 0) {
    score -= Math.min(20, invalidWarnings.length * 8);
    evidence.push(`${invalidWarnings.length} invalid-link warning(s) detected.`);
  }

  const replicatedStateful = components.some(
    (component) => component.behavior.stateful && component.scaling.replicas >= 2
  );
  if (replicatedStateful) {
    score += 8;
    evidence.push('At least one stateful component has replica-level redundancy.');
  } else {
    evidence.push('Stateful components do not show explicit replica-level redundancy.');
  }

  return {
    category: 'reliability-fault-tolerance',
    weight: CATEGORY_WEIGHTS['reliability-fault-tolerance'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates SPOFs, graph validity, and resilience posture.',
    evidence
  };
}

function scoreBottleneckIdentification(
  components: ArchitectureComponent[],
  warnings: TopologyWarning[]
): GradeCategoryScore {
  let score = 45;
  const evidence: string[] = [];

  if (warnings.length > 0) {
    score += 18;
    evidence.push('Topology warnings expose potential bottlenecks and weak links.');
  } else {
    evidence.push('No topology warnings detected.');
  }

  if (hasType(components, 'queue')) {
    score += 18;
    evidence.push('Queue exists for smoothing burst pressure and identifying async boundaries.');
  }

  if (hasType(components, 'cache')) {
    score += 12;
    evidence.push('Cache layer indicates read bottleneck mitigation planning.');
  }

  if (hasType(components, 'database')) {
    score += 10;
    evidence.push('Persistent tier present for explicit throughput/latency scrutiny.');
  }

  return {
    category: 'bottleneck-identification',
    weight: CATEGORY_WEIGHTS['bottleneck-identification'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates whether design artifacts make bottlenecks explicit and actionable.',
    evidence
  };
}

function scoreTradeoffReasoning(notes: string | null): GradeCategoryScore {
  const trimmed = notes?.trim() ?? '';
  const evidence: string[] = [];
  let score = 40;

  const tradeoffMentions = (trimmed.match(/tradeoff|consistency|latency|cost|complexity|availability/gi) ?? [])
    .length;
  if (tradeoffMentions >= 2) {
    score += 35;
    evidence.push('Notes include explicit tradeoff discussion.');
  } else if (tradeoffMentions === 1) {
    score += 18;
    evidence.push('Notes include limited tradeoff reasoning.');
  } else {
    evidence.push('Notes do not explicitly capture tradeoff decisions.');
  }

  if (trimmed.length >= 180) {
    score += 20;
    evidence.push('Notes length suggests reasoning depth.');
  } else {
    evidence.push('Notes are short for detailed tradeoff analysis.');
  }

  return {
    category: 'tradeoff-reasoning',
    weight: CATEGORY_WEIGHTS['tradeoff-reasoning'],
    score: clamp(score, 0, 100),
    maxScore: 100,
    rationale: 'Evaluates explicit articulation of architecture tradeoffs.',
    evidence
  };
}

function buildActionItems(
  warnings: TopologyWarning[],
  components: ArchitectureComponent[],
  trafficProfile: TrafficProfile,
  notes: string | null
): GradeActionItem[] {
  const items: GradeActionItem[] = [];
  const seen = new Set<string>();

  for (const warning of warnings) {
    const id = `${warning.code}-${warning.nodeId ?? 'none'}-${warning.edgeId ?? 'none'}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const priority = warning.code === 'SPOF' || warning.code === 'INVALID_LINK' ? 'P0' : 'P1';
    items.push({
      priority,
      title:
        warning.code === 'SPOF'
          ? 'Eliminate single points of failure'
          : warning.code === 'INVALID_LINK'
            ? 'Fix invalid topology links'
            : 'Reconnect disconnected components',
      description: warning.message,
      evidence: [warning.message]
    });
  }

  if (trafficProfile.readPercentage >= 70 && !hasType(components, 'cache')) {
    items.push({
      priority: 'P1',
      title: 'Add read-path cache strategy',
      description: 'Read-heavy traffic profile should include cache to reduce persistent-store pressure.',
      evidence: [`Read percentage is ${trafficProfile.readPercentage}%.`]
    });
  }

  if (trafficProfile.writePercentage >= 35 && !hasType(components, 'queue')) {
    items.push({
      priority: 'P1',
      title: 'Buffer write-path spikes',
      description: 'Write-heavy profile benefits from queue buffering for burst handling.',
      evidence: [`Write percentage is ${trafficProfile.writePercentage}%.`]
    });
  }

  if ((notes?.trim().length ?? 0) < 80) {
    items.push({
      priority: 'P2',
      title: 'Improve design notes and assumptions',
      description: 'Capture explicit requirements, traffic assumptions, and tradeoff rationale.',
      evidence: ['Version notes are short or missing.']
    });
  }

  return items.slice(0, 8);
}

function deriveStrengthsAndRisks(categoryScores: GradeCategoryScore[]): { strengths: string[]; risks: string[] } {
  const strengths = categoryScores
    .filter((score) => score.score >= 75)
    .map((score) => `${score.category}: ${score.rationale}`);
  const risks = categoryScores
    .filter((score) => score.score < 60)
    .map((score) => `${score.category}: ${score.rationale}`);

  return {
    strengths: strengths.slice(0, 5),
    risks: risks.slice(0, 6)
  };
}

export function calculateTotalScore(scores: RubricScore[]): number {
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  const max = scores.reduce((sum, item) => sum + item.maxScore, 0);
  if (max === 0) {
    return 0;
  }
  return Math.round((total / max) * 100);
}

export function evaluateDeterministicRubric(input: DeterministicGradingInput): DeterministicGradingOutput {
  const warnings = validateArchitectureTopology(input.components, input.edges);

  const categoryScores: GradeCategoryScore[] = [
    scoreRequirements(input.notes),
    scoreHighLevelArchitecture(input.components, input.edges),
    scoreDataModel(input.components, input.trafficProfile),
    scoreScalability(input.components, input.trafficProfile),
    scoreReliability(input.components, warnings),
    scoreBottleneckIdentification(input.components, warnings),
    scoreTradeoffReasoning(input.notes)
  ];

  const overallScore = weightedOverallScore(categoryScores);
  const actionItems = buildActionItems(warnings, input.components, input.trafficProfile, input.notes);
  const { strengths, risks } = deriveStrengthsAndRisks(categoryScores);

  return {
    overallScore,
    categoryScores,
    strengths,
    risks,
    deterministicNotes: [
      `Components evaluated: ${input.components.length}`,
      `Edges evaluated: ${input.edges.length}`,
      `Topology warnings: ${warnings.length}`
    ],
    actionItems
  };
}
