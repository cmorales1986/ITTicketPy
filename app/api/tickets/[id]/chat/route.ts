import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/guard';
import { agregarMensajeChat, findTicketById } from '@/lib/tickets/service';

const mensajeSchema = z.object({
  contenido: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const parsed = mensajeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  // Un cliente (rol 0) solo puede chatear en su propio ticket; técnicos/
  // admins pueden en cualquiera.
  if (session.rol < 1) {
    const ticket = await findTicketById(id);
    if (!ticket || ticket.usuarioId !== session.sub) {
      return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
    }
  }

  const mensaje = await agregarMensajeChat(id, session.sub, parsed.data.contenido);
  if (!mensaje) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  return NextResponse.json(mensaje, { status: 201 });
}
