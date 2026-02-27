import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ArchitectureComponent,
  ArchitectureEdge,
  CreateProjectRequest,
  CreateProjectResponse,
  CreateVersionRequest,
  ProjectHistoryResponse,
  ProjectSummary,
  ProjectVersionSummary,
  TrafficProfile,
  UpdateVersionRequest,
  VersionDetail,
  VersionTrafficProfileResponse,
  architectureComponentSchema,
  architectureEdgeSchema,
  defaultTrafficProfile,
  trafficProfileSchema,
  validateArchitectureTopology
} from '@sdc/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

type ProjectSummaryRecord = Prisma.ProjectGetPayload<{
  include: {
    scenario: true;
    versions: {
      orderBy: { versionNumber: 'desc' };
      take: 1;
    };
    _count: {
      select: {
        versions: true;
      };
    };
  };
}>;

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProjects(userId: string, limit: number): Promise<ProjectSummary[]> {
    const safeLimit = Math.max(1, Math.min(limit, 50));

    const projects = await this.prisma.project.findMany({
      where: { userId },
      include: {
        scenario: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: safeLimit
    });

    return projects.map((project) => this.toProjectSummary(project));
  }

  async createProject(userId: string, input: CreateProjectRequest): Promise<CreateProjectResponse> {
    const scenario = await this.prisma.scenario.findFirst({
      where: {
        id: input.scenarioId,
        isActive: true
      }
    });

    if (!scenario) {
      throw new NotFoundException('Scenario not found.');
    }

    const title = input.title?.trim() || `${scenario.title} Practice`;

    const project = await this.prisma.project.create({
      data: {
        userId,
        scenarioId: scenario.id,
        title,
        versions: {
          create: {
            versionNumber: 1,
            notes: 'Initial version'
          }
        }
      },
      include: {
        scenario: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      }
    });

    const initialVersion = project.versions[0];
    if (!initialVersion) {
      throw new NotFoundException('Initial version was not created.');
    }

    return {
      project: this.toProjectSummary(project),
      initialVersion: this.toVersionSummary(initialVersion)
    };
  }

  async createVersion(
    userId: string,
    projectId: string,
    input: CreateVersionRequest
  ): Promise<ProjectVersionSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project.');
    }

    const latestVersion = project.versions[0] ?? null;
    let baseVersion = latestVersion;

    if (input.parentVersionId) {
      const parent = await this.prisma.architectureVersion.findUnique({
        where: { id: input.parentVersionId }
      });

      if (!parent || parent.projectId !== project.id) {
        throw new NotFoundException('Parent version not found for this project.');
      }

      baseVersion = parent;
    }

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const createdVersion = await this.prisma.architectureVersion.create({
      data: {
        projectId: project.id,
        parentVersionId: baseVersion?.id ?? null,
        versionNumber: nextVersionNumber,
        components: (baseVersion?.components as Prisma.InputJsonValue | undefined) ?? [],
        edges: (baseVersion?.edges as Prisma.InputJsonValue | undefined) ?? [],
        trafficProfile: this.toTrafficProfile(baseVersion?.trafficProfile ?? null) as Prisma.InputJsonValue,
        notes: input.notes ?? null
      }
    });

    return this.toVersionSummary(createdVersion);
  }

  async getProjectHistory(userId: string, projectId: string): Promise<ProjectHistoryResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        scenario: true,
        versions: {
          orderBy: { versionNumber: 'desc' }
        },
        _count: {
          select: {
            versions: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project.');
    }

    return {
      project: this.toProjectSummary(project),
      versions: project.versions.map((version) => this.toVersionSummary(version))
    };
  }

  async getVersion(userId: string, projectId: string, versionId: string): Promise<VersionDetail> {
    await this.assertProjectOwnership(userId, projectId);

    const version = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found for this project.');
    }

    return this.toVersionDetail(version);
  }

  async updateVersion(
    userId: string,
    projectId: string,
    versionId: string,
    input: UpdateVersionRequest
  ): Promise<VersionDetail> {
    await this.assertProjectOwnership(userId, projectId);

    const existingVersion = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      }
    });

    if (!existingVersion) {
      throw new NotFoundException('Version not found for this project.');
    }

    const updatedVersion = await this.prisma.architectureVersion.update({
      where: { id: existingVersion.id },
      data: {
        components: input.components as unknown as Prisma.InputJsonValue,
        edges: input.edges as unknown as Prisma.InputJsonValue,
        trafficProfile:
          input.trafficProfile !== undefined
            ? (input.trafficProfile as unknown as Prisma.InputJsonValue)
            : (this.toTrafficProfile(existingVersion.trafficProfile) as unknown as Prisma.InputJsonValue),
        notes: input.notes !== undefined ? input.notes : existingVersion.notes
      }
    });

    return this.toVersionDetail(updatedVersion);
  }

  async getVersionTrafficProfile(
    userId: string,
    projectId: string,
    versionId: string
  ): Promise<VersionTrafficProfileResponse> {
    await this.assertProjectOwnership(userId, projectId);

    const version = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found for this project.');
    }

    return {
      projectId: version.projectId,
      versionId: version.id,
      trafficProfile: this.toTrafficProfile(version.trafficProfile),
      updatedAt: version.updatedAt.toISOString()
    };
  }

  async updateVersionTrafficProfile(
    userId: string,
    projectId: string,
    versionId: string,
    trafficProfile: TrafficProfile
  ): Promise<VersionTrafficProfileResponse> {
    await this.assertProjectOwnership(userId, projectId);

    const version = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found for this project.');
    }

    const updatedVersion = await this.prisma.architectureVersion.update({
      where: { id: version.id },
      data: {
        trafficProfile: trafficProfile as unknown as Prisma.InputJsonValue
      }
    });

    return {
      projectId: updatedVersion.projectId,
      versionId: updatedVersion.id,
      trafficProfile: this.toTrafficProfile(updatedVersion.trafficProfile),
      updatedAt: updatedVersion.updatedAt.toISOString()
    };
  }

  private async assertProjectOwnership(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        userId: true
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project.');
    }
  }

  private toProjectSummary(project: ProjectSummaryRecord): ProjectSummary {
    return {
      id: project.id,
      userId: project.userId,
      scenarioId: project.scenarioId,
      title: project.title,
      scenarioTitle: project.scenario.title,
      scenarioDifficulty: project.scenario.difficulty,
      scenarioDomain: project.scenario.domain,
      versionCount: project._count.versions,
      latestVersionNumber: project.versions[0]?.versionNumber ?? 0,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    };
  }

  private toVersionSummary(version: {
    id: string;
    projectId: string;
    parentVersionId: string | null;
    versionNumber: number;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectVersionSummary {
    return {
      id: version.id,
      projectId: version.projectId,
      parentVersionId: version.parentVersionId,
      versionNumber: version.versionNumber,
      notes: version.notes,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString()
    };
  }

  private toVersionDetail(version: {
    id: string;
    projectId: string;
    parentVersionId: string | null;
    versionNumber: number;
    components: Prisma.JsonValue;
    edges: Prisma.JsonValue;
    trafficProfile: Prisma.JsonValue;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): VersionDetail {
    const components = this.toComponentArray(version.components);
    const edges = this.toEdgeArray(version.edges);

    return {
      id: version.id,
      projectId: version.projectId,
      parentVersionId: version.parentVersionId,
      versionNumber: version.versionNumber,
      components,
      edges,
      trafficProfile: this.toTrafficProfile(version.trafficProfile),
      notes: version.notes,
      warnings: validateArchitectureTopology(components, edges),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString()
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
