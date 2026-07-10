import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/guard';
import { agregarComentario } from '@/lib/tickets/service';

const comentarioSchema = z.object({
  contenido: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const parsed = comentarioSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  const comentario = await agregarComentario(id, session.sub, parsed.data.contenido);
  if (!comentario) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  return NextResponse.json(comentario, { status: 201 });
}
