import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTecnicoOAdmin } from '@/lib/auth/guard';
import { registrarConformidad, TicketReglaError } from '@/lib/tickets/service';
import { CANALES_CONFORMIDAD } from '@/lib/tickets/estados';

const schema = z.object({
  canal: z.enum(CANALES_CONFORMIDAD),
  nota: z.string().max(1000).optional(),
});

// El equipo registra que el usuario dio su conformidad con la solución,
// indicando por qué canal (correo o llamada se confirman a mano).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireTecnicoOAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Indicá el canal de la conformidad' }, { status: 400 });
  }

  const { id } = await params;
  try {
    const ticket = await registrarConformidad(id, session.sub, parsed.data.canal, parsed.data.nota);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
    }
    return NextResponse.json(ticket);
  } catch (err) {
    if (err instanceof TicketReglaError) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    throw err;
  }
}
