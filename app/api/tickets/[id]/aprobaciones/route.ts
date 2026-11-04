import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTecnicoOAdmin } from '@/lib/auth/guard';
import { registrarAprobacion, TicketReglaError } from '@/lib/tickets/service';
import { APROBACION_TIPOS } from '@/lib/tickets/estados';

const schema = z.object({
  tipo: z.enum(APROBACION_TIPOS),
  aprobadoPor: z.string().min(2).max(255),
  fechaAprobacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comentario: z.string().min(3),
});

// Registra una aprobación (gerente del área, Gerente de TI o Gerencia
// General) con quién aprobó, cuándo y la evidencia. Solo de alta.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireTecnicoOAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Completá quién aprobó, la fecha y el comentario o evidencia' },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const ticket = await registrarAprobacion(id, session.sub, parsed.data);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
    }
    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    if (err instanceof TicketReglaError) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    throw err;
  }
}
