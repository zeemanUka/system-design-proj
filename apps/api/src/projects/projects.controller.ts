import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import {
  compareVersionsQuerySchema,
  createProjectInviteRequestSchema,
  createReportExportRequestSchema,
  createReportShareRequestSchema,
  createProjectRequestSchema,
  createVersionCommentRequestSchema,
  createVersionRequestSchema,
  updateProjectMemberRequestSchema,
  updateTrafficProfileRequestSchema,
  updateVersionCommentRequestSchema,
  updateVersionRequestSchema
} from '@sdc/shared-types';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  parsePositiveIntQuery,
  parseShareTokenParam,
  parseUuidParam
} from '../common/request-validation.js';
import { toSafeAttachmentFilename } from '../common/content-disposition.js';
import { RequestWithUser } from '../auth/request-user.type.js';
import { ReportsService } from './reports.service.js';
import { ProjectsService } from './projects.service.js';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projectsService: ProjectsService,
    @Inject(ReportsService) private readonly reportsService: ReportsService
  ) {}

  @Get()
  async listProjects(@Req() request: RequestWithUser, @Query('limit') limitRaw?: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const limit = parsePositiveIntQuery('limit', limitRaw, 1, 50) ?? 20;

    return this.projectsService.listProjects(userId, limit);
  }

  @Get('shared')
  async listSharedProjects(@Req() request: RequestWithUser, @Query('limit') limitRaw?: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const limit = parsePositiveIntQuery('limit', limitRaw, 1, 50) ?? 20;
    return this.projectsService.listSharedProjects(userId, limit);
  }

  @Post()
  async createProject(@Req() request: RequestWithUser, @Body() body: unknown) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createProjectRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.createProject(userId, parsed.data);
  }

  @Post('invites/:inviteToken/accept')
  async acceptProjectInvite(@Req() request: RequestWithUser, @Param('inviteToken') inviteToken: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.acceptProjectInvite(userId, parseShareTokenParam('inviteToken', inviteToken));
  }

  @Get(':id/members')
  async listProjectMembers(@Req() request: RequestWithUser, @Param('id') projectId: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.listProjectMembers(userId, parseUuidParam('projectId', projectId));
  }

  @Post(':id/invites')
  async createProjectInvite(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createProjectInviteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.createProjectInvite(
      userId,
      parseUuidParam('projectId', projectId),
      parsed.data
    );
  }

  @Patch(':id/members/:memberId')
  async updateProjectMemberRole(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = updateProjectMemberRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.updateProjectMemberRole(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('memberId', memberId),
      parsed.data
    );
  }

  @Delete(':id/members/:memberId')
  async removeProjectMember(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('memberId') memberId: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.removeProjectMember(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('memberId', memberId)
    );
  }

  @Post(':id/versions')
  async createVersion(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createVersionRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.createVersion(userId, parseUuidParam('projectId', projectId), parsed.data);
  }

  @Get(':id/history')
  async getProjectHistory(@Req() request: RequestWithUser, @Param('id') projectId: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.getProjectHistory(userId, parseUuidParam('projectId', projectId));
  }

  @Get(':id/versions/:versionId')
  async getVersion(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.getVersion(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId)
    );
  }

  @Patch(':id/versions/:versionId')
  async updateVersion(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = updateVersionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.updateVersion(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId),
      parsed.data
    );
  }

  @Get(':id/versions/:versionId/comments')
  async listVersionComments(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string,
    @Query('nodeId') nodeId?: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.listVersionComments(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId),
      nodeId?.trim() || undefined
    );
  }

  @Post(':id/versions/:versionId/comments')
  async createVersionComment(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createVersionCommentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.createVersionComment(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId),
      parsed.data
    );
  }

  @Patch(':id/versions/:versionId/comments/:commentId')
  async updateVersionComment(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string,
    @Param('commentId') commentId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = updateVersionCommentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.updateVersionComment(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId),
      parseUuidParam('commentId', commentId),
      parsed.data
    );
  }

  @Delete(':id/versions/:versionId/comments/:commentId')
  async deleteVersionComment(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string,
    @Param('commentId') commentId: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.deleteVersionComment(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId),
      parseUuidParam('commentId', commentId)
    );
  }

  @Get(':id/versions/:versionId/traffic')
  async getVersionTrafficProfile(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.projectsService.getVersionTrafficProfile(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId)
    );
  }

  @Patch(':id/versions/:versionId/traffic')
  async updateVersionTrafficProfile(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = updateTrafficProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.projectsService.updateVersionTrafficProfile(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('versionId', versionId),
      parsed.data.trafficProfile
    );
  }

  @Get(':id/compare')
  async compareVersions(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Query('baselineVersionId') baselineVersionId: string,
    @Query('candidateVersionId') candidateVersionId: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = compareVersionsQuerySchema.safeParse({
      baselineVersionId,
      candidateVersionId
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.reportsService.getVersionCompare(
      userId,
      parseUuidParam('projectId', projectId),
      parsed.data.baselineVersionId,
      parsed.data.candidateVersionId
    );
  }

  @Get(':id/report')
  async getProjectReport(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Query('baselineVersionId') baselineVersionId?: string,
    @Query('candidateVersionId') candidateVersionId?: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createReportExportRequestSchema.safeParse({
      baselineVersionId,
      candidateVersionId
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.reportsService.getProjectReport(
      userId,
      parseUuidParam('projectId', projectId),
      parsed.data.baselineVersionId,
      parsed.data.candidateVersionId
    );
  }

  @Post(':id/report/exports')
  async createProjectReportExport(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createReportExportRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.reportsService.createReportExport(
      userId,
      parseUuidParam('projectId', projectId),
      parsed.data.baselineVersionId,
      parsed.data.candidateVersionId
    );
  }

  @Get(':id/report/exports/:exportId/pdf')
  async downloadProjectReportExportPdf(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('exportId') exportId: string,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const payload = await this.reportsService.downloadProjectReportPdf(
      userId,
      parseUuidParam('projectId', projectId),
      parseUuidParam('exportId', exportId)
    );
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${toSafeAttachmentFilename(payload.fileName)}"`);
    return payload.buffer;
  }

  @Post(':id/report/shares')
  async createProjectReportShare(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = createReportShareRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.reportsService.createReportShare(
      userId,
      parseUuidParam('projectId', projectId),
      parsed.data.exportId
    );
  }

  @Patch(':id/report/shares/:shareToken/revoke')
  async revokeProjectReportShare(
    @Req() request: RequestWithUser,
    @Param('id') projectId: string,
    @Param('shareToken') shareToken: string
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.reportsService.revokeReportShare(
      userId,
      parseUuidParam('projectId', projectId),
      parseShareTokenParam('shareToken', shareToken)
    );
  }
}
