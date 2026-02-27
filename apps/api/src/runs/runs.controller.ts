import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { failureInjectionRequestSchema } from '@sdc/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { parseUuidParam } from '../common/request-validation.js';
import { RequestWithUser } from '../auth/request-user.type.js';
import { RunsService } from './runs.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class RunsController {
  constructor(@Inject(RunsService) private readonly runsService: RunsService) {}

  @Post('versions/:id/simulate')
  async queueSimulationRun(@Req() request: RequestWithUser, @Param('id') versionId: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.runsService.queueSimulationRun(userId, parseUuidParam('versionId', versionId));
  }

  @Get('runs/:id')
  async getSimulationRun(@Req() request: RequestWithUser, @Param('id') runId: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.runsService.getSimulationRun(userId, parseUuidParam('runId', runId));
  }

  @Post('runs/:id/failure-injection')
  async injectFailure(
    @Req() request: RequestWithUser,
    @Param('id') runId: string,
    @Body() body: unknown
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = failureInjectionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.runsService.queueFailureInjectionRun(
      userId,
      parseUuidParam('runId', runId),
      parsed.data.profile
    );
  }
}
