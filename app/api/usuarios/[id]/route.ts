import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, ne } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';

const updateUsuarioSchema = z.object({
  activo: z.boolean().optional(),
  nombre: z.string().min(3).optional(),
  email: z.string().email().optional(),
  rol: z.number().min(0).max(3).optional(),
  numeroWhatsApp: z.string().optional(),
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

  if (parsed.data.email) {
    const existente = await db.query.usuarios.findFirst({
      where: and(eq(usuarios.email, parsed.data.email), ne(usuarios.id, id)),
    });
    if (existente) {
      return NextResponse.json({ message: 'El email ya está en uso' }, { status: 409 });
    }
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
