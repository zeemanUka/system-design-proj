import { z } from 'zod';

export const signupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

export const onboardingRequestSchema = z.object({
  role: z.string().min(2).max(100),
  targetCompanies: z.array(z.string().min(1)).max(20),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  scenarioPreferences: z.array(z.string().min(1)).max(20)
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  onboardingCompleted: z.boolean(),
  role: z.string().nullable(),
  targetCompanies: z.array(z.string()),
  level: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
  scenarioPreferences: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const scenarioSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  domain: z.string(),
  estimatedMinutes: z.number().int().positive(),
  expectedRps: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const createProjectRequestSchema = z.object({
  scenarioId: z.string().uuid(),
  title: z.string().min(3).max(160).optional()
});

export const createVersionRequestSchema = z.object({
  parentVersionId: z.string().uuid().optional(),
  notes: z.string().max(500).optional()
});

export const trafficProfileSchema = z
  .object({
    baselineRps: z.number().int().positive().max(10_000_000),
    peakMultiplier: z.number().min(1).max(50),
    readPercentage: z.number().min(0).max(100),
    writePercentage: z.number().min(0).max(100),
    payloadKb: z.number().positive().max(10_000),
    regionDistribution: z.object({
      usEast: z.number().min(0).max(100),
      usWest: z.number().min(0).max(100),
      europe: z.number().min(0).max(100),
      apac: z.number().min(0).max(100)
    }),
    burstiness: z.enum(['steady', 'spiky', 'extreme'])
  })
  .superRefine((profile, context) => {
    const rwTotal = profile.readPercentage + profile.writePercentage;
    if (Math.abs(rwTotal - 100) > 0.001) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['readPercentage'],
        message: 'Read and write percentages must sum to 100.'
      });
    }

    const regionTotal =
      profile.regionDistribution.usEast +
      profile.regionDistribution.usWest +
      profile.regionDistribution.europe +
      profile.regionDistribution.apac;

    if (Math.abs(regionTotal - 100) > 0.001) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['regionDistribution'],
        message: 'Region distribution must sum to 100.'
      });
    }
  });

export const componentTypeSchema = z.enum([
  'client',
  'load-balancer',
  'api-gateway',
  'service',
  'cache',
  'database',
  'queue',
  'cdn',
  'object-store'
]);

export const architectureComponentSchema = z.object({
  id: z.string().min(1),
  type: componentTypeSchema,
  label: z.string().min(1).max(120),
  position: z.object({
    x: z.number().min(0).max(5000),
    y: z.number().min(0).max(5000)
  }),
  capacity: z.object({
    opsPerSecond: z.number().positive(),
    cpuCores: z.number().positive(),
    memoryGb: z.number().positive()
  }),
  scaling: z.object({
    replicas: z.number().int().positive(),
    verticalTier: z.enum(['small', 'medium', 'large', 'xlarge'])
  }),
  behavior: z.object({
    stateful: z.boolean()
  })
});

export const architectureEdgeSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1)
});

export const topologyWarningSchema = z.object({
  code: z.enum(['SPOF', 'DISCONNECTED_NODE', 'INVALID_LINK']),
  message: z.string(),
  nodeId: z.string().nullable(),
  edgeId: z.string().nullable()
});

export const projectVersionSummarySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentVersionId: z.string().uuid().nullable(),
  versionNumber: z.number().int().positive(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const projectSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  title: z.string(),
  scenarioTitle: z.string(),
  scenarioDifficulty: z.string(),
  scenarioDomain: z.string(),
  versionCount: z.number().int().nonnegative(),
  latestVersionNumber: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const projectAccessRoleSchema = z.enum(['owner', 'editor', 'viewer']);

export const projectMemberRoleSchema = z.enum(['editor', 'viewer']);

export const projectInviteStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);

export const projectOwnerSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.literal('owner')
});

