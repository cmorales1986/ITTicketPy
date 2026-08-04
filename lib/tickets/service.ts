import { and, count, eq, gte, isNull, lte, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tickets, comentarios, historial, usuarios, adjuntos, mensajesChat } from '@/lib/db/schema';
import {
  notificarTicketCreado,
  notificarTicketAsignado,
  notificarTicketCerrado,
  notificarNuevoMensajeChat,
} from '@/lib/notifications/whatsapp';

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
  empresaId?: string;
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

// soloDeUsuarioId: un cliente (rol 0) solo debe ver sus propios tickets acá
// — técnicos/admins pasan undefined para ver todo. Ver requireTecnicoOAdmin.
export async function findAllTickets(estado?: number, prioridad?: number, soloDeUsuarioId?: string) {
  return db.query.tickets.findMany({
    where: (t, { and, eq: eqOp }) =>
      and(
        estado ? eqOp(t.estado, estado) : undefined,
        prioridad ? eqOp(t.prioridad, prioridad) : undefined,
        soloDeUsuarioId ? eqOp(t.usuarioId, soloDeUsuarioId) : undefined,
      ),
    with: {
      usuario: true,
      tecnicoAsignado: true,
      categoria: true,
      empresa: true,
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
      empresa: true,
      comentarios: {
        with: { usuario: true },
        orderBy: (c, { asc }) => [asc(c.fechaCreacion)],
      },
      adjuntos: true,
      historiales: {
        with: { usuario: true },
        orderBy: (h, { asc }) => [asc(h.fechaCreacion)],
      },
      mensajesChat: {
        with: { usuario: true },
        orderBy: (m, { asc }) => [asc(m.fechaCreacion)],
      },
    },
  });
}

export interface FiltrosReporte {
  desde?: Date;
  hasta?: Date;
  empresaId?: string;
  estado?: number;
  categoriaId?: string;
}

// Reporte simple para auditoría: todos los tickets abiertos en un rango de
// fechas, con los datos que suelen pedir para revisar actividad (quién lo
// reportó, quién lo atendió, cuánto tardó, cómo lo calificó el cliente).
export async function findTicketsParaReporte(filtros: FiltrosReporte) {
  return db.query.tickets.findMany({
    where: (t, { and: andOp }) =>
      andOp(
        filtros.desde ? gte(t.fechaCreacion, filtros.desde) : undefined,
        filtros.hasta ? lte(t.fechaCreacion, filtros.hasta) : undefined,
        filtros.empresaId ? eq(t.empresaId, filtros.empresaId) : undefined,
        filtros.estado ? eq(t.estado, filtros.estado) : undefined,
        filtros.categoriaId ? eq(t.categoriaId, filtros.categoriaId) : undefined,
      ),
    with: {
      usuario: true,
      tecnicoAsignado: true,
      categoria: true,
      empresa: true,
    },
    orderBy: (t, { asc }) => [asc(t.fechaCreacion)],
  });
}

async function generateNumero(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(tickets);
  return `TIC-${String(value + 1).padStart(5, '0')}`;
}

// A usuario's WhatsApp thread stays tied to their most recent ticket until
// it's Cerrado (4) — new messages become comments instead of new tickets.
export async function findOpenTicketForUsuario(usuarioId: string) {
  return db.query.tickets.findFirst({
    where: and(eq(tickets.usuarioId, usuarioId), ne(tickets.estado, 4)),
    orderBy: (t, { desc }) => [desc(t.fechaCreacion)],
  });
}

// El ticket cerrado más reciente de un usuario que todavía no respondió la
// encuesta de satisfacción — su próximo mensaje por WhatsApp se interpreta
// como la respuesta en vez de clasificarse como un contacto nuevo.
export async function findTicketPendienteEncuesta(usuarioId: string) {
  return db.query.tickets.findFirst({
    where: and(eq(tickets.usuarioId, usuarioId), eq(tickets.estado, 4), isNull(tickets.calificacion)),
    orderBy: (t, { desc }) => [desc(t.fechaCreacion)],
  });
}

export async function guardarEncuesta(ticketId: string, calificacion: number, comentario: string) {
  await db
    .update(tickets)
    .set({ calificacion, comentarioEncuesta: comentario })
    .where(eq(tickets.id, ticketId));
}

