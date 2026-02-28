import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_COOKIE_NAME, parseCookieValue } from './auth-cookie.util.js';
import { getJwtSecret, JwtPayload } from './jwt.util.js';

type RequestWithUser = {
  headers: {
    authorization?: string;
    cookie?: string | string[];
  };
  user?: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractAuthToken(request);

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

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractAuthToken(request: RequestWithUser): string | null {
    const cookieToken = parseCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
    if (cookieToken) {
      return cookieToken;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const bearerToken = authHeader.slice('Bearer '.length).trim();
    return bearerToken.length > 0 ? bearerToken : null;
  }
}
