import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { onboardingRequestSchema } from '@sdc/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequestWithUser } from '../auth/request-user.type.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() request: RequestWithUser) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    return this.usersService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding')
  async completeOnboarding(@Req() request: RequestWithUser, @Body() body: unknown) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user identity.');
    }

    const parsed = onboardingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.usersService.completeOnboarding(userId, parsed.data);
  }
}
