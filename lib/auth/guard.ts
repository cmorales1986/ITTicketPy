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

// Igual que requireSession, pero además exige rol Técnico/Admin/Admin y
// Técnico (>=1). Para las acciones que son del equipo, no del cliente que
// reportó el ticket: cambiar estado, asignar técnico, notas internas, etc.
export async function requireTecnicoOAdmin(): Promise<
  { session: SessionPayload; error: null } | { session: null; error: NextResponse }
> {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session.rol < 1) {
    return {
      session: null,
      error: NextResponse.json({ message: 'No autorizado' }, { status: 403 }),
    };
  }
  return { session, error: null };
}
