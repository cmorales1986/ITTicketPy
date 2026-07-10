import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { signJwt, verifyJwt, SessionPayload } from './jwt';

export const SESSION_COOKIE = 'session';

function expirationToSeconds(expiration: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(expiration.trim());
  if (!match) return 60 * 60 * 24;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  return value * multiplier;
}

const maxAge = expirationToSeconds(process.env.JWT_EXPIRATION || '1440m');

export async function setSessionCookie(
  response: NextResponse,
  payload: SessionPayload,
): Promise<NextResponse> {
  const token = await signJwt(payload);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyJwt(token);
  } catch {
    return null;
  }
}
