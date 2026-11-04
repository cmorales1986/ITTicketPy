import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/guard';
import { findAllTickets, createTicket } from '@/lib/tickets/service';
import { optionalUuid } from '@/lib/validation';
import { CANAL } from '@/lib/tickets/estados';

const createTicketSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  prioridad: z.number().min(1).max(4),
  categoriaId: optionalUuid,
  // Solo técnicos/admins pueden usar esto para cargar un ticket a nombre de
  // otro usuario (ej. alguien llamó por teléfono en vez de escribir).
  usuarioId: optionalUuid,
  // PR-INF-03: canal de ingreso. El equipo carga a mano los tickets de correo
  // o llamada; los de WhatsApp los crea el bot. Un cliente (rol 0) no elige:
  // su ticket queda como PORTAL.
  canal: z.enum([CANAL.CORREO, CANAL.LLAMADA]).optional(),
  tipo: z.number().min(1).max(3).default(1),
  sistemaModulo: z.string().min(1).max(255),
  urgencia: z.number().min(1).max(4),
  // Continuación de un ticket anterior (reapertura fuera de plazo).
  ticketAnteriorId: optionalUuid,
});

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const estado = request.nextUrl.searchParams.get('estado');
  const prioridad = request.nextUrl.searchParams.get('prioridad');

  // Un cliente (rol 0) solo ve sus propios tickets; técnicos/admins ven todo.
  const soloDeUsuarioId = session.rol < 1 ? session.sub : undefined;

  const result = await findAllTickets(
    estado ? Number(estado) : undefined,
    prioridad ? Number(prioridad) : undefined,
    soloDeUsuarioId,
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

  const { usuarioId: reportanteId, canal: canalElegido, ...resto } = parsed.data;

  let canal: string = CANAL.PORTAL;
  if (session.rol >= 1) {
    if (!canalElegido) {
      return NextResponse.json(
        { message: 'Indicá el canal de ingreso (correo o llamada)' },
        { status: 400 },
      );
    }
    canal = canalElegido;
  }
  const dto = { ...resto, canal };

  let usuarioTicket = session.sub;
  if (reportanteId && reportanteId !== session.sub) {
    if (session.rol < 1) {
      return NextResponse.json({ message: 'No autorizado para crear tickets a nombre de otro usuario' }, { status: 403 });
    }
    usuarioTicket = reportanteId;
  }

  const ticket = await createTicket(dto, usuarioTicket, undefined, session.sub);
  return NextResponse.json(ticket, { status: 201 });
}
