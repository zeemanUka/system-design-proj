import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function decodeBase64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodeJwtPayload(token: string): { sub?: unknown; tv?: unknown; exp?: unknown } | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  try {
    const payloadBytes = decodeBase64UrlToBytes(segments[1]);
    const payloadText = new TextDecoder().decode(payloadBytes);
    return JSON.parse(payloadText) as { sub?: unknown; tv?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

async function verifyJwtHs256(token: string, secret: string): Promise<boolean> {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return false;
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== 'string' || typeof payload.tv !== 'number') {
    return false;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(new TextEncoder().encode(secret)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = decodeBase64UrlToBytes(signatureSegment);
    const data = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
    return await crypto.subtle.verify('HMAC', key, toArrayBuffer(signature), toArrayBuffer(data));
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || !(await verifyJwtHs256(token, secret))) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/scenarios/:path*',
    '/projects/:path*',
    '/runs/:path*',
    '/grades/:path*'
  ]
};