// sugerenciaIA solo se usa para tickets originados por WhatsApp (ver
// app/api/webhooks/wuzapi-inbound) — un ticket creado desde el panel no
// pasa por el clasificador ni genera sugerencia.
//
// actorId es quién hace la acción (para el historial); por defecto es el
// mismo usuarioId (el propio cliente crea su ticket). Un técnico/admin
// puede crear el ticket A NOMBRE de otro usuario — en ese caso usuarioId es
// el cliente reportante y actorId es el técnico que cargó el ticket.
export async function createTicket(
  dto: CreateTicketInput,
  usuarioId: string,
  sugerenciaIA?: string | null,
  actorId?: string,
) {
  const numero = await generateNumero();
  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuarioId) });

  const [ticket] = await db
    .insert(tickets)
    // El ticket hereda la empresa del usuario que lo crea. Si el usuario
    // todavía no tiene empresa asignada (p. ej. contacto nuevo por
    // WhatsApp), el ticket queda sin empresa hasta que un admin la complete.
    .values({ ...dto, numero, usuarioId, empresaId: usuario?.empresaId })
    .returning();

  await registrarHistorial(ticket.id, actorId ?? usuarioId, 'CREACION', 'Ticket creado');

  if (usuario?.numeroWhatsApp) {
    const link = `${process.env.APP_URL}/seguimiento/${ticket.id}`;
    await notificarTicketCreado(usuario.numeroWhatsApp, numero, usuario.nombre, link, sugerenciaIA);
  }

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

  const actualizado = await findTicketById(id);

  // Por WhatsApp solo avisamos crear / asignar / cerrar — "En Progreso" y
  // "Resuelto" en el medio no notifican, para no saturar al cliente.
  if (dto.estado === 4 && dto.estado !== ticket.estado && actualizado?.usuario?.numeroWhatsApp) {
    await notificarTicketCerrado(actualizado.usuario.numeroWhatsApp, actualizado.numero);
  }

  return actualizado;
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

  if (actualizado?.usuario?.numeroWhatsApp && actualizado.tecnicoAsignado?.nombre) {
    await notificarTicketAsignado(
      actualizado.usuario.numeroWhatsApp,
      actualizado.numero,
      actualizado.tecnicoAsignado.nombre,
    );
  }

  return actualizado;
}

export async function agregarAdjunto(
  ticketId: string,
  usuarioId: string,
  nombreArchivo: string,
  rutaArchivo: string,
  tamanio: number,
) {
  const [adjunto] = await db
    .insert(adjuntos)
    .values({ ticketId, nombreArchivo, rutaArchivo, tamanio })
    .returning();

  await registrarHistorial(ticketId, usuarioId, 'ADJUNTO', `Archivo adjuntado: ${nombreArchivo}`);

  return adjunto;
}

export async function eliminarAdjunto(adjuntoId: string) {
  const adjunto = await db.query.adjuntos.findFirst({ where: eq(adjuntos.id, adjuntoId) });
  if (!adjunto) return null;

  await db.delete(adjuntos).where(eq(adjuntos.id, adjuntoId));
  return adjunto;
}

// Comentarios = notas internas del equipo. Nunca se envían por WhatsApp —
// para hablar con el cliente está el chat (agregarMensajeChat).
export async function agregarComentario(ticketId: string, usuarioId: string, contenido: string) {
  const [comentario] = await db
    .insert(comentarios)
    .values({ ticketId, usuarioId, contenido, interno: true })
    .returning();

  await registrarHistorial(ticketId, usuarioId, 'COMENTARIO', 'Nota interna agregada');

  return comentario;
}

// Conversación directa con el cliente. Cuando el mensaje lo escribe un
// técnico/admin (usuarioId distinto al dueño del ticket) se envía por
// WhatsApp; cuando lo trae el propio cliente (por WhatsApp, vía el webhook)
// no hay que reenviarle su propio mensaje.
export async function agregarMensajeChat(ticketId: string, usuarioId: string, contenido: string) {
  const ticket = await findTicketById(ticketId);
  if (!ticket) return null;

  const [mensaje] = await db
    .insert(mensajesChat)
    .values({ ticketId, usuarioId, contenido })
    .returning();

  await registrarHistorial(ticketId, usuarioId, 'CHAT', 'Mensaje de chat agregado');

  if (usuarioId !== ticket.usuarioId && ticket.usuario?.numeroWhatsApp) {
    const autor = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuarioId) });
    if (autor) {
      await notificarNuevoMensajeChat(ticket.usuario.numeroWhatsApp, ticket.numero, autor.nombre, contenido);
    }
  }

  return mensaje;
}
