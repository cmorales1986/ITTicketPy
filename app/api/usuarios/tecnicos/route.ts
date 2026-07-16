import { NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  // rol 1 = Técnico, rol 3 = Admin y Técnico — ambos son asignables a tickets.
  const result = await db.query.usuarios.findMany({
    where: and(or(eq(usuarios.rol, 1), eq(usuarios.rol, 3)), eq(usuarios.activo, true)),
    columns: {
      id: true,
      nombre: true,
      email: true,
    },
  });
  return NextResponse.json(result);
}
