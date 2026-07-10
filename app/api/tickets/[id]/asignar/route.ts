import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/guard';
import { asignarTicket } from '@/lib/tickets/service';

const asignarSchema = z.object({
  tecnicoId: z.string(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const parsed = asignarSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  const ticket = await asignarTicket(id, parsed.data.tecnicoId, session.sub);
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  return NextResponse.json(ticket);
}
