import { NextResponse } from 'next/server';
import { getCurrentUser } from './session';
import type { SessionPayload } from './jwt';

export async function requireSession(): Promise<
  { session: SessionPayload; error: null } | { session: null; error: NextResponse }
> {
  const session = await getCurrentUser();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ message: 'No autenticado' }, { status: 401 }),
    };
  }
  return { session, error: null };
}
