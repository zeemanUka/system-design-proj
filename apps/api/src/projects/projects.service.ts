import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  AcceptProjectInviteResponse,
  ArchitectureComponent,
  ArchitectureEdge,
  CreateProjectInviteRequest,
  CreateProjectRequest,
  CreateProjectResponse,
  CreateVersionCommentRequest,
  CreateVersionRequest,
  ListVersionCommentsResponse,
  ProjectAccessRole,
  ProjectHistoryResponse,
  ProjectInvite,
  ProjectMember,
  ProjectMembersResponse,
  ProjectSummary,
  ProjectVersionSummary,
  SharedProjectSummary,
  SharedProjectsResponse,
  TrafficProfile,
  UpdateProjectMemberRequest,
  UpdateVersionCommentRequest,
  UpdateVersionRequest,
  VersionComment,
  VersionDetail,
  VersionTrafficProfileResponse,
  architectureComponentSchema,
  architectureEdgeSchema,
  commentStatusSchema,
  defaultTrafficProfile,
  projectInviteStatusSchema,
  projectMemberRoleSchema,
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

type SharedProjectRecord = Prisma.ProjectMemberGetPayload<{
  include: {
    project: {
      include: {
        user: {
          select: {
            email: true;
          };
        };
        scenario: true;
        versions: {
          orderBy: {
            versionNumber: 'desc';
          };
          take: 1;
        };
        _count: {
          select: {
            versions: true;
          };
        };
        invites: {
          where: {
            status: 'pending';
          };
          select: {
            id: true;
          };
        };
      };
    };
  };
}>;

type ProjectMembersRecord = Prisma.ProjectGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
      };
    };
    members: {
      include: {
        user: {
          select: {
            email: true;
          };
        };
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
    invites: {
      where: {
        status: 'pending';
      };
      orderBy: {
        createdAt: 'desc';
      };
      take: 50;
    };
  };
}>;