export const projectMemberSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  role: projectMemberRoleSchema,
  invitedById: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const projectInviteSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  email: z.string().email(),
  role: projectMemberRoleSchema,
  status: projectInviteStatusSchema,
  token: z.string().min(16).max(128),
  invitedById: z.string().uuid(),
  acceptedById: z.string().uuid().nullable(),
  acceptedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const projectMembersResponseSchema = z.object({
  owner: projectOwnerSchema,
  members: z.array(projectMemberSchema),
  invites: z.array(projectInviteSchema)
});

export const createProjectInviteRequestSchema = z.object({
  email: z.string().email(),
  role: projectMemberRoleSchema.optional()
});

export const updateProjectMemberRequestSchema = z.object({
  role: projectMemberRoleSchema
});

export const sharedProjectSummarySchema = projectSummarySchema.extend({
  accessRole: projectAccessRoleSchema,
  ownerEmail: z.string().email(),
  pendingInviteCount: z.number().int().nonnegative()
});

export const sharedProjectsResponseSchema = z.object({
  projects: z.array(sharedProjectSummarySchema)
});

export const acceptProjectInviteResponseSchema = z.object({
  projectId: z.string().uuid(),
  role: projectAccessRoleSchema
});

export const projectHistoryResponseSchema = z.object({
  project: projectSummarySchema,
  versions: z.array(projectVersionSummarySchema)
});

export const versionDetailSchema = projectVersionSummarySchema.extend({
  components: z.array(architectureComponentSchema),
  edges: z.array(architectureEdgeSchema),
  trafficProfile: trafficProfileSchema,
  warnings: z.array(topologyWarningSchema)
});

export const updateVersionRequestSchema = z.object({
  components: z.array(architectureComponentSchema),
  edges: z.array(architectureEdgeSchema),
  notes: z.string().max(500).nullable().optional(),
  trafficProfile: trafficProfileSchema.optional(),
  lastKnownUpdatedAt: z.string().min(1).optional()
});

export const commentStatusSchema = z.enum(['open', 'resolved']);

export const versionCommentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  nodeId: z.string().min(1).max(120),
  authorId: z.string().uuid(),
  authorEmail: z.string().email(),
  body: z.string().min(1).max(2000),
  mentionUserIds: z.array(z.string().uuid()),
  status: commentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const listVersionCommentsResponseSchema = z.object({
  comments: z.array(versionCommentSchema)
});

export const createVersionCommentRequestSchema = z.object({
  nodeId: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  mentionUserIds: z.array(z.string().uuid()).max(20).optional()
});

export const updateVersionCommentRequestSchema = z
  .object({
    body: z.string().min(1).max(2000).optional(),
    status: commentStatusSchema.optional()
  })
  .refine((value) => value.body !== undefined || value.status !== undefined, {
    message: 'At least one field must be provided.'
  });

export const updateTrafficProfileRequestSchema = z.object({
  trafficProfile: trafficProfileSchema
});

export const versionTrafficProfileResponseSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  trafficProfile: trafficProfileSchema,
  updatedAt: z.string()
});

export const simulationRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const simulationEventSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const simulationBottleneckSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const failureInjectionModeSchema = z.enum([
  'node-down',
  'az-down',
  'dependency-lag',
  'traffic-surge'
]);

export const simulationInputContractSchema = z.object({
  components: z.array(architectureComponentSchema),
  edges: z.array(architectureEdgeSchema),
  trafficProfile: trafficProfileSchema
});

export const simulationMetricsSchema = z.object({
  peakRps: z.number().nonnegative(),
  capacityRps: z.number().nonnegative(),
  throughputRps: z.number().nonnegative(),
  p50LatencyMs: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  errorRatePercent: z.number().min(0).max(100),
  saturated: z.boolean()
});

export const simulationBottleneckSchema = z.object({
  componentId: z.string().min(1),
  componentLabel: z.string().min(1),
  componentType: componentTypeSchema,
  utilizationPercent: z.number().nonnegative(),
  requiredRps: z.number().nonnegative(),
  capacityRps: z.number().nonnegative(),
  severity: simulationBottleneckSeveritySchema,
  reason: z.string()
});

export const simulationTimelineEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  atSecond: z.number().int().nonnegative(),
  severity: simulationEventSeveritySchema,
  title: z.string(),
  description: z.string(),
  componentId: z.string().nullable()
});

