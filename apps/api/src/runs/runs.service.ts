import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { applyFailureInjection } from '@sdc/simulation-core';
import {
  ArchitectureComponent,
  ArchitectureEdge,
  FailureInjectionProfile,
  SimulationRun,
  SimulationRunResponse,
  TrafficProfile,
  architectureComponentSchema,
  architectureEdgeSchema,
  blastRadiusSummarySchema,
  defaultTrafficProfile,
  failureInjectionProfileSchema,
  simulationBottleneckSchema,
  simulationEventSeveritySchema,
  simulationInputContractSchema,
  simulationMetricsSchema,
  simulationRunStatusSchema,
  trafficProfileSchema
} from '@sdc/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulationQueueService } from './simulation-queue.service.js';

type SimulationRunRecord = Prisma.SimulationRunGetPayload<{
  include: {
    events: {
      orderBy: {
        sequence: 'asc';
      };
    };
    project: {
      select: {
        userId: true;
      };
    };
  };
}>;

@Injectable()
export class RunsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SimulationQueueService) private readonly simulationQueue: SimulationQueueService
  ) {}

  async queueSimulationRun(userId: string, versionId: string): Promise<SimulationRunResponse> {
    const version = await this.prisma.architectureVersion.findUnique({
      where: { id: versionId },
      include: {
        project: {
          select: {
            id: true,
            userId: true
          }
        }
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found.');
    }

    if (version.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this version.');
    }

    const inputContract = simulationInputContractSchema.parse({
      components: this.toComponentArray(version.components),
      edges: this.toEdgeArray(version.edges),
      trafficProfile: this.toTrafficProfile(version.trafficProfile)
    });

    const createdRun = await this.prisma.simulationRun.create({
      data: {
        projectId: version.projectId,
        versionId: version.id,
        status: 'pending',
        inputContract: inputContract as unknown as Prisma.InputJsonValue,
        bottlenecks: [] as unknown as Prisma.InputJsonValue,
        events: {
          create: {
            sequence: 0,
            atSecond: 0,
            severity: 'info',
            title: 'Run queued',
            description: 'Simulation run is waiting for worker capacity.',
            componentId: null
          }
        }
      },
      include: {
        events: {
          orderBy: {
            sequence: 'asc'
          }
        },
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    try {
      await this.simulationQueue.enqueueSimulationRun({ runId: createdRun.id });
    } catch {
      const failedRun = await this.prisma.simulationRun.update({
        where: { id: createdRun.id },
        data: {
          status: 'failed',
          failureReason: 'Failed to enqueue simulation job.',
          completedAt: new Date(),
          events: {
            create: {
              sequence: createdRun.events.length,
              atSecond: 0,
              severity: 'critical',
              title: 'Queue failure',
              description: 'The run could not be sent to the simulation queue.',
              componentId: null
            }
          }
        },
        include: {
          events: {
            orderBy: {
              sequence: 'asc'
            }
          },
          project: {
            select: {
              userId: true
            }
          }
        }
      });

      return {
        run: this.toSimulationRun(failedRun)
      };
    }

    return {
      run: this.toSimulationRun(createdRun)
    };
  }

  async getSimulationRun(userId: string, runId: string): Promise<SimulationRunResponse> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      include: {
        events: {
          orderBy: {
            sequence: 'asc'
          }
        },
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!run) {
      throw new NotFoundException('Simulation run not found.');
    }

    if (run.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this run.');
    }

    return {
      run: this.toSimulationRun(run)
    };
  }

  async queueFailureInjectionRun(
    userId: string,
    baselineRunId: string,
    profile: FailureInjectionProfile
  ): Promise<SimulationRunResponse> {
    const baselineRun = await this.prisma.simulationRun.findUnique({
      where: { id: baselineRunId },
      include: {
        events: {
          orderBy: {
            sequence: 'asc'
          }
        },
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!baselineRun) {
      throw new NotFoundException('Baseline simulation run not found.');
    }

    if (baselineRun.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this run.');
    }

    if (baselineRun.status !== 'completed') {
      throw new BadRequestException('Baseline run must be completed before failure injection.');
    }

    const parsedProfile = failureInjectionProfileSchema.safeParse(profile);
    if (!parsedProfile.success) {
      throw new BadRequestException(parsedProfile.error.flatten());
    }

    const parsedInput = simulationInputContractSchema.safeParse(baselineRun.inputContract);
    if (!parsedInput.success) {
      throw new BadRequestException('Baseline run has invalid input contract.');
    }

    const injectedInput = applyFailureInjection(parsedInput.data, parsedProfile.data);
    if (
      (parsedProfile.data.mode === 'node-down' || parsedProfile.data.mode === 'dependency-lag') &&
      injectedInput.impactedComponentIds.length === 0
    ) {
      throw new BadRequestException('targetComponentId was not found in baseline architecture.');
    }

    const createdRun = await this.prisma.simulationRun.create({
      data: {
        projectId: baselineRun.projectId,
        versionId: baselineRun.versionId,
        baselineRunId: baselineRun.id,
        status: 'pending',
        inputContract: parsedInput.data as unknown as Prisma.InputJsonValue,
        failureProfile: parsedProfile.data as unknown as Prisma.InputJsonValue,
        bottlenecks: [] as unknown as Prisma.InputJsonValue,
        events: {
          create: [
            {
              sequence: 0,
              atSecond: 0,
              severity: 'info',
              title: 'Failure injection queued',
              description: `Queued ${parsedProfile.data.mode} against baseline run ${baselineRun.id}.`,
              componentId: parsedProfile.data.targetComponentId ?? null
            },
            ...injectedInput.notes.map((note, index) => ({
              sequence: index + 1,
              atSecond: 1 + index,
              severity: 'warning' as const,
              title: 'Injected condition',
              description: note,
              componentId: parsedProfile.data.targetComponentId ?? null
            }))
          ]
        }
      },
      include: {
        events: {
          orderBy: {
            sequence: 'asc'
          }
        },
        project: {
          select: {
            userId: true
          }
        }
      }
    });

    try {
      await this.simulationQueue.enqueueSimulationRun({ runId: createdRun.id });
    } catch {
      const failedRun = await this.prisma.simulationRun.update({
        where: { id: createdRun.id },
        data: {
          status: 'failed',
          failureReason: 'Failed to enqueue failure injection job.',
          completedAt: new Date(),
          events: {
            create: {
              sequence: createdRun.events.length,
              atSecond: 0,
              severity: 'critical',
              title: 'Queue failure',
              description: 'The failure injection run could not be sent to the simulation queue.',
              componentId: parsedProfile.data.targetComponentId ?? null
            }
          }
        },
        include: {
          events: {
            orderBy: {
              sequence: 'asc'
            }
          },
          project: {
            select: {
              userId: true
            }
          }
        }
      });

      return {
        run: this.toSimulationRun(failedRun)
      };
    }

    return {
      run: this.toSimulationRun(createdRun)
    };
  }

  private toSimulationRun(run: SimulationRunRecord): SimulationRun {
    const status = simulationRunStatusSchema.safeParse(run.status);
    const metrics = simulationMetricsSchema.safeParse(run.metrics);
    const bottlenecks = simulationBottleneckSchema.array().safeParse(run.bottlenecks);
    const failureProfile = failureInjectionProfileSchema.safeParse(run.failureProfile);
    const blastRadius = blastRadiusSummarySchema.safeParse(run.blastRadius);

    return {
      id: run.id,
      projectId: run.projectId,
      versionId: run.versionId,
      baselineRunId: run.baselineRunId,
      failureProfile: failureProfile.success ? failureProfile.data : null,
      blastRadius: blastRadius.success ? blastRadius.data : null,
      status: status.success ? status.data : 'failed',
      queuedAt: run.queuedAt.toISOString(),
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      failureReason: run.failureReason,
      metrics: metrics.success ? metrics.data : null,
      bottlenecks: bottlenecks.success ? bottlenecks.data : [],
      events: run.events.map((event, index) => {
        const severity = simulationEventSeveritySchema.safeParse(event.severity);
        return {
          sequence: event.sequence ?? index,
          atSecond: event.atSecond,
          severity: severity.success ? severity.data : 'info',
          title: event.title,
          description: event.description,
          componentId: event.componentId
        };
      }),
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString()
    };
  }

  private toComponentArray(value: Prisma.JsonValue): ArchitectureComponent[] {
    const parsed = architectureComponentSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  }

  private toEdgeArray(value: Prisma.JsonValue): ArchitectureEdge[] {
    const parsed = architectureEdgeSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  }

  private toTrafficProfile(value: Prisma.JsonValue | null): TrafficProfile {
    const parsed = trafficProfileSchema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }
    return defaultTrafficProfile;
  }
}
