import { and, count, eq, gte, isNull, lt, lte, notInArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tickets, comentarios, historial, usuarios, adjuntos, mensajesChat, aprobaciones } from '@/lib/db/schema';
import {
  notificarTicketCreado,
  notificarEquipoTicketNuevo,
  notificarTicketAsignado,
  notificarTicketCerrado,
  notificarTicketResuelto,
  notificarNuevoMensajeChat,
} from '@/lib/notifications/whatsapp';
import {
  ANIOS_CONSERVACION,
  ESTADO,
  ESTADOS_FINALES,
  APROBACION_LABELS,
  RESULTADOS_PRUEBAS,
  TIPOS_SIN_PLAZO_RESOLUCION,
  esDesarrolloOMejora,
  transicionPermitida,
  type AprobacionTipo,
} from '@/lib/tickets/estados';
import {
  calcularReapertura,
  calcularSla,
  horarioDe,
  type ConfigPlazos,
  type TicketParaSla,
} from '@/lib/tickets/plazos';
import { jornadaMinutos, limitesDeRango, minutosHabilesEntre } from '@/lib/tickets/horario';
import { validarReglasP2 } from '@/lib/tickets/reglas';
import { obtenerConfigPlazos } from '@/lib/config/service';

const ESTADO_LABELS: Record<number, string> = {
  1: 'Nuevo',
  2: 'En Proceso',
  3: 'Resuelto',
  4: 'Cerrado',
  5: 'Cancelado',
};

// Error de regla de negocio (transición no permitida, falta un dato
// obligatorio). La API lo traduce a 400 con el mensaje tal cual.
export class TicketReglaError extends Error {
  // Código opcional para que la UI sepa pedir el dato que falta (ej.
  // MOTIVO_DESVIO) en vez de solo mostrar el mensaje.
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// Agrega a cada ticket su medición de plazos (primera respuesta y
// resolución, en horas hábiles). Se calcula al leer: nunca queda desfasada.
function conSla<T extends TicketParaSla & { fechaCierre?: Date | string | null }>(
  ticket: T,
  cfg: ConfigPlazos,
  ahora = new Date(),
) {
  return {
    ...ticket,
    sla: calcularSla(ticket, cfg, ahora),
    // Solo para tickets Cerrados: si todavía se pueden reabrir.
    reapertura: calcularReapertura(ticket, cfg, ahora),
  };
}

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
  // PR-INF-03: canal de ingreso y clasificación. Si no se pasan, el ticket
  // queda como incidente sin módulo ni urgencia declarados.
  canal?: string;
  tipo?: number;
  sistemaModulo?: string;
  urgencia?: number;
  // Ticket del que este es continuación (reapertura fuera de plazo o falla
  // repetida).
  ticketAnteriorId?: string;
  // Lugar de origen (OFICINA | GRANJA) y cuándo se recibió el reporte.
  lugarOrigen?: string;
  fechaRecepcion?: Date;
}

export interface UpdateTicketInput {
  titulo?: string;
  descripcion?: string;
  prioridad?: number;
  estado?: number;
  categoriaId?: string;
  empresaId?: string;
  tipo?: number;
  sistemaModulo?: string;
  urgencia?: number;
  solucion?: string;
  motivoCancelacion?: string;
  dependeProveedor?: boolean;
  proveedorNombre?: string;
  proveedorFechaCompromiso?: string; // fecha ISO (YYYY-MM-DD)
  proveedorNotas?: string;
  motivoDesvio?: string;
  motivoReapertura?: string; // obligatorio al reabrir un ticket Cerrado
  lugarOrigen?: string;
  // P2: evaluación, pruebas y puesta en producción (solo desarrollo y mejora)
  evalAlcance?: string;
  evalEsfuerzo?: string;
  evalConCosto?: boolean;
  evalCosto?: string;
  evalImpacto?: string;
  plazoPropuesto?: string; // "YYYY-MM-DD" o "" para borrarlo
  pruebasResultado?: string;
  pruebasFecha?: string;
  pruebasNota?: string;
  produccionFecha?: string;
  // P2: proveedor, causa y reincidencia
  proveedorEntregablesVerificados?: boolean;
  analisisCausa?: string;
  reincidente?: boolean;
}

