import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthSuccessResponse, LoginRequest, SignupRequest, UserProfile } from '@sdc/shared-types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPasswordStrong } from './password.util.js';

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async signup(input: SignupRequest): Promise<AuthSuccessResponse> {
    if (!isPasswordStrong(input.password)) {
      throw new BadRequestException('Password must include letters and numbers and be at least 8 characters.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash
      }
    });

    return {
      token: this.signToken(user),
      user: this.toUserProfile(user)
    };
  }

  async login(input: LoginRequest): Promise<AuthSuccessResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return {
      token: this.signToken(user),
      user: this.toUserProfile(user)
    };
  }

  private signToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email
      },
      process.env.JWT_SECRET || 'development-secret',
      { expiresIn: '7d' }
    );
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
