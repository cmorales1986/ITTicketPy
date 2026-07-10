import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/guard';
import { findAllTickets, createTicket } from '@/lib/tickets/service';
import { optionalUuid } from '@/lib/validation';

const createTicketSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  prioridad: z.number().min(1).max(4),
  categoriaId: optionalUuid,
});

export async function GET(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const estado = request.nextUrl.searchParams.get('estado');
  const prioridad = request.nextUrl.searchParams.get('prioridad');

  const result = await findAllTickets(
    estado ? Number(estado) : undefined,
    prioridad ? Number(prioridad) : undefined,
  );
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const parsed = createTicketSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  const ticket = await createTicket(parsed.data, session.sub);
  return NextResponse.json(ticket, { status: 201 });
}
