import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_COOKIE_NAME, parseCookieValue } from './auth-cookie.util.js';
import { getJwtSecret, JwtPayload } from './jwt.util.js';

type RequestWithUser = {
  method: string;
  headers: {
    authorization?: string;
    cookie?: string | string[];
    origin?: string;
  };
  user?: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.allowedOrigins = this.parseAllowedOrigins();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const auth = this.extractAuthToken(request);
    const token = auth.token;

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, tokenVersion: true }
      });

      if (!user || user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException('Token has been revoked');
      }

      if (auth.source === 'cookie' && this.isStateChangingMethod(request.method)) {
        const origin = request.headers.origin;
        if (!origin || !this.allowedOrigins.has(origin)) {
          throw new ForbiddenException('Invalid request origin.');
        }
      }

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractAuthToken(request: RequestWithUser): { token: string | null; source: 'cookie' | 'bearer' | null } {
    const cookieToken = parseCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
    if (cookieToken) {
      return {
        token: cookieToken,
        source: 'cookie'
      };
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        token: null,
        source: null
      };
    }

    const bearerToken = authHeader.slice('Bearer '.length).trim();
    if (bearerToken.length === 0) {
      return {
        token: null,
        source: null
      };
    }

    return {
      token: bearerToken,
      source: 'bearer'
    };
  }

  private isStateChangingMethod(method: string): boolean {
    const normalized = method.toUpperCase();
    return normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH' || normalized === 'DELETE';
  }

  private parseAllowedOrigins(): Set<string> {
    const raw = process.env.CORS_ALLOWED_ORIGINS || '';
    const configured = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (process.env.NODE_ENV !== 'production') {
      configured.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }

    return new Set(configured);
  }
}
