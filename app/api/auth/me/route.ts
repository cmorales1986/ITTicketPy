import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { toPublicUsuario } from '@/lib/auth/serialize';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, session.sub),
  });
  if (!usuario) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  return NextResponse.json({ usuario: toPublicUsuario(usuario) });
}