export const simulationComputationResultSchema = z.object({
  metrics: simulationMetricsSchema,
  bottlenecks: z.array(simulationBottleneckSchema),
  timeline: z.array(simulationTimelineEventSchema)
});

export const failureInjectionProfileSchema = z
  .object({
    mode: failureInjectionModeSchema,
    targetComponentId: z.string().min(1).nullable().optional(),
    azName: z.enum(['az-a', 'az-b']).nullable().optional(),
    lagMs: z.number().int().min(50).max(5000).optional(),
    surgeMultiplier: z.number().min(1.1).max(10).optional()
  })
  .superRefine((profile, context) => {
    if (profile.mode === 'node-down' && !profile.targetComponentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetComponentId'],
        message: 'targetComponentId is required for node-down mode.'
      });
    }

    if (profile.mode === 'dependency-lag' && !profile.targetComponentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetComponentId'],
        message: 'targetComponentId is required for dependency-lag mode.'
      });
    }

    if (profile.mode === 'dependency-lag' && !profile.lagMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lagMs'],
        message: 'lagMs is required for dependency-lag mode.'
      });
    }

    if (profile.mode === 'traffic-surge' && !profile.surgeMultiplier) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['surgeMultiplier'],
        message: 'surgeMultiplier is required for traffic-surge mode.'
      });
    }

    if (profile.mode === 'az-down' && !profile.azName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['azName'],
        message: 'azName is required for az-down mode.'
      });
    }
  });

export const failureImpactComponentSchema = z.object({
  componentId: z.string().min(1),
  componentLabel: z.string().min(1),
  componentType: componentTypeSchema,
  severity: simulationBottleneckSeveritySchema,
  reason: z.string()
});

export const blastRadiusSummarySchema = z.object({
  mode: failureInjectionModeSchema,
  impactedComponents: z.array(failureImpactComponentSchema),
  impactedCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  estimatedUserImpactPercent: z.number().min(0).max(100),
  summary: z.string()
});

export const failureInjectionRequestSchema = z.object({
  profile: failureInjectionProfileSchema
});

export const simulationRunSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  baselineRunId: z.string().uuid().nullable(),
  failureProfile: failureInjectionProfileSchema.nullable(),
  blastRadius: blastRadiusSummarySchema.nullable(),
  status: simulationRunStatusSchema,
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  metrics: simulationMetricsSchema.nullable(),
  bottlenecks: z.array(simulationBottleneckSchema),
  events: z.array(simulationTimelineEventSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const simulationRunResponseSchema = z.object({
  run: simulationRunSchema
});

export const simulationRunQueueJobSchema = z.object({
  runId: z.string().uuid()
});

export const gradeReportStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const gradePrioritySchema = z.enum(['P0', 'P1', 'P2']);

export const gradeCategorySchema = z.enum([
  'requirements-clarification',
  'high-level-architecture',
  'data-model-access-patterns',
  'scalability-decisions',
  'reliability-fault-tolerance',
  'bottleneck-identification',
  'tradeoff-reasoning'
]);

export const gradeCategoryScoreSchema = z.object({
  category: gradeCategorySchema,
  weight: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(1).max(100),
  rationale: z.string(),
  evidence: z.array(z.string())
});

export const gradeActionItemSchema = z.object({
  priority: gradePrioritySchema,
  title: z.string(),
  description: z.string(),
  evidence: z.array(z.string())
});

export const gradeReportSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  status: gradeReportStatusSchema,
  overallScore: z.number().int().min(0).max(100).nullable(),
  summary: z.string().nullable(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  deterministicNotes: z.array(z.string()),
  categoryScores: z.array(gradeCategoryScoreSchema),
  actionItems: z.array(gradeActionItemSchema),
  aiProvider: z.string().nullable(),
  aiModel: z.string().nullable(),
  failureReason: z.string().nullable(),
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const gradeReportResponseSchema = z.object({
  report: gradeReportSchema
});

export const gradeRunQueueJobSchema = z.object({
  gradeReportId: z.string().uuid()
});

export const compareVersionsQuerySchema = z.object({
  baselineVersionId: z.string().uuid(),
  candidateVersionId: z.string().uuid()
});

export const compareComponentSnapshotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: componentTypeSchema
});

