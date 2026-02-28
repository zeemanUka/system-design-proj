import { FastifyReply, FastifyRequest } from 'fastify';

export const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

type CookieOptions = {
  maxAgeSeconds?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
};

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return undefined;
}

function shouldUseSecureCookie(request: FastifyRequest): boolean {
  const envOverride = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE);
  if (envOverride !== undefined) {
    return envOverride;
  }

  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim() === 'https';
  }
  return request.protocol === 'https';
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path ?? '/'}`);

  if (typeof options.maxAgeSeconds === 'number') {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  return segments.join('; ');
}

function appendSetCookie(reply: FastifyReply, cookieValue: string): void {
  const existing = reply.getHeader('Set-Cookie');
  if (!existing) {
    reply.header('Set-Cookie', cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    reply.header('Set-Cookie', [...existing, cookieValue]);
    return;
  }

  reply.header('Set-Cookie', [String(existing), cookieValue]);
}

export function setAuthCookie(reply: FastifyReply, request: FastifyRequest, token: string): void {
  appendSetCookie(
    reply,
    serializeCookie(AUTH_COOKIE_NAME, token, {
      maxAgeSeconds: AUTH_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: shouldUseSecureCookie(request),
      sameSite: 'Lax',
      path: '/'
    })
  );
}

export function clearAuthCookie(reply: FastifyReply, request: FastifyRequest): void {
  appendSetCookie(
    reply,
    serializeCookie(AUTH_COOKIE_NAME, '', {
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: shouldUseSecureCookie(request),
      sameSite: 'Lax',
      path: '/'
    })
  );
}

export function parseCookieValue(cookieHeader: string | string[] | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const headerValue = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  const segments = headerValue.split(';');
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(`${cookieName}=`)) {
      continue;
    }

    const encoded = trimmed.slice(cookieName.length + 1);
    if (!encoded) {
      return '';
    }

    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }

  return null;
}
