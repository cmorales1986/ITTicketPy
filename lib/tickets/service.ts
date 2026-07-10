import { count, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tickets, comentarios, historial } from '@/lib/db/schema';

const ESTADO_LABELS: Record<number, string> = {
  1: 'Abierto',
  2: 'En Progreso',
  3: 'Resuelto',
  4: 'Cerrado',
};

const PRIORIDAD_LABELS: Record<number, string> = {
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Crítica',
};

export interface CreateTicketInput {
  titulo: string;
  descripcion: string;
  prioridad: number;
  categoriaId?: string;
}

export interface UpdateTicketInput {
  titulo?: string;
  descripcion?: string;
  prioridad?: number;
  estado?: number;
  categoriaId?: string;
}

async function registrarHistorial(
  ticketId: string,
  usuarioId: string,
  tipo: string,
  descripcion: string,
  valorAnterior?: string,
  valorNuevo?: string,
) {
  await db.insert(historial).values({
    ticketId,
    usuarioId,
    tipo,
    descripcion,
    valorAnterior,
    valorNuevo,
  });
}

export async function findAllTickets(estado?: number, prioridad?: number) {
  return db.query.tickets.findMany({
    where: (t, { and, eq: eqOp }) =>
      and(
        estado ? eqOp(t.estado, estado) : undefined,
        prioridad ? eqOp(t.prioridad, prioridad) : undefined,
      ),
    with: {
      usuario: true,
      tecnicoAsignado: true,
      categoria: true,
    },
    orderBy: (t, { desc }) => [desc(t.fechaCreacion)],
  });
}

export async function findTicketById(id: string) {
  return db.query.tickets.findFirst({
    where: eq(tickets.id, id),
    with: {
      usuario: true,
      tecnicoAsignado: true,
      categoria: true,
      comentarios: {
        with: { usuario: true },
        orderBy: (c, { asc }) => [asc(c.fechaCreacion)],
      },
      adjuntos: true,
      historiales: {
        with: { usuario: true },
        orderBy: (h, { asc }) => [asc(h.fechaCreacion)],
      },
    },
  });
}

async function generateNumero(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(tickets);
  return `TIC-${String(value + 1).padStart(5, '0')}`;
}

export async function createTicket(dto: CreateTicketInput, usuarioId: string) {
  const numero = await generateNumero();

  const [ticket] = await db
    .insert(tickets)
    .values({ ...dto, numero, usuarioId })
    .returning();

  await registrarHistorial(ticket.id, usuarioId, 'CREACION', 'Ticket creado');

  return ticket;
}

export async function updateTicket(id: string, dto: UpdateTicketInput, usuarioId: string) {
  const ticket = await findTicketById(id);
  if (!ticket) return null;

  if (dto.estado && dto.estado !== ticket.estado) {
    await registrarHistorial(
      id,
      usuarioId,
      'ESTADO',
      `Estado cambiado de ${ESTADO_LABELS[ticket.estado]} a ${ESTADO_LABELS[dto.estado]}`,
      ESTADO_LABELS[ticket.estado],
      ESTADO_LABELS[dto.estado],
    );
  }

  if (dto.prioridad && dto.prioridad !== ticket.prioridad) {
    await registrarHistorial(
      id,
      usuarioId,
      'PRIORIDAD',
      `Prioridad cambiada de ${PRIORIDAD_LABELS[ticket.prioridad]} a ${PRIORIDAD_LABELS[dto.prioridad]}`,
      PRIORIDAD_LABELS[ticket.prioridad],
      PRIORIDAD_LABELS[dto.prioridad],
    );
  }

  const updateValues: Partial<typeof tickets.$inferInsert> = { ...dto };
  if (dto.estado === 3 || dto.estado === 4) {
    updateValues.fechaResolucion = new Date();
  }

  await db.update(tickets).set(updateValues).where(eq(tickets.id, id));

  return findTicketById(id);
}

export async function asignarTicket(id: string, tecnicoId: string, usuarioId: string) {
  const ticket = await findTicketById(id);
  if (!ticket) return null;

  const anterior = ticket.tecnicoAsignado?.nombre ?? 'Sin asignar';

  await db
    .update(tickets)
    .set({ tecnicoAsignadoId: tecnicoId, estado: 2 })
    .where(eq(tickets.id, id));

  const actualizado = await findTicketById(id);

  await registrarHistorial(
    id,
    usuarioId,
    'ASIGNACION',
    `Ticket asignado a ${actualizado?.tecnicoAsignado?.nombre ?? tecnicoId}`,
    anterior,
    actualizado?.tecnicoAsignado?.nombre,
  );

  return actualizado;
}

export async function agregarComentario(ticketId: string, usuarioId: string, contenido: string) {
  const ticket = await findTicketById(ticketId);
  if (!ticket) return null;

  const [comentario] = await db
    .insert(comentarios)
    .values({ ticketId, usuarioId, contenido })
    .returning();

  await registrarHistorial(ticketId, usuarioId, 'COMENTARIO', 'Comentario agregado');

  return comentario;
}
