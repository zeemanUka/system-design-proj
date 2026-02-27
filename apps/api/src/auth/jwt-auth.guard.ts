import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import jwt from 'jsonwebtoken';

type JwtPayload = {
  sub: string;
  email: string;
};

type RequestWithUser = {
  headers: {
    authorization?: string;
  };
  user?: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-secret') as JwtPayload;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