export const compareVersionRunSnapshotSchema = z.object({
  runId: z.string().uuid(),
  status: simulationRunStatusSchema,
  throughputRps: z.number().nonnegative(),
  capacityRps: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  errorRatePercent: z.number().min(0).max(100),
  bottleneckCount: z.number().int().nonnegative(),
  completedAt: z.string().nullable()
});

export const compareVersionGradeSnapshotSchema = z.object({
  gradeReportId: z.string().uuid(),
  overallScore: z.number().int().min(0).max(100),
  completedAt: z.string().nullable(),
  categoryScores: z.array(gradeCategoryScoreSchema)
});

export const compareVersionSnapshotSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  componentCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  warnings: z.array(topologyWarningSchema),
  trafficProfile: trafficProfileSchema,
  latestSimulation: compareVersionRunSnapshotSchema.nullable(),
  latestGrade: compareVersionGradeSnapshotSchema.nullable()
});

export const compareMetricDeltaSchema = z.object({
  baseline: z.number().nullable(),
  candidate: z.number().nullable(),
  absoluteDelta: z.number().nullable(),
  percentDelta: z.number().nullable()
});

export const compareRubricDeltaSchema = z.object({
  category: gradeCategorySchema,
  baselineScore: z.number().nullable(),
  candidateScore: z.number().nullable(),
  delta: z.number().nullable()
});

export const compareArchitectureDeltaSchema = z.object({
  componentCountDelta: z.number().int(),
  edgeCountDelta: z.number().int(),
  warningCountDelta: z.number().int(),
  addedComponents: z.array(compareComponentSnapshotSchema),
  removedComponents: z.array(compareComponentSnapshotSchema),
  addedConnections: z.array(z.string()),
  removedConnections: z.array(z.string())
});

export const versionCompareResultSchema = z.object({
  projectId: z.string().uuid(),
  baselineVersion: compareVersionSnapshotSchema,
  candidateVersion: compareVersionSnapshotSchema,
  architectureDelta: compareArchitectureDeltaSchema,
  kpiDeltas: z.object({
    throughputRps: compareMetricDeltaSchema,
    p95LatencyMs: compareMetricDeltaSchema,
    errorRatePercent: compareMetricDeltaSchema,
    overallScore: compareMetricDeltaSchema
  }),
  rubricDeltas: z.array(compareRubricDeltaSchema),
  generatedAt: z.string()
});

export const versionCompareResponseSchema = z.object({
  compare: versionCompareResultSchema
});

export const reportProgressVerdictSchema = z.enum(['improved', 'regressed', 'mixed', 'insufficient-data']);

export const reportSummarySchema = z.object({
  progressVerdict: reportProgressVerdictSchema,
  headline: z.string(),
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendedActions: z.array(gradeActionItemSchema)
});

export const projectReportSchema = z.object({
  projectId: z.string().uuid(),
  baselineVersionId: z.string().uuid(),
  candidateVersionId: z.string().uuid(),
  generatedAt: z.string(),
  compare: versionCompareResultSchema,
  summary: reportSummarySchema
});

export const projectReportResponseSchema = z.object({
  report: projectReportSchema
});

export const createReportExportRequestSchema = z.object({
  baselineVersionId: z.string().uuid().optional(),
  candidateVersionId: z.string().uuid().optional()
});

export const reportExportSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  baselineVersionId: z.string().uuid(),
  candidateVersionId: z.string().uuid(),
  format: z.literal('pdf'),
  fileName: z.string(),
  downloadPath: z.string(),
  shareToken: z.string().nullable(),
  shareUrl: z.string().nullable(),
  shareRevokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const reportExportResponseSchema = z.object({
  export: reportExportSchema,
  report: projectReportSchema
});

export const createReportShareRequestSchema = z.object({
  exportId: z.string().uuid()
});

