import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession, requireTecnicoOAdmin } from '@/lib/auth/guard';
import { findTicketById, updateTicket } from '@/lib/tickets/service';
import { optionalUuid } from '@/lib/validation';

const updateTicketSchema = z.object({
  titulo: z.string().optional(),
  descripcion: z.string().optional(),
  prioridad: z.number().min(1).max(4).optional(),
  estado: z.number().min(1).max(4).optional(),
  categoriaId: optionalUuid,
  empresaId: optionalUuid,
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const ticket = await findTicketById(id);
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  // Un cliente (rol 0) solo puede ver sus propios tickets, ni siquiera
  // adivinando el id de otro — no es solo un tema de listado.
  if (session.rol < 1 && ticket.usuarioId !== session.sub) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  return NextResponse.json(ticket);
}

// Cambiar estado/prioridad/categoría/empresa es una acción del equipo, no
// del cliente que reportó el ticket (la UI ya solo se lo muestra a
// técnicos/admins — esto es que la API lo respete también).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireTecnicoOAdmin();
  if (error) return error;

  const { id } = await params;
  const parsed = updateTicketSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  const ticket = await updateTicket(id, parsed.data, session.sub);
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  return NextResponse.json(ticket);
}
