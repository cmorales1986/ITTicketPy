import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';

const updateUsuarioSchema = z.object({
  activo: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const parsed = updateUsuarioSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  await db.update(usuarios).set(parsed.data).where(eq(usuarios.id, id));

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, id),
    columns: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      numeroWhatsApp: true,
    },
  });
  if (!usuario) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }
  return NextResponse.json(usuario);
}
