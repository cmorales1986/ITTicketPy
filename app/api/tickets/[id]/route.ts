import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession, requireTecnicoOAdmin } from '@/lib/auth/guard';
import { findTicketById, updateTicket, TicketReglaError } from '@/lib/tickets/service';
import { optionalUuid } from '@/lib/validation';
import { LUGAR, RESULTADOS_PRUEBAS, sistemaAfectadoValido } from '@/lib/tickets/estados';

const fechaOVacia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional();

const updateTicketSchema = z.object({
  titulo: z.string().optional(),
  descripcion: z.string().optional(),
  prioridad: z.number().min(1).max(4).optional(),
  estado: z.number().min(1).max(5).optional(),
  categoriaId: optionalUuid,
  empresaId: optionalUuid,
  tipo: z.number().int().min(1).max(5).optional(),
  sistemaModulo: z.string().max(255).refine(sistemaAfectadoValido, 'Sistema o servicio inválido').optional(),
  lugarOrigen: z.enum([LUGAR.OFICINA, LUGAR.GRANJA]).optional(),
  urgencia: z.number().min(1).max(4).optional(),
  // Obligatorios al pasar a Resuelto / Cancelado (se validan en el servicio).
  solucion: z.string().optional(),
  motivoCancelacion: z.string().optional(),
  // Derivación a proveedor o recurso externo.
  dependeProveedor: z.boolean().optional(),
  proveedorNombre: z.string().max(255).optional(),
  proveedorFechaCompromiso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  proveedorNotas: z.string().optional(),
  // Obligatorio para cerrar un ticket Crítico fuera de plazo.
  motivoDesvio: z.string().optional(),
  // Obligatorio al reabrir un ticket Cerrado (y opcional si el usuario objeta
  // una solución).
  motivoReapertura: z.string().optional(),
  // P2: evaluación, pruebas y puesta en producción (desarrollo y mejora).
  evalAlcance: z.string().optional(),
  evalEsfuerzo: z.string().max(100).optional(),
  evalConCosto: z.boolean().optional(),
  evalCosto: z.string().max(100).optional(),
  evalImpacto: z.string().optional(),
  plazoPropuesto: fechaOVacia,
  pruebasResultado: z.enum(Object.keys(RESULTADOS_PRUEBAS) as [string, ...string[]]).optional(),
  pruebasFecha: fechaOVacia,
  pruebasNota: z.string().optional(),
  produccionFecha: fechaOVacia,
  // P2: proveedor, causa y reincidencia.
  proveedorEntregablesVerificados: z.boolean().optional(),
  analisisCausa: z.string().optional(),
  reincidente: z.boolean().optional(),
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

  let ticket;
  try {
    ticket = await updateTicket(id, parsed.data, session.sub);
  } catch (err) {
    if (err instanceof TicketReglaError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }
  return NextResponse.json(ticket);
}
