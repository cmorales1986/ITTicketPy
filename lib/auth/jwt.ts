import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  sub: string;
  email: string;
  rol: number;
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const expiration = process.env.JWT_EXPIRATION || '1440m';

export async function signJwt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload;
}
