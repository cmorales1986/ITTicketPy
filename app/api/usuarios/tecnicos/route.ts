import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await db.query.usuarios.findMany({
    where: and(eq(usuarios.rol, 1), eq(usuarios.activo, true)),
    columns: {
      id: true,
      nombre: true,
      email: true,
    },
  });
  return NextResponse.json(result);
}