const CAMPOS_EVALUACION = [
  'evalAlcance',
  'evalEsfuerzo',
  'evalConCosto',
  'evalCosto',
  'evalImpacto',
  'plazoPropuesto',
] as const;
const CAMPOS_PRUEBAS = ['pruebasResultado', 'pruebasFecha', 'pruebasNota'] as const;
const CAMPOS_SOLO_DESARROLLO = [...CAMPOS_EVALUACION, ...CAMPOS_PRUEBAS, 'produccionFecha'] as const;

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
  const [lista, cfg] = await Promise.all([
    findAllTicketsSinSla(estado, prioridad, soloDeUsuarioId),
    obtenerConfigPlazos(),
  ]);
  const ahora = new Date();
  return lista.map((t) => conSla(t, cfg, ahora));
}

async function findAllTicketsSinSla(estado?: number, prioridad?: number, soloDeUsuarioId?: string) {
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
  const ticket = await cargarTicket(id);
  if (!ticket) return ticket;
  return {
    ...conSla(ticket, await obtenerConfigPlazos()),
    // Cuántos tickets del mismo sistema o servicio hubo en los últimos 30 días
    // (este incluido): 3 o más sugiere reincidencia.
    mismoSistema30d: await contarMismoSistema30d(ticket.sistemaModulo),
  };
}

async function contarMismoSistema30d(sistema: string | null): Promise<number> {
  if (!sistema) return 0;
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [{ value }] = await db
    .select({ value: count() })
    .from(tickets)
    .where(and(eq(tickets.sistemaModulo, sistema), gte(tickets.fechaCreacion, desde)));
  return value;
}