export const reportShareResponseSchema = z.object({
  export: reportExportSchema,
  report: projectReportSchema
});

export const sharedReportResponseSchema = z.object({
  export: reportExportSchema,
  report: projectReportSchema
});

export const frontendMetricNameSchema = z.enum([
  'LCP',
  'INP',
  'CLS',
  'TTFB',
  'FCP',
  'route-change'
]);

export const frontendMetricRatingSchema = z.enum(['good', 'needs-improvement', 'poor']);

export const frontendMetricSchema = z.object({
  name: frontendMetricNameSchema,
  value: z.number().nonnegative(),
  path: z.string().min(1),
  rating: frontendMetricRatingSchema.optional(),
  navigationType: z.string().optional()
});

export const frontendMetricRequestSchema = z.object({
  metric: frontendMetricSchema
});

export const createProjectResponseSchema = z.object({
  project: projectSummarySchema,
  initialVersion: projectVersionSummarySchema
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateVersionRequest = z.infer<typeof createVersionRequestSchema>;
export type ProjectVersionSummary = z.infer<typeof projectVersionSummarySchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectAccessRole = z.infer<typeof projectAccessRoleSchema>;
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;
export type ProjectInviteStatus = z.infer<typeof projectInviteStatusSchema>;
export type ProjectOwner = z.infer<typeof projectOwnerSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectInvite = z.infer<typeof projectInviteSchema>;
export type ProjectMembersResponse = z.infer<typeof projectMembersResponseSchema>;
export type CreateProjectInviteRequest = z.infer<typeof createProjectInviteRequestSchema>;
export type UpdateProjectMemberRequest = z.infer<typeof updateProjectMemberRequestSchema>;
export type SharedProjectSummary = z.infer<typeof sharedProjectSummarySchema>;
export type SharedProjectsResponse = z.infer<typeof sharedProjectsResponseSchema>;
export type AcceptProjectInviteResponse = z.infer<typeof acceptProjectInviteResponseSchema>;
export type ProjectHistoryResponse = z.infer<typeof projectHistoryResponseSchema>;
export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;
export type ComponentType = z.infer<typeof componentTypeSchema>;
export type ArchitectureComponent = z.infer<typeof architectureComponentSchema>;
export type ArchitectureEdge = z.infer<typeof architectureEdgeSchema>;
export type TopologyWarning = z.infer<typeof topologyWarningSchema>;
export type VersionDetail = z.infer<typeof versionDetailSchema>;
export type UpdateVersionRequest = z.infer<typeof updateVersionRequestSchema>;
export type CommentStatus = z.infer<typeof commentStatusSchema>;
export type VersionComment = z.infer<typeof versionCommentSchema>;
export type ListVersionCommentsResponse = z.infer<typeof listVersionCommentsResponseSchema>;
export type CreateVersionCommentRequest = z.infer<typeof createVersionCommentRequestSchema>;
export type UpdateVersionCommentRequest = z.infer<typeof updateVersionCommentRequestSchema>;
export type TrafficProfile = z.infer<typeof trafficProfileSchema>;
export type UpdateTrafficProfileRequest = z.infer<typeof updateTrafficProfileRequestSchema>;
export type VersionTrafficProfileResponse = z.infer<typeof versionTrafficProfileResponseSchema>;
export type SimulationRunStatus = z.infer<typeof simulationRunStatusSchema>;
export type SimulationEventSeverity = z.infer<typeof simulationEventSeveritySchema>;
export type SimulationBottleneckSeverity = z.infer<typeof simulationBottleneckSeveritySchema>;
export type FailureInjectionMode = z.infer<typeof failureInjectionModeSchema>;
export type SimulationInputContract = z.infer<typeof simulationInputContractSchema>;
export type SimulationMetrics = z.infer<typeof simulationMetricsSchema>;
export type SimulationBottleneck = z.infer<typeof simulationBottleneckSchema>;
export type SimulationTimelineEvent = z.infer<typeof simulationTimelineEventSchema>;
export type SimulationComputationResult = z.infer<typeof simulationComputationResultSchema>;
export type FailureInjectionProfile = z.infer<typeof failureInjectionProfileSchema>;
export type FailureImpactComponent = z.infer<typeof failureImpactComponentSchema>;
export type BlastRadiusSummary = z.infer<typeof blastRadiusSummarySchema>;
export type FailureInjectionRequest = z.infer<typeof failureInjectionRequestSchema>;
export type SimulationRun = z.infer<typeof simulationRunSchema>;
export type SimulationRunResponse = z.infer<typeof simulationRunResponseSchema>;
export type SimulationRunQueueJob = z.infer<typeof simulationRunQueueJobSchema>;
export type GradeReportStatus = z.infer<typeof gradeReportStatusSchema>;
export type GradePriority = z.infer<typeof gradePrioritySchema>;
export type GradeCategory = z.infer<typeof gradeCategorySchema>;
export type GradeCategoryScore = z.infer<typeof gradeCategoryScoreSchema>;
export type GradeActionItem = z.infer<typeof gradeActionItemSchema>;
export type GradeReport = z.infer<typeof gradeReportSchema>;
export type GradeReportResponse = z.infer<typeof gradeReportResponseSchema>;
export type GradeRunQueueJob = z.infer<typeof gradeRunQueueJobSchema>;
export type CompareVersionsQuery = z.infer<typeof compareVersionsQuerySchema>;
export type CompareComponentSnapshot = z.infer<typeof compareComponentSnapshotSchema>;
export type CompareVersionRunSnapshot = z.infer<typeof compareVersionRunSnapshotSchema>;
export type CompareVersionGradeSnapshot = z.infer<typeof compareVersionGradeSnapshotSchema>;
export type CompareVersionSnapshot = z.infer<typeof compareVersionSnapshotSchema>;
export type CompareMetricDelta = z.infer<typeof compareMetricDeltaSchema>;
export type CompareRubricDelta = z.infer<typeof compareRubricDeltaSchema>;
export type CompareArchitectureDelta = z.infer<typeof compareArchitectureDeltaSchema>;
export type VersionCompareResult = z.infer<typeof versionCompareResultSchema>;
export type VersionCompareResponse = z.infer<typeof versionCompareResponseSchema>;
export type ReportProgressVerdict = z.infer<typeof reportProgressVerdictSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type ProjectReport = z.infer<typeof projectReportSchema>;
export type ProjectReportResponse = z.infer<typeof projectReportResponseSchema>;
export type CreateReportExportRequest = z.infer<typeof createReportExportRequestSchema>;
export type ReportExport = z.infer<typeof reportExportSchema>;
export type ReportExportResponse = z.infer<typeof reportExportResponseSchema>;
export type CreateReportShareRequest = z.infer<typeof createReportShareRequestSchema>;
export type ReportShareResponse = z.infer<typeof reportShareResponseSchema>;
export type SharedReportResponse = z.infer<typeof sharedReportResponseSchema>;
export type FrontendMetricName = z.infer<typeof frontendMetricNameSchema>;
export type FrontendMetricRating = z.infer<typeof frontendMetricRatingSchema>;
export type FrontendMetric = z.infer<typeof frontendMetricSchema>;
export type FrontendMetricRequest = z.infer<typeof frontendMetricRequestSchema>;

export const trafficProfilePresets = {
  'interview-default': {
    baselineRps: 1500,
    peakMultiplier: 3,
    readPercentage: 80,
    writePercentage: 20,
    payloadKb: 12,
    regionDistribution: {
      usEast: 50,
      usWest: 20,
      europe: 20,
      apac: 10
    },
    burstiness: 'steady'
  },
  'read-heavy': {
    baselineRps: 3000,
    peakMultiplier: 4,
    readPercentage: 95,
    writePercentage: 5,
    payloadKb: 8,
    regionDistribution: {
      usEast: 45,
      usWest: 25,
      europe: 20,
      apac: 10
    },
    burstiness: 'spiky'
  },
  'write-heavy': {
    baselineRps: 2500,
    peakMultiplier: 3,
    readPercentage: 40,
    writePercentage: 60,
    payloadKb: 16,
    regionDistribution: {
      usEast: 55,
      usWest: 20,
      europe: 15,
      apac: 10
    },
    burstiness: 'spiky'
  },
  'global-burst': {
    baselineRps: 4000,
    peakMultiplier: 6,
    readPercentage: 70,
    writePercentage: 30,
    payloadKb: 20,
    regionDistribution: {
      usEast: 30,
      usWest: 20,
      europe: 25,
      apac: 25
    },
    burstiness: 'extreme'
  }
} as const satisfies Record<string, TrafficProfile>;

export type TrafficProfilePresetName = keyof typeof trafficProfilePresets;
export const defaultTrafficProfile: TrafficProfile = trafficProfilePresets['interview-default'];

export type AuthSuccessResponse = {
  token: string;
  user: UserProfile;
};

export function buildSimulationInputContract(
  components: ArchitectureComponent[],
  edges: ArchitectureEdge[],
  trafficProfile: TrafficProfile
): SimulationInputContract {
  return {
    components,
    edges,
    trafficProfile
  };
}

const SPOF_TYPES: ComponentType[] = ['load-balancer', 'api-gateway', 'service', 'database', 'queue'];

export function validateArchitectureTopology(
  components: ArchitectureComponent[],
  edges: ArchitectureEdge[]
): TopologyWarning[] {
  const warnings: TopologyWarning[] = [];
  const componentIds = new Set(components.map((component) => component.id));
  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  const edgeSet = new Set<string>();

  for (const component of components) {
    outgoingCount.set(component.id, 0);
    incomingCount.set(component.id, 0);
    if (SPOF_TYPES.includes(component.type) && component.scaling.replicas < 2) {
      warnings.push({
        code: 'SPOF',
        message: `${component.label} is a single point of failure with only ${component.scaling.replicas} replica.`,
        nodeId: component.id,
        edgeId: null
      });
    }
  }

  for (const edge of edges) {
    if (!componentIds.has(edge.sourceId) || !componentIds.has(edge.targetId)) {
      warnings.push({
        code: 'INVALID_LINK',
        message: `Edge ${edge.id} references missing nodes.`,
        nodeId: null,
        edgeId: edge.id
      });
      continue;
    }

    if (edge.sourceId === edge.targetId) {
      warnings.push({
        code: 'INVALID_LINK',
        message: `Edge ${edge.id} creates a self-loop.`,
        nodeId: edge.sourceId,
        edgeId: edge.id
      });
      continue;
    }

    const edgeKey = `${edge.sourceId}->${edge.targetId}`;
    if (edgeSet.has(edgeKey)) {
      warnings.push({
        code: 'INVALID_LINK',
        message: `Duplicate edge between ${edge.sourceId} and ${edge.targetId}.`,
        nodeId: null,
        edgeId: edge.id
      });
      continue;
    }
    edgeSet.add(edgeKey);

    outgoingCount.set(edge.sourceId, (outgoingCount.get(edge.sourceId) ?? 0) + 1);
    incomingCount.set(edge.targetId, (incomingCount.get(edge.targetId) ?? 0) + 1);
  }

  if (components.length > 1 && edges.length === 0) {
    warnings.push({
      code: 'DISCONNECTED_NODE',
      message: 'No edges found. Components are disconnected.',
      nodeId: null,
      edgeId: null
    });
  }

  for (const component of components) {
    const inbound = incomingCount.get(component.id) ?? 0;
    const outbound = outgoingCount.get(component.id) ?? 0;

    if (component.type !== 'client' && inbound === 0) {
      warnings.push({
        code: 'DISCONNECTED_NODE',
        message: `${component.label} has no inbound dependencies.`,
        nodeId: component.id,
        edgeId: null
      });
    }

    if (component.type !== 'database' && component.type !== 'object-store' && outbound === 0) {
      warnings.push({
        code: 'DISCONNECTED_NODE',
        message: `${component.label} has no outbound dependency.`,
        nodeId: component.id,
        edgeId: null
      });
    }
  }

  return warnings;
}
