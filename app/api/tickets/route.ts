import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/guard';
import { findAllTickets, createTicket } from '@/lib/tickets/service';
import { optionalUuid } from '@/lib/validation';
import { CANAL, LUGAR, sistemaAfectadoValido } from '@/lib/tickets/estados';

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
  canal: z.enum([CANAL.CORREO, CANAL.LLAMADA, CANAL.WHATSAPP_PERSONAL, CANAL.WHATSAPP_TECNICO]).optional(),
  tipo: z.number().int().min(1).max(5).default(1),
  // Sistema o servicio afectado: lista cerrada (o "Otro: detalle").
  sistemaModulo: z.string().min(1).max(255).refine(sistemaAfectadoValido, 'Sistema o servicio inválido'),
  // Lugar de origen: define el horario con el que se cuentan los plazos.
  lugarOrigen: z.enum([LUGAR.OFICINA, LUGAR.GRANJA]).optional(),
  // Cuándo se recibió el reporte (ISO). Los plazos corren desde acá.
  fechaRecepcion: z.string().datetime({ offset: true }).optional(),
  urgencia: z.number().min(1).max(4),
  // Continuación de un ticket anterior (reapertura fuera de plazo).
  ticketAnteriorId: optionalUuid,
  // Registro de un ticket antiguo ya resuelto (solo equipo): se crea Cerrado.
  retroactivo: z
    .object({
      solucion: z.string().trim().min(5),
      fechaSolucion: z.string().datetime({ offset: true }),
    })
    .optional(),
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
        { message: 'Indicá el canal de ingreso' },
        { status: 400 },
      );
    }
    canal = canalElegido;
  }
  // Los tickets cargados a mano (correo o llamada) exigen el lugar de origen y
  // la fecha y hora de recepción: de ahí salen los plazos.
  let fechaRecepcion: Date | undefined;
  if (session.rol >= 1) {
    if (!resto.lugarOrigen) {
      return NextResponse.json({ message: 'Indicá el lugar de origen (oficina o granja)' }, { status: 400 });
    }
    if (!resto.fechaRecepcion) {
      return NextResponse.json({ message: 'Indicá la fecha y hora de recepción del reporte' }, { status: 400 });
    }
    fechaRecepcion = new Date(resto.fechaRecepcion);
    if (fechaRecepcion.getTime() > Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({ message: 'La fecha de recepción no puede ser futura' }, { status: 400 });
    }
  }
  const { retroactivo: retroactivoIn, ...restoSinRetro } = resto;
  let retroactivo: { solucion: string; fechaSolucion: Date } | undefined;
  if (retroactivoIn) {
    if (session.rol < 1 || !fechaRecepcion) {
      return NextResponse.json({ message: 'No autorizado para registrar tickets antiguos' }, { status: 403 });
    }
    const fechaSolucion = new Date(retroactivoIn.fechaSolucion);
    if (fechaSolucion.getTime() > Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({ message: 'La fecha de solución no puede ser futura' }, { status: 400 });
    }
    if (fechaSolucion.getTime() < fechaRecepcion.getTime()) {
      return NextResponse.json(
        { message: 'La fecha de solución no puede ser anterior a la de recepción' },
        { status: 400 },
      );
    }
    retroactivo = { solucion: retroactivoIn.solucion, fechaSolucion };
  }
  const dto = { ...restoSinRetro, canal, fechaRecepcion, retroactivo };

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