type VersionCommentRecord = Prisma.VersionCommentGetPayload<{
  include: {
    author: {
      select: {
        email: true;
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

  async listSharedProjects(userId: string, limit: number): Promise<SharedProjectsResponse> {
    const safeLimit = Math.max(1, Math.min(limit, 50));

    const sharedMemberships = await this.prisma.projectMember.findMany({
      where: {
        userId
      },
      include: {
        project: {
          include: {
            user: {
              select: {
                email: true
              }
            },
            scenario: true,
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1
            },
            _count: {
              select: {
                versions: true
              }
            },
            invites: {
              where: {
                status: 'pending'
              },
              select: {
                id: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: safeLimit
    });

    const projects: SharedProjectSummary[] = sharedMemberships
      .map((membership) => {
        const sharedProject = membership as SharedProjectRecord;
        return {
          ...this.toProjectSummary(sharedProject.project),
          accessRole: this.toAccessRole(sharedProject.role),
          ownerEmail: sharedProject.project.user.email,
          pendingInviteCount: sharedProject.project.invites.length
        };
      })
      .sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt))
      .slice(0, safeLimit);

    return {
      projects
    };
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
    await this.assertProjectEditAccess(userId, projectId);

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
    await this.assertProjectViewAccess(userId, projectId);

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

    return {
      project: this.toProjectSummary(project),
      versions: project.versions.map((version) => this.toVersionSummary(version))
    };
  }

  async getVersion(userId: string, projectId: string, versionId: string): Promise<VersionDetail> {
    await this.assertProjectViewAccess(userId, projectId);

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
    await this.assertProjectEditAccess(userId, projectId);

    const existingVersion = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      }
    });

    if (!existingVersion) {
      throw new NotFoundException('Version not found for this project.');
    }

    if (input.lastKnownUpdatedAt) {
      const parsedDate = new Date(input.lastKnownUpdatedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('lastKnownUpdatedAt must be a valid date-time string.');
      }

      if (parsedDate.getTime() !== existingVersion.updatedAt.getTime()) {
        throw new ConflictException({
          message: 'This version was updated by another collaborator. Reload the workspace before saving again.',
          currentUpdatedAt: existingVersion.updatedAt.toISOString()
        });
      }
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
    await this.assertProjectViewAccess(userId, projectId);

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
    await this.assertProjectEditAccess(userId, projectId);

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

  async listProjectMembers(userId: string, projectId: string): Promise<ProjectMembersResponse> {
    await this.assertProjectViewAccess(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        invites: {
          where: {
            status: 'pending'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 50
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const record = project as ProjectMembersRecord;

    return {
      owner: {
        userId: record.user.id,
        email: record.user.email,
        role: 'owner'
      },
      members: record.members.map((member) => this.toProjectMember(member)),
      invites: record.invites.map((invite) => this.toProjectInvite(invite))
    };
  }

  async createProjectInvite(
    userId: string,
    projectId: string,
    input: CreateProjectInviteRequest
  ): Promise<ProjectInvite> {
    await this.assertProjectOwnerAccess(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const email = input.email.trim().toLowerCase();
    const role = this.toMemberRole(input.role ?? 'editor');

    if (email === project.user.email) {
      throw new BadRequestException('Project owner cannot be invited as a member.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email
      },
      select: {
        id: true
      }
    });

    if (existingUser) {
      const existingMembership = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: existingUser.id
          }
        }
      });

      if (existingMembership) {
        throw new BadRequestException('This user is already a member of the project.');
      }
    }

    const pendingInvite = await this.prisma.projectInvite.findFirst({
      where: {
        projectId,
        email,
        status: 'pending'
      }
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = this.generateInviteToken();

    const invite = pendingInvite
      ? await this.prisma.projectInvite.update({
          where: {
            id: pendingInvite.id
          },
          data: {
            role,
            token,
            expiresAt
          }
        })
      : await this.prisma.projectInvite.create({
          data: {
            projectId,
            email,
            role,
            status: 'pending',
            token,
            invitedById: userId,
            expiresAt
          }
        });

    return this.toProjectInvite(invite);
  }

  async acceptProjectInvite(userId: string, token: string): Promise<AcceptProjectInviteResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        email: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const invite = await this.prisma.projectInvite.findUnique({
      where: {
        token
      }
    });

    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Invite not found or no longer valid.');
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException('This invite does not belong to your account.');
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.projectInvite.update({
        where: {
          id: invite.id
        },
        data: {
          status: 'expired'
        }
      });
      throw new BadRequestException('This invite has expired.');
    }

    const acceptedRole = this.toMemberRole(invite.role);

    await this.prisma.$transaction([
      this.prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: invite.projectId,
            userId: user.id
          }
        },
        create: {
          projectId: invite.projectId,
          userId: user.id,
          role: acceptedRole,
          invitedById: invite.invitedById
        },
        update: {
          role: acceptedRole,
          invitedById: invite.invitedById
        }
      }),
      this.prisma.projectInvite.update({
        where: {
          id: invite.id
        },
        data: {
          status: 'accepted',
          acceptedById: user.id,
          acceptedAt: new Date()
        }
      })
    ]);

    return {
      projectId: invite.projectId,
      role: this.toAccessRole(acceptedRole)
    };
  }

  async updateProjectMemberRole(
    userId: string,
    projectId: string,
    memberId: string,
    input: UpdateProjectMemberRequest
  ): Promise<ProjectMember> {
    await this.assertProjectOwnerAccess(userId, projectId);

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!member) {
      throw new NotFoundException('Project member not found.');
    }

    const updated = await this.prisma.projectMember.update({
      where: {
        id: member.id
      },
      data: {
        role: this.toMemberRole(input.role)
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    return this.toProjectMember(updated);
  }

  async removeProjectMember(userId: string, projectId: string, memberId: string): Promise<{ memberId: string }> {
    await this.assertProjectOwnerAccess(userId, projectId);

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId
      }
    });

    if (!member) {
      throw new NotFoundException('Project member not found.');
    }

    await this.prisma.projectMember.delete({
      where: {
        id: member.id
      }
    });

    return {
      memberId: member.id
    };
  }

  async listVersionComments(
    userId: string,
    projectId: string,
    versionId: string,
    nodeId?: string
  ): Promise<ListVersionCommentsResponse> {
    await this.assertProjectViewAccess(userId, projectId);

    await this.assertVersionBelongsToProject(projectId, versionId);

    const comments = await this.prisma.versionComment.findMany({
      where: {
        projectId,
        versionId,
        ...(nodeId ? { nodeId } : {})
      },
      include: {
        author: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return {
      comments: comments.map((comment) => this.toVersionComment(comment))
    };
  }

  async createVersionComment(
    userId: string,
    projectId: string,
    versionId: string,
    input: CreateVersionCommentRequest
  ): Promise<VersionComment> {
    await this.assertProjectViewAccess(userId, projectId);

    const version = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      },
      select: {
        components: true
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found for this project.');
    }

    const nodeExists = this.toComponentArray(version.components).some((component) => component.id === input.nodeId);
    if (!nodeExists) {
      throw new BadRequestException('nodeId does not match any component in this version.');
    }

    const allowedCollaboratorIds = await this.getProjectCollaboratorIds(projectId);
    const mentionUserIds = this.toMentionUserIds(input.mentionUserIds, allowedCollaboratorIds);

    const created = await this.prisma.versionComment.create({
      data: {
        projectId,
        versionId,
        nodeId: input.nodeId,
        authorId: userId,
        body: input.body.trim(),
        status: 'open',
        mentionUserIds: mentionUserIds as unknown as Prisma.InputJsonValue
      },
      include: {
        author: {
          select: {
            email: true
          }
        }
      }
    });

    return this.toVersionComment(created);
  }

  async updateVersionComment(
    userId: string,
    projectId: string,
    versionId: string,
    commentId: string,
    input: UpdateVersionCommentRequest
  ): Promise<VersionComment> {
    const accessRole = await this.assertProjectViewAccess(userId, projectId);

    const comment = await this.prisma.versionComment.findFirst({
      where: {
        id: commentId,
        projectId,
        versionId
      },
      include: {
        author: {
          select: {
            email: true
          }
        }
      }
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const isOwnerOrEditor = accessRole === 'owner' || accessRole === 'editor';
    if (comment.authorId !== userId && !isOwnerOrEditor) {
      throw new ForbiddenException('You do not have permission to edit this comment.');
    }

    const updated = await this.prisma.versionComment.update({
      where: {
        id: comment.id
      },
      data: {
        body: input.body !== undefined ? input.body.trim() : undefined,
        status: input.status ? this.toCommentStatus(input.status) : undefined
      },
      include: {
        author: {
          select: {
            email: true
          }
        }
      }
    });

    return this.toVersionComment(updated);
  }

  async deleteVersionComment(
    userId: string,
    projectId: string,
    versionId: string,
    commentId: string
  ): Promise<{ commentId: string }> {
    const accessRole = await this.assertProjectViewAccess(userId, projectId);

    const comment = await this.prisma.versionComment.findFirst({
      where: {
        id: commentId,
        projectId,
        versionId
      }
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const isOwnerOrEditor = accessRole === 'owner' || accessRole === 'editor';
    if (comment.authorId !== userId && !isOwnerOrEditor) {
      throw new ForbiddenException('You do not have permission to delete this comment.');
    }

    await this.prisma.versionComment.delete({
      where: {
        id: comment.id
      }
    });

    return {
      commentId: comment.id
    };
  }

  async assertProjectViewAccess(userId: string, projectId: string): Promise<ProjectAccessRole> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      select: {
        id: true,
        userId: true,
        members: {
          where: {
            userId
          },
          select: {
            role: true
          },
          take: 1
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.userId === userId) {
      return 'owner';
    }

    const membership = project.members[0];
    if (!membership) {
      throw new ForbiddenException('You do not have access to this project.');
    }

    return this.toAccessRole(membership.role);
  }

  async assertProjectEditAccess(userId: string, projectId: string): Promise<'owner' | 'editor'> {
    const role = await this.assertProjectViewAccess(userId, projectId);
    if (role === 'viewer') {
      throw new ForbiddenException('You have read-only access to this project.');
    }
    return role;
  }

  async assertProjectOwnerAccess(userId: string, projectId: string): Promise<void> {
    const role = await this.assertProjectViewAccess(userId, projectId);
    if (role !== 'owner') {
      throw new ForbiddenException('Only the project owner can perform this action.');
    }
  }

  async assertVersionViewAccess(
    userId: string,
    versionId: string
  ): Promise<{ projectId: string; role: ProjectAccessRole }> {
    const version = await this.prisma.architectureVersion.findUnique({
      where: {
        id: versionId
      },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            userId: true,
            members: {
              where: {
                userId
              },
              select: {
                role: true
              },
              take: 1
            }
          }
        }
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found.');
    }

    if (version.project.userId === userId) {
      return {
        projectId: version.projectId,
        role: 'owner'
      };
    }

    const membership = version.project.members[0];
    if (!membership) {
      throw new ForbiddenException('You do not have access to this version.');
    }

    return {
      projectId: version.projectId,
      role: this.toAccessRole(membership.role)
    };
  }

  async assertVersionEditAccess(userId: string, versionId: string): Promise<{ projectId: string; role: 'owner' | 'editor' }> {
    const access = await this.assertVersionViewAccess(userId, versionId);
    if (access.role === 'viewer') {
      throw new ForbiddenException('You have read-only access to this version.');
    }

    return {
      projectId: access.projectId,
      role: access.role
    };
  }

  private async assertVersionBelongsToProject(projectId: string, versionId: string): Promise<void> {
    const version = await this.prisma.architectureVersion.findFirst({
      where: {
        id: versionId,
        projectId
      },
      select: {
        id: true
      }
    });

    if (!version) {
      throw new NotFoundException('Version not found for this project.');
    }
  }

  private async getProjectCollaboratorIds(projectId: string): Promise<Set<string>> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      select: {
        userId: true,
        members: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const allowed = new Set<string>([project.userId]);
    for (const member of project.members) {
      allowed.add(member.userId);
    }
    return allowed;
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

  private toProjectMember(member: {
    id: string;
    projectId: string;
    userId: string;
    role: string;
    invitedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      email: string;
    };
  }): ProjectMember {
    return {
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      email: member.user.email,
      role: this.toMemberRole(member.role),
      invitedById: member.invitedById,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString()
    };
  }

  private toProjectInvite(invite: {
    id: string;
    projectId: string;
    email: string;
    role: string;
    status: string;
    token: string;
    invitedById: string;
    acceptedById: string | null;
    acceptedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectInvite {
    return {
      id: invite.id,
      projectId: invite.projectId,
      email: invite.email,
      role: this.toMemberRole(invite.role),
      status: this.toInviteStatus(invite.status),
      token: invite.token,
      invitedById: invite.invitedById,
      acceptedById: invite.acceptedById,
      acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString()
    };
  }

  private toVersionComment(comment: VersionCommentRecord): VersionComment {
    return {
      id: comment.id,
      projectId: comment.projectId,
      versionId: comment.versionId,
      nodeId: comment.nodeId,
      authorId: comment.authorId,
      authorEmail: comment.author.email,
      body: comment.body,
      mentionUserIds: this.toMentionUserIds(comment.mentionUserIds),
      status: this.toCommentStatus(comment.status),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString()
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

  private toAccessRole(role: string): ProjectAccessRole {
    if (role === 'owner' || role === 'editor' || role === 'viewer') {
      return role;
    }

    const memberRole = this.toMemberRole(role);
    return memberRole === 'editor' ? 'editor' : 'viewer';
  }

  private toMemberRole(role: string): 'editor' | 'viewer' {
    const parsed = projectMemberRoleSchema.safeParse(role);
    if (parsed.success) {
      return parsed.data;
    }

    return 'viewer';
  }

  private toInviteStatus(status: string): 'pending' | 'accepted' | 'revoked' | 'expired' {
    const parsed = projectInviteStatusSchema.safeParse(status);
    if (parsed.success) {
      return parsed.data;
    }

    return 'pending';
  }

  private toCommentStatus(status: string): 'open' | 'resolved' {
    const parsed = commentStatusSchema.safeParse(status);
    if (parsed.success) {
      return parsed.data;
    }

    return 'open';
  }

  private toMentionUserIds(value: Prisma.JsonValue | string[] | undefined, allowed?: Set<string>): string[] {
    const source = Array.isArray(value) ? value : [];
    const mentionUserIds: string[] = [];
    for (const entry of source) {
      if (typeof entry !== 'string') {
        continue;
      }
      if (allowed && !allowed.has(entry)) {
        continue;
      }
      if (!mentionUserIds.includes(entry)) {
        mentionUserIds.push(entry);
      }
      if (mentionUserIds.length >= 20) {
        break;
      }
    }
    return mentionUserIds;
  }

  private generateInviteToken(): string {
    return randomBytes(24).toString('base64url');
  }
}
