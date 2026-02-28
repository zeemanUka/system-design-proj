import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { LoginRequest, SignupRequest, UserProfile } from '@sdc/shared-types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';
import { getAccessTokenTtl, getJwtSecret, JwtPayload } from './jwt.util.js';
import { isPasswordStrong } from './password.util.js';

const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;

export type AuthTokensAndProfile = {
  token: string;
  user: UserProfile;
};

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async signup(input: SignupRequest): Promise<AuthTokensAndProfile> {
    if (!isPasswordStrong(input.password)) {
      throw new BadRequestException(
        'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.'
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (existingUser) {
      throw new BadRequestException('Unable to create account with provided credentials.');
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

  async login(input: LoginRequest): Promise<AuthTokensAndProfile> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const now = new Date();
    if (user.lockoutUntil && user.lockoutUntil > now) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      await this.recordFailedLoginAttempt(user, now);
      throw new UnauthorizedException('Invalid credentials.');
    }

    const authenticatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        tokenVersion: {
          increment: 1
        }
      }
    });

    return {
      token: this.signToken(authenticatedUser),
      user: this.toUserProfile(authenticatedUser)
    };
  }

  async logoutByToken(token: string | null): Promise<void> {
    if (!token) {
      return;
    }

    try {
      const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: {
          tokenVersion: {
            increment: 1
          },
          failedLoginAttempts: 0,
          lockoutUntil: null
        }
      });
    } catch {
      // Token may already be expired/invalid. Clearing cookie on controller side still logs out browser session.
    }
  }

  private signToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tv: user.tokenVersion
      },
      getJwtSecret(),
      { expiresIn: getAccessTokenTtl() }
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

  private async recordFailedLoginAttempt(user: User, now: Date): Promise<void> {
    const nextCount = user.failedLoginAttempts + 1;
    const maxAttempts = this.parsePositiveIntEnv(
      'AUTH_MAX_FAILED_ATTEMPTS',
      DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
      3,
      20
    );
    const lockoutMinutes = this.parsePositiveIntEnv('AUTH_LOCKOUT_MINUTES', DEFAULT_LOCKOUT_MINUTES, 1, 1440);

    if (nextCount < maxAttempts) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextCount,
          lockoutUntil: null
        }
      });
      return;
    }

    const lockoutUntil = new Date(now.getTime() + lockoutMinutes * 60_000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil
      }
    });
  }

  private parsePositiveIntEnv(name: string, fallback: number, minimum: number, maximum: number): number {
    const parsed = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
  }
}
