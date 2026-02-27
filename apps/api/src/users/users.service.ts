import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { OnboardingRequest, UserProfile } from '@sdc/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toUserProfile(user);
  }

  async completeOnboarding(userId: string, input: OnboardingRequest): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: input.role,
        targetCompanies: input.targetCompanies,
        level: input.level,
        scenarioPreferences: input.scenarioPreferences,
        onboardingCompleted: true
      }
    });

    return this.toUserProfile(user);
  }

  private toUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
      role: user.role,
      targetCompanies: this.toStringArray(user.targetCompanies),
      level: (user.level as UserProfile['level']) ?? null,
      scenarioPreferences: this.toStringArray(user.scenarioPreferences),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }
}
