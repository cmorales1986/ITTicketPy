import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, ne, or } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios, tickets, comentarios, historial } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { optionalUuid } from '@/lib/validation';

const updateUsuarioSchema = z.object({
  activo: z.boolean().optional(),
  nombre: z.string().min(3).optional(),
  email: z.string().email().optional(),
  rol: z.number().min(0).max(3).optional(),
  numeroWhatsApp: z.string().optional(),
  empresaId: optionalUuid,
  password: z.string().min(6).optional(),
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

  const { password, ...resto } = parsed.data;
  const updateValues: Partial<typeof usuarios.$inferInsert> = { ...resto };
  if (password) {
    updateValues.passwordHash = await hashPassword(password);
  }

  await db.update(usuarios).set(updateValues).where(eq(usuarios.id, id));

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, id),
    columns: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      numeroWhatsApp: true,
      empresaId: true,
    },
    with: { empresa: true },
  });
  if (!usuario) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }
  return NextResponse.json(usuario);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  if (id === session.sub) {
    return NextResponse.json({ message: 'No podés eliminar tu propia cuenta' }, { status: 400 });
  }

  // Solo se puede borrar un usuario que nunca tuvo movimiento — ni tickets
  // (creados o asignados), ni comentarios, ni historial. Si tuvo actividad,
  // sugerimos desactivarlo en vez de perder ese rastro.
  const [ticketRelacionado, comentarioRelacionado, historialRelacionado] = await Promise.all([
    db.query.tickets.findFirst({
      where: or(eq(tickets.usuarioId, id), eq(tickets.tecnicoAsignadoId, id)),
    }),
    db.query.comentarios.findFirst({ where: eq(comentarios.usuarioId, id) }),
    db.query.historial.findFirst({ where: eq(historial.usuarioId, id) }),
  ]);

  if (ticketRelacionado || comentarioRelacionado || historialRelacionado) {
    return NextResponse.json(
      { message: 'Este usuario tiene tickets, comentarios o actividad asociada. Desactivalo en vez de eliminarlo.' },
      { status: 409 },
    );
  }

  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!usuario) {
    return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
  }

  await db.delete(usuarios).where(eq(usuarios.id, id));
  return NextResponse.json({ ok: true });
}
