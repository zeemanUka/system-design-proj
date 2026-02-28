import type { SignOptions } from 'jsonwebtoken';

export type JwtPayload = {
  sub: string;
  email: string;
  tv: number;
  iat?: number;
  exp?: number;
};

const DEFAULT_ACCESS_TOKEN_TTL = '12h';

function sanitizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getJwtSecret(): string {
  const secret = sanitizeEnv(process.env.JWT_SECRET);
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required.');
  }
  return secret;
}

export function getAccessTokenTtl(): SignOptions['expiresIn'] {
  return (sanitizeEnv(process.env.JWT_ACCESS_TOKEN_TTL) ?? DEFAULT_ACCESS_TOKEN_TTL) as SignOptions['expiresIn'];
}
