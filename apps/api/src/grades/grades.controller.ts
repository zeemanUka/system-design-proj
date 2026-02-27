import { Controller, Get, Inject, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { parseUuidParam } from '../common/request-validation.js';
import { RequestWithUser } from '../auth/request-user.type.js';
import { GradesService } from './grades.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class GradesController {
  constructor(@Inject(GradesService) private readonly gradesService: GradesService) {}

  @Post('versions/:id/grade')
  async queueGradeReport(@Req() request: RequestWithUser, @Param('id') versionId: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.gradesService.queueGradeReport(userId, parseUuidParam('versionId', versionId));
  }

  @Get('grades/:id')
  async getGradeReport(@Req() request: RequestWithUser, @Param('id') gradeReportId: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.gradesService.getGradeReport(userId, parseUuidParam('gradeReportId', gradeReportId));
  }
}