async function cargarTicket(id: string) {
  return db.query.tickets.findFirst({
    where: eq(tickets.id, id),
    with: {
      usuario: true,
      tecnicoAsignado: true,
      categoria: true,
      empresa: true,
      ticketAnterior: true,
      continuaciones: true,
      aprobaciones: {
        with: { registradoPor: true },
        orderBy: (a, { asc }) => [asc(a.fechaRegistro)],
      },
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
  const [lista, cfg] = await Promise.all([findTicketsParaReporteSinSla(filtros), obtenerConfigPlazos()]);
  const ahora = new Date();
  return lista.map((t) => conSla(t, cfg, ahora));
}

async function findTicketsParaReporteSinSla(filtros: FiltrosReporte) {
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
// it's Cerrado o Cancelado — new messages become comments instead of new tickets.
export async function findOpenTicketForUsuario(usuarioId: string) {
  return db.query.tickets.findFirst({
    where: and(eq(tickets.usuarioId, usuarioId), notInArray(tickets.estado, ESTADOS_FINALES)),
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

  const anterior = dto.ticketAnteriorId
    ? await db.query.tickets.findFirst({ where: eq(tickets.id, dto.ticketAnteriorId) })
    : null;
  await registrarHistorial(
    ticket.id,
    actorId ?? usuarioId,
    'CREACION',
    `${dto.canal ? `Ticket creado (canal: ${dto.canal})` : 'Ticket creado'}${
      dto.fechaRecepcion
        ? ` — reporte recibido el ${dto.fechaRecepcion.toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
        : ''
    }${anterior ? ` — vinculado al ticket anterior ${anterior.numero}` : ''}`,
  );
  if (anterior) {
    await registrarHistorial(
      anterior.id,
      actorId ?? usuarioId,
      'VINCULO',
      `Se creó el ticket ${ticket.numero} como continuación de este`,
    );
  }

  if (usuario?.numeroWhatsApp) {
    const link = `${process.env.APP_URL}/seguimiento/${ticket.id}`;
    await notificarTicketCreado(usuario.numeroWhatsApp, numero, usuario.nombre, link, sugerenciaIA);
  }

  // Aviso a los administradores. Si lo cargó un administrador a mano desde el
  // portal (actorId), no se le avisa a él.
  await notificarEquipoTicketNuevo(ticket, usuario?.nombre ?? 'Usuario', actorId);

  return ticket;
}

export async function updateTicket(id: string, dto: UpdateTicketInput, usuarioId: string) {
  const ticket = await cargarTicket(id);
  if (!ticket) return null;

  const cambiaEstado = !!dto.estado && dto.estado !== ticket.estado;
  const solucion = dto.solucion?.trim();
  const motivoCancelacion = dto.motivoCancelacion?.trim();

  // Todas las validaciones van ANTES de escribir nada, para que un cambio
  // rechazado no deje historial ni datos a medias.
  if (cambiaEstado) {
    if (!transicionPermitida(ticket.estado, dto.estado!)) {
      throw new TicketReglaError(
        `No se puede pasar de ${ESTADO_LABELS[ticket.estado]} a ${ESTADO_LABELS[dto.estado!]}`,
      );
    }
    if (dto.estado === ESTADO.RESUELTO && !solucion) {
      throw new TicketReglaError('Para pasar a Resuelto hay que indicar la solución aplicada');
    }
    if (dto.estado === ESTADO.CANCELADO && !motivoCancelacion) {
      throw new TicketReglaError('Para cancelar el ticket hay que indicar el motivo');
    }
  }

  // P2: análisis de causa y puesta en producción. Los valores ya recortados se
  // reutilizan más abajo para el historial y para guardar.
  const analisisCausa = dto.analisisCausa !== undefined ? dto.analisisCausa.trim() : undefined;
  const produccionNueva = dto.produccionFecha?.trim();

  // Reglas de P2 (causa, proveedor, conformidad, aprobaciones, producción).
  const incumplida = validarReglasP2(
    ticket,
    {
      estado: dto.estado,
      prioridad: dto.prioridad,
      reincidente: dto.reincidente,
      analisisCausa,
      dependeProveedor: dto.dependeProveedor,
      proveedorEntregablesVerificados: dto.proveedorEntregablesVerificados,
      evalConCosto: dto.evalConCosto,
      produccionFecha: produccionNueva,
      camposDesarrolloTocados: CAMPOS_SOLO_DESARROLLO.some((c) => dto[c] !== undefined),
    },
    cambiaEstado,
  );
  if (incumplida) throw new TicketReglaError(incumplida.message, incumplida.code);

  // Reapertura de un ticket Cerrado: solo dentro de N días hábiles posteriores
  // al cierre y con motivo. Pasado ese plazo hay que crear un ticket nuevo
  // vinculado (ticketAnteriorId).
  const motivoReapertura = dto.motivoReapertura?.trim();
  const esReapertura = cambiaEstado && ticket.estado === ESTADO.CERRADO && dto.estado === ESTADO.EN_PROCESO;
  if (esReapertura) {
    const cfg = await obtenerConfigPlazos();
    if (!calcularReapertura(ticket, cfg)?.permitida) {
      throw new TicketReglaError(
        `Pasó el plazo para reabrir este ticket (${cfg.cierre.diasReapertura} días hábiles desde el cierre). Creá un ticket nuevo vinculado a este`,
        'REAPERTURA_VENCIDA',
      );
    }
    if (!motivoReapertura) {
      throw new TicketReglaError('Para reabrir el ticket hay que indicar el motivo', 'MOTIVO_REAPERTURA');
    }
  }

  // Derivación a proveedor: al marcarla hay que decir a quién.
  const proveedorNuevo = dto.proveedorNombre?.trim() || ticket.proveedorNombre;
  const cambiaProveedor =
    dto.dependeProveedor !== undefined && dto.dependeProveedor !== ticket.dependeProveedor;
  if (dto.dependeProveedor === true && !proveedorNuevo) {
    throw new TicketReglaError('Indicá el proveedor al marcar el ticket como dependiente de un proveedor');
  }
  // Un ticket Crítico que superó su plazo de resolución no se puede cerrar
  // sin explicar el desvío.
  const motivoDesvio = dto.motivoDesvio?.trim();
  if (cambiaEstado && dto.estado === ESTADO.CERRADO) {
    const prioridadFinal = dto.prioridad ?? ticket.prioridad;
    if (
      prioridadFinal === 4 &&
      !TIPOS_SIN_PLAZO_RESOLUCION.includes(ticket.tipo) &&
      !(motivoDesvio || ticket.motivoDesvio)
    ) {
      const cfg = await obtenerConfigPlazos();
      const sla = calcularSla({ ...ticket, prioridad: prioridadFinal }, cfg);
      if (sla.resolucion.estado === 'vencido' || sla.resolucion.estado === 'cumplido_tarde') {
        throw new TicketReglaError(
          'Este ticket Crítico superó su plazo de resolución: indicá el motivo del desvío para cerrarlo',
          'MOTIVO_DESVIO',
        );
      }
    }
  }

  // Cambiar el lugar de origen cambia el horario con el que se miden los
  // plazos: queda constancia.
  if (dto.lugarOrigen && dto.lugarOrigen !== ticket.lugarOrigen) {
    await registrarHistorial(
      id,
      usuarioId,
      'LUGAR',
      `Lugar de origen: ${ticket.lugarOrigen ?? 'sin registrar'} → ${dto.lugarOrigen}`,
      ticket.lugarOrigen ?? 'Sin registrar',
      dto.lugarOrigen,
    );
  }

  if (motivoDesvio && motivoDesvio !== ticket.motivoDesvio) {
    await registrarHistorial(id, usuarioId, 'DESVIO', `Motivo del desvío: ${motivoDesvio}`);
  }

  if (cambiaProveedor) {
    await registrarHistorial(
      id,
      usuarioId,
      'PROVEEDOR',
      dto.dependeProveedor
        ? `Derivado a proveedor: ${proveedorNuevo}${dto.proveedorFechaCompromiso ? ` (compromiso ${dto.proveedorFechaCompromiso})` : ''}`
        : 'El ticket dejó de depender del proveedor',
      ticket.dependeProveedor ? 'Depende de proveedor' : 'Sin proveedor',
      dto.dependeProveedor ? 'Depende de proveedor' : 'Sin proveedor',
    );
  }

  if (cambiaEstado) {
    const detalle =
      dto.estado === ESTADO.RESUELTO
        ? ` — Solución: ${solucion}`
        : dto.estado === ESTADO.CANCELADO
          ? ` — Motivo: ${motivoCancelacion}`
          : esReapertura
            ? ` — Reapertura n.º ${ticket.reaperturas + 1}: ${motivoReapertura}`
            : dto.estado === ESTADO.EN_PROCESO && ticket.estado === ESTADO.RESUELTO && motivoReapertura
              ? ` — El usuario objetó la solución: ${motivoReapertura}`
              : '';
    await registrarHistorial(
      id,
      usuarioId,
      'ESTADO',
      `Estado cambiado de ${ESTADO_LABELS[ticket.estado]} a ${ESTADO_LABELS[dto.estado!]}${detalle}`,
      ESTADO_LABELS[ticket.estado],
      ESTADO_LABELS[dto.estado!],
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

  // Constancia en el historial de lo que se evaluó, probó y puso en producción.
  const cambio = (campos: readonly (keyof UpdateTicketInput)[]) =>
    campos.filter(
      (c) => dto[c] !== undefined && (dto[c] ?? '') !== ((ticket as Record<string, unknown>)[c] ?? ''),
    );
  const cambiosEvaluacion = cambio(CAMPOS_EVALUACION);
  if (cambiosEvaluacion.length > 0) {
    await registrarHistorial(
      id,
      usuarioId,
      'EVALUACION',
      `Evaluación actualizada (${cambiosEvaluacion.join(', ')})${dto.plazoPropuesto ? ` — plazo propuesto: ${dto.plazoPropuesto}` : ''}`,
    );
  }
  if (cambio(CAMPOS_PRUEBAS).length > 0) {
    const r = dto.pruebasResultado ?? ticket.pruebasResultado;
    await registrarHistorial(
      id,
      usuarioId,
      'PRUEBAS',
      `Pruebas: ${r ? (RESULTADOS_PRUEBAS[r] ?? r) : 'sin resultado'}${dto.pruebasFecha ? ` (${dto.pruebasFecha})` : ''}${dto.pruebasNota ? ` — ${dto.pruebasNota}` : ''}`,
    );
  }
  if (produccionNueva) {
    await registrarHistorial(id, usuarioId, 'PRODUCCION', `Puesta en producción registrada (${produccionNueva})`);
  }
  if (analisisCausa !== undefined && analisisCausa !== (ticket.analisisCausa ?? '')) {
    await registrarHistorial(
      id,
      usuarioId,
      'CAUSA',
      analisisCausa ? 'Análisis de causa registrado' : 'Análisis de causa borrado',
      undefined,
      analisisCausa || undefined,
    );
  }
  if (dto.reincidente !== undefined && dto.reincidente !== ticket.reincidente) {
    await registrarHistorial(
      id,
      usuarioId,
      'REINCIDENCIA',
      dto.reincidente ? 'Ticket marcado como reincidente' : 'Ticket desmarcado como reincidente',
    );
  }
  if (
    dto.proveedorEntregablesVerificados !== undefined &&
    dto.proveedorEntregablesVerificados !== ticket.proveedorEntregablesVerificados
  ) {
    await registrarHistorial(
      id,
      usuarioId,
      'PROVEEDOR',
      dto.proveedorEntregablesVerificados
        ? 'Entregables del proveedor verificados'
        : 'Entregables del proveedor sin verificar',
    );
  }

  const { proveedorFechaCompromiso, motivoReapertura: _motivoReapertura, ...dtoSinFecha } = dto;
  void _motivoReapertura; // solo va al historial, no es columna
  const updateValues: Partial<typeof tickets.$inferInsert> = { ...dtoSinFecha };
  if (proveedorFechaCompromiso !== undefined) {
    updateValues.proveedorFechaCompromiso = proveedorFechaCompromiso
      ? new Date(`${proveedorFechaCompromiso}T12:00:00`)
      : null;
  }
  // La solución / el motivo solo se guardan en el ticket cuando corresponde
  // a la transición; si no, se ignoran para no pisar lo ya registrado.
  // Fechas de P2: "" borra el valor. La puesta en producción no se borra.
  for (const campo of ['plazoPropuesto', 'pruebasFecha'] as const) {
    if (dto[campo] !== undefined) updateValues[campo] = dto[campo] || null;
  }
  if (!produccionNueva) delete updateValues.produccionFecha;
  if (analisisCausa !== undefined) updateValues.analisisCausa = analisisCausa || null;

  delete updateValues.solucion;
  delete updateValues.motivoCancelacion;
  delete updateValues.motivoDesvio;
  if (motivoDesvio) updateValues.motivoDesvio = motivoDesvio;
  if (cambiaEstado && dto.estado === ESTADO.RESUELTO) updateValues.solucion = solucion;
  if (cambiaEstado && dto.estado === ESTADO.CANCELADO) updateValues.motivoCancelacion = motivoCancelacion;

  if (cambiaEstado) {
    const ahora = new Date();
    if (dto.estado === ESTADO.RESUELTO) {
      updateValues.fechaResolucion = ahora;
    } else if (dto.estado === ESTADO.CERRADO) {
      // fechaResolucion queda como la del paso a Resuelto (es lo que mide el
      // plazo de resolución); el cierre tiene su propia fecha.
      updateValues.fechaCierre = ahora;
      updateValues.cerradoSinRespuesta = false;
    } else if (dto.estado === ESTADO.CANCELADO) {
      updateValues.fechaResolucion = ahora;
      updateValues.fechaCierre = ahora;
    } else if (dto.estado === ESTADO.EN_PROCESO) {
      // Reapertura / objeción: vuelve a estar en curso. Las fechas anteriores
      // quedan en el historial.
      updateValues.fechaResolucion = null;
      updateValues.fechaCierre = null;
      updateValues.cerradoSinRespuesta = false;
      if (esReapertura) updateValues.reaperturas = ticket.reaperturas + 1;
    }
    // El primer paso a En Proceso cuenta como primera respuesta.
    if (dto.estado === ESTADO.EN_PROCESO && !ticket.fechaPrimeraRespuesta) {
      updateValues.fechaPrimeraRespuesta = new Date();
    }
  }

  await db.update(tickets).set(updateValues).where(eq(tickets.id, id));

  const actualizado = await findTicketById(id);

  // Por WhatsApp se avisa crear / asignar / resolver / cerrar. "En Proceso" no
  // notifica, para no saturar al cliente. Al resolver, el bot le informa la
  // solución por el mismo canal por el que reportó y le pide conformidad
  // (PR-INF-03); los tickets de correo o llamada se confirman a mano.
  if (
    dto.estado === ESTADO.RESUELTO &&
    cambiaEstado &&
    actualizado?.canal === 'WHATSAPP' &&
    actualizado.usuario?.numeroWhatsApp &&
    actualizado.solucion
  ) {
    await notificarTicketResuelto(actualizado.usuario.numeroWhatsApp, actualizado.numero, actualizado.solucion);
  }
  if (dto.estado === 4 && dto.estado !== ticket.estado && actualizado?.usuario?.numeroWhatsApp) {
    await notificarTicketCerrado(actualizado.usuario.numeroWhatsApp, actualizado.numero);
  }

  return actualizado;
}

export async function asignarTicket(id: string, tecnicoId: string, usuarioId: string) {
  const ticket = await cargarTicket(id);
  if (!ticket) return null;

  const anterior = ticket.tecnicoAsignado?.nombre ?? 'Sin asignar';

  // Asignar un ticket Nuevo lo pasa a En Proceso; en cualquier otro estado
  // solo cambia el responsable (no se fuerza una transición no permitida).
  const pasaAEnProceso = ticket.estado === ESTADO.NUEVO;
  await db
    .update(tickets)
    .set({
      tecnicoAsignadoId: tecnicoId,
      ...(pasaAEnProceso ? { estado: ESTADO.EN_PROCESO } : {}),
      ...(pasaAEnProceso && !ticket.fechaPrimeraRespuesta ? { fechaPrimeraRespuesta: new Date() } : {}),
    })
    .where(eq(tickets.id, id));

  if (pasaAEnProceso) {
    await registrarHistorial(
      id,
      usuarioId,
      'ESTADO',
      `Estado cambiado de ${ESTADO_LABELS[ESTADO.NUEVO]} a ${ESTADO_LABELS[ESTADO.EN_PROCESO]}`,
      ESTADO_LABELS[ESTADO.NUEVO],
      ESTADO_LABELS[ESTADO.EN_PROCESO],
    );
  }

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

  // Los adjuntos de un ticket Cerrado o Cancelado son evidencia: se
  // conservan 3 años desde el cierre (también lo bloquea la base).
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, adjunto.ticketId) });
  if (ticket && ESTADOS_FINALES.includes(ticket.estado)) {
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - ANIOS_CONSERVACION);
    if (!ticket.fechaCierre || new Date(ticket.fechaCierre) >= limite) {
      throw new TicketReglaError(
        `Este ticket está ${ticket.estado === ESTADO.CERRADO ? 'cerrado' : 'cancelado'}: sus adjuntos se conservan ${ANIOS_CONSERVACION} años desde el cierre`,
        'CONSERVACION',
      );
    }
  }

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
  const ticket = await cargarTicket(ticketId);
  if (!ticket) return null;

  const [mensaje] = await db
    .insert(mensajesChat)
    .values({ ticketId, usuarioId, contenido })
    .returning();

  await registrarHistorial(ticketId, usuarioId, 'CHAT', 'Mensaje de chat agregado');

  if (usuarioId !== ticket.usuarioId) {
    const autor = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuarioId) });

    // Primer mensaje del equipo (técnico/admin) al usuario = primera
    // respuesta del ticket. Solo la primera vez.
    if (autor && autor.rol >= 1 && !ticket.fechaPrimeraRespuesta) {
      await db
        .update(tickets)
        .set({ fechaPrimeraRespuesta: new Date() })
        .where(and(eq(tickets.id, ticketId), isNull(tickets.fechaPrimeraRespuesta)));
    }

    if (autor && ticket.usuario?.numeroWhatsApp) {
      await notificarNuevoMensajeChat(ticket.usuario.numeroWhatsApp, ticket.numero, autor.nombre, contenido);
    }
  }

  return mensaje;
}

// Cierre automático (cron diario): un ticket Resuelto cuyo usuario no
// respondió en N días hábiles desde que se le comunicó la solución pasa a
// Cerrado, con marca y constancia en el historial. Si el usuario escribió algo
// después de la solución (puede ser una objeción) no se cierra solo: lo decide
// el equipo.
export async function cerrarResueltosSinRespuesta(ahora = new Date()) {
  const cfg = await obtenerConfigPlazos();

  const resueltos = await db.query.tickets.findMany({
    where: eq(tickets.estado, ESTADO.RESUELTO),
    with: { usuario: true, mensajesChat: true },
  });

  const cerrados: string[] = [];
  for (const t of resueltos) {
    if (!t.fechaResolucion) continue;
    // Desarrollo y mejora exigen la conformidad del usuario para cerrarse: no
    // se cierran solos por falta de respuesta.
    if (esDesarrolloOMejora(t.tipo)) continue;
    // Los días hábiles se cuentan con el horario del lugar de origen del ticket.
    const h = horarioDe(t.lugarOrigen, cfg);
    const maxMin = cfg.cierre.diasCierre * jornadaMinutos(h.horario);
    if (minutosHabilesEntre(new Date(t.fechaResolucion), ahora, h) < maxMin) continue;

    const respondio = t.mensajesChat.some(
      (m) => m.usuarioId === t.usuarioId && new Date(m.fechaCreacion) > new Date(t.fechaResolucion!),
    );
    if (respondio) continue;

    await db
      .update(tickets)
      .set({ estado: ESTADO.CERRADO, fechaCierre: ahora, cerradoSinRespuesta: true })
      .where(and(eq(tickets.id, t.id), eq(tickets.estado, ESTADO.RESUELTO)));

    await db.insert(historial).values({
      ticketId: t.id,
      usuarioId: null, // lo hizo el sistema
      tipo: 'CIERRE_AUTOMATICO',
      valorAnterior: ESTADO_LABELS[ESTADO.RESUELTO],
      valorNuevo: ESTADO_LABELS[ESTADO.CERRADO],
      descripcion: `Cerrado automáticamente sin respuesta del usuario: pasaron ${cfg.cierre.diasCierre} días hábiles desde que se le comunicó la solución`,
    });

    if (t.usuario?.numeroWhatsApp) {
      await notificarTicketCerrado(t.usuario.numeroWhatsApp, t.numero);
    }
    cerrados.push(t.numero);
  }
  return { revisados: resueltos.length, cerrados };
}

// Tickets recibidos en un período (rango de días, hora de Paraguay), ya con su
// medición de plazos. La recepción es la del reporte (o la creación del ticket
// si no hay otra). Base de los reportes de auditoría.
export async function findTicketsRecibidosEnPeriodo(desdeDia: string, hastaDia: string) {
  const { desde, hasta } = limitesDeRango(desdeDia, hastaDia);
  // Fechas como texto ISO (UTC): las columnas son timestamp sin zona y se
  // guardan en UTC.
  const recepcion = sql`coalesce(${tickets.fechaRecepcion}, ${tickets.fechaCreacion})`;
  const [lista, cfg] = await Promise.all([
    db.query.tickets.findMany({
      where: and(gte(recepcion, desde.toISOString()), lt(recepcion, hasta.toISOString())),
      orderBy: (t, { asc }) => [asc(t.fechaCreacion)],
    }),
    obtenerConfigPlazos(),
  ]);
  const ahora = new Date();
  return lista.map((t) => conSla(t, cfg, ahora));
}

// Conformidad del usuario con la solución, registrada por el equipo (por
// ejemplo, el usuario confirmó por correo o por teléfono). Queda con fecha,
// canal y quién la registró.
export async function registrarConformidad(id: string, usuarioId: string, canal: string, nota?: string) {
  const ticket = await cargarTicket(id);
  if (!ticket) return null;
  if (![ESTADO.EN_PROCESO, ESTADO.RESUELTO, ESTADO.CERRADO].includes(ticket.estado as 2 | 3 | 4)) {
    throw new TicketReglaError('La conformidad se registra sobre un ticket en proceso, resuelto o cerrado');
  }

  await db
    .update(tickets)
    .set({ conformidadFecha: new Date(), conformidadCanal: canal, conformidadNota: nota?.trim() || null })
    .where(eq(tickets.id, id));
  await registrarHistorial(
    id,
    usuarioId,
    'CONFORMIDAD',
    `Conformidad del usuario registrada (canal: ${canal})${nota?.trim() ? ` — ${nota.trim()}` : ''}`,
  );
  return findTicketById(id);
}

// Todos los tickets de un período (rango de días, hora de Paraguay): los
// recibidos en el período y los que se cerraron o cancelaron en él. Base de la
// exportación a Excel.
export async function findTicketsDelPeriodo(desdeDia: string, hastaDia: string) {
  const { desde, hasta } = limitesDeRango(desdeDia, hastaDia);
  return db.query.tickets.findMany({
    where: (t, { and: andOp, or, gte: gteOp, lt }) =>
      or(
        andOp(gteOp(t.fechaCreacion, desde), lt(t.fechaCreacion, hasta)),
        andOp(gteOp(t.fechaRecepcion, desde), lt(t.fechaRecepcion, hasta)),
        andOp(gteOp(t.fechaCierre, desde), lt(t.fechaCierre, hasta)),
      ),
    with: { usuario: true, tecnicoAsignado: true, categoria: true, empresa: true },
    orderBy: (t, { asc }) => [asc(t.fechaCreacion)],
  });
}

// Aprobaciones de una solicitud de desarrollo o mejora: quién aprobó, cuándo y
// el comentario o evidencia. Solo de alta; si hay un error se registra otra.
export async function registrarAprobacion(
  ticketId: string,
  registradoPorId: string,
  datos: { tipo: AprobacionTipo; aprobadoPor: string; fechaAprobacion: string; comentario: string },
) {
  const ticket = await cargarTicket(ticketId);
  if (!ticket) return null;
  if (!esDesarrolloOMejora(ticket.tipo)) {
    throw new TicketReglaError('Las aprobaciones son solo para solicitudes de desarrollo y mejora');
  }
  if (datos.tipo === 'GG' && !ticket.evalConCosto) {
    throw new TicketReglaError('La aprobación de Gerencia General es solo si la solicitud tiene costo');
  }

  await db.insert(aprobaciones).values({
    ticketId,
    tipo: datos.tipo,
    aprobadoPor: datos.aprobadoPor.trim(),
    fechaAprobacion: datos.fechaAprobacion,
    comentario: datos.comentario.trim(),
    registradoPorId,
  });
  await registrarHistorial(
    ticketId,
    registradoPorId,
    'APROBACION',
    `Aprobación de ${APROBACION_LABELS[datos.tipo].titulo}: ${datos.aprobadoPor.trim()} (${datos.fechaAprobacion}) — ${datos.comentario.trim()}`,
  );
  return findTicketById(ticketId);
}
