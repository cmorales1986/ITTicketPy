import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  bigint,
  timestamp,
  varchar,
  date,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const empresas = pgTable('empresas', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  activa: boolean('activa').notNull().default(true),
  // Los tickets nuevos de esta empresa se asignan solos a este técnico.
  tecnicoPredeterminadoId: uuid('tecnicoPredeterminadoId').references((): AnyPgColumn => usuarios.id),
});

export const usuarios = pgTable('usuarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  numeroWhatsApp: varchar('numeroWhatsApp', { length: 50 }),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  passwordHash: text('passwordHash').notNull(),
  rol: integer('rol').notNull().default(0), // 0=Usuario, 1=Técnico, 2=Admin
  empresaId: uuid('empresaId').references(() => empresas.id),
  activo: boolean('activo').notNull().default(true),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
  // true una vez que el usuario (o un admin) le puso una contraseña real.
  // Las cuentas que se auto-crean por WhatsApp/email quedan con un hash
  // aleatorio e inusable y esto en false, hasta que la persona se registra
  // por el portal — ahí "reclama" esa cuenta en vez de duplicarla.
  registrado: boolean('registrado').notNull().default(false),
  // Borrador de un ticket por WhatsApp esperando más detalle del cliente
  // (le preguntamos algo como "¿qué mensaje te da?" y todavía no respondió).
  // Se descarta solo si pasó demasiado tiempo — ver BORRADOR_TTL_MS.
  borradorTicket: text('borradorTicket'),
  borradorFecha: timestamp('borradorFecha'),
  // Le preguntamos si un mensaje era parte de su ticket abierto o un
  // problema nuevo, y estamos esperando que responda 1 o 2. Sin FK a
  // tickets a propósito — es estado efímero, se limpia apenas contesta.
  confirmacionTicketId: uuid('confirmacionTicketId'),
  confirmacionTexto: text('confirmacionTexto'),
  confirmacionFecha: timestamp('confirmacionFecha'),
  // Último mensaje que LE mandamos por WhatsApp — para no repetir el
  // "Buenas tardes" en cada mensaje durante un ida y vuelta seguido.
  ultimoMensajeWhatsApp: timestamp('ultimoMensajeWhatsApp'),
});

export const categorias = pgTable('categorias', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  activa: boolean('activa').notNull().default(true),
});

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  numero: varchar('numero', { length: 50 }).notNull().unique(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descripcion: text('descripcion').notNull(),
  prioridad: integer('prioridad').notNull().default(2), // 1=Baja,2=Media,3=Alta,4=Crítica
  estado: integer('estado').notNull().default(1), // 1=Nuevo,2=En Proceso,3=Resuelto,4=Cerrado,5=Cancelado
  usuarioId: uuid('usuarioId')
    .notNull()
    .references(() => usuarios.id),
  tecnicoAsignadoId: uuid('tecnicoAsignadoId').references(() => usuarios.id),
  categoriaId: uuid('categoriaId').references(() => categorias.id),
  empresaId: uuid('empresaId').references(() => empresas.id),
  tiempoResponseMinutos: integer('tiempoResponseMinutos').notNull().default(480),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
  fechaResolucion: timestamp('fechaResolucion'),
  // Encuesta de satisfacción (se pide por WhatsApp al cerrar el ticket)
  calificacion: integer('calificacion'), // 1-5
  comentarioEncuesta: text('comentarioEncuesta'),
  // PR-INF-03: canal por el que ingresó (WHATSAPP | CORREO | LLAMADA).
  // NULL en los tickets históricos, anteriores a este campo.
  canal: varchar('canal', { length: 20 }),
  tipo: integer('tipo').notNull().default(1), // 1=Incidente/Soporte, 2=Solicitud de desarrollo, 3=Mejora
  sistemaModulo: varchar('sistemaModulo', { length: 255 }),
  urgencia: integer('urgencia'), // urgencia percibida por el usuario, 1-4
  // Obligatorios al pasar a Resuelto / Cancelado.
  solucion: text('solucion'),
  motivoCancelacion: text('motivoCancelacion'),
  // Derivación a proveedor o recurso externo: el ticket sigue En Proceso pero
  // queda marcado como dependiente de un tercero (y se ve aparte en el Kanban).
  dependeProveedor: boolean('dependeProveedor').notNull().default(false),
  proveedorNombre: varchar('proveedorNombre', { length: 255 }),
  proveedorFechaCompromiso: timestamp('proveedorFechaCompromiso'),
  proveedorNotas: text('proveedorNotas'), // hitos y verificación de entregables
  // Primer mensaje al usuario por parte del equipo, o primer paso a En
  // Proceso: lo que mide el plazo de primera respuesta (PR-INF-03).
  fechaPrimeraRespuesta: timestamp('fechaPrimeraRespuesta'),
  // Obligatorio para cerrar un ticket Crítico que superó su plazo de resolución.
  motivoDesvio: text('motivoDesvio'),
  // Cuándo pasó a un estado final (Cerrado o Cancelado). Desde acá corren el
  // plazo de reapertura y la conservación de 3 años.
  fechaCierre: timestamp('fechaCierre'),
  reaperturas: integer('reaperturas').notNull().default(0),
  // Cerrado automáticamente porque el usuario no respondió a la solución.
  cerradoSinRespuesta: boolean('cerradoSinRespuesta').notNull().default(false),
  // Ticket del que este es continuación (reapertura fuera de plazo o falla
  // repetida). Sin .references() para evitar la referencia circular de
  // tipos; la FK existe en la migración.
  ticketAnteriorId: uuid('ticketAnteriorId'),
  // Lugar de origen del reporte (OFICINA | GRANJA): define el horario con el
  // que se cuentan los plazos. NULL = sin registrar, se trata como oficina.
  lugarOrigen: varchar('lugarOrigen', { length: 10 }),
  // Cuándo se recibió el reporte, si difiere de cuándo se cargó el ticket
  // (correo o llamada cargados después). Los plazos corren desde acá.
  fechaRecepcion: timestamp('fechaRecepcion'),
  // Conformidad del usuario con la solución, registrada por el equipo.
  conformidadFecha: timestamp('conformidadFecha'),
  conformidadCanal: varchar('conformidadCanal', { length: 20 }),
  conformidadNota: text('conformidadNota'),

  // --- P2: solicitudes de desarrollo y mejora (campos simples, sin flujos) ---
  // Evaluación. El plazo propuesto es el plazo de resolución de estos tipos.
  evalAlcance: text('evalAlcance'),
  evalEsfuerzo: varchar('evalEsfuerzo', { length: 100 }), // texto libre: "16 horas", "3 días"
  evalConCosto: boolean('evalConCosto').notNull().default(false), // si hay costo, se pide Gerencia General
  evalCosto: varchar('evalCosto', { length: 100 }),
  evalImpacto: text('evalImpacto'), // impacto sobre otros sistemas
  plazoPropuesto: date('plazoPropuesto', { mode: 'string' }),
  // Pruebas.
  pruebasResultado: varchar('pruebasResultado', { length: 20 }), // APROBADAS | CON_OBSERVACIONES | RECHAZADAS
  pruebasFecha: date('pruebasFecha', { mode: 'string' }),
  pruebasNota: text('pruebasNota'),
  // Puesta en producción (exige conformidad y aprobación del Gerente de TI).
  produccionFecha: date('produccionFecha', { mode: 'string' }),
  // Entregables del proveedor verificados (para poder resolver un ticket
  // que depende de un proveedor).
  proveedorEntregablesVerificados: boolean('proveedorEntregablesVerificados').notNull().default(false),

  // --- P2: análisis de causa y reincidencia ---
  analisisCausa: text('analisisCausa'), // obligatorio para Críticos y reincidentes antes de resolver
  reincidente: boolean('reincidente').notNull().default(false), // casilla manual
});

// Aprobaciones de solicitudes de desarrollo y mejora. Cada una guarda quién
// aprobó, cuándo y el comentario o evidencia. Solo de alta: no se modifica ni
// se borra (trigger en drizzle/0006); si hay un error se registra otra.
//   AREA = gerente del área solicitante (valida la necesidad)
//   TI   = Gerente de TI (alcance, prioridad y puesta en producción)
//   GG   = Gerencia General (solo si hay costo)
export const aprobaciones = pgTable('aprobaciones', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticketId')
    .notNull()
    .references(() => tickets.id),
  tipo: varchar('tipo', { length: 10 }).notNull(),
  aprobadoPor: varchar('aprobadoPor', { length: 255 }).notNull(), // nombre de quien aprobó
  fechaAprobacion: date('fechaAprobacion', { mode: 'string' }).notNull(),
  comentario: text('comentario').notNull(), // evidencia: "aprobó por correo del 5/11, adjunto"
  registradoPorId: uuid('registradoPorId')
    .notNull()
    .references(() => usuarios.id),
  fechaRegistro: timestamp('fechaRegistro').notNull().defaultNow(),
});

// Parámetros editables desde el panel (horario laboral, plazos). Cada fila
// guarda un JSON; ver lib/config/service.ts para las claves y los valores
// por defecto.
export const configuracion = pgTable('configuracion', {
  clave: varchar('clave', { length: 100 }).primaryKey(),
  valor: text('valor').notNull(),
  fechaActualizacion: timestamp('fechaActualizacion').notNull().defaultNow(),
});

export const feriados = pgTable('feriados', {
  fecha: date('fecha', { mode: 'string' }).primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
});

export const comentarios = pgTable('comentarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticketId')
    .notNull()
    .references(() => tickets.id),
  usuarioId: uuid('usuarioId')
    .notNull()
    .references(() => usuarios.id),
  contenido: text('contenido').notNull(),
  interno: boolean('interno').notNull().default(false),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
});

export const adjuntos = pgTable('adjuntos', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticketId')
    .notNull()
    .references(() => tickets.id),
  nombreArchivo: varchar('nombreArchivo', { length: 255 }).notNull(),
  rutaArchivo: text('rutaArchivo').notNull(),
  tamanio: bigint('tamanio', { mode: 'number' }).notNull(),
  fechaCarga: timestamp('fechaCarga').notNull().defaultNow(),
});

// Conversación directa con el cliente (por WhatsApp), separada de los
// comentarios internos del equipo. Los mensajes del técnico se envían por
// WhatsApp; las respuestas del cliente por WhatsApp caen acá también.
export const mensajesChat = pgTable('mensajesChat', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticketId')
    .notNull()
    .references(() => tickets.id),
  usuarioId: uuid('usuarioId')
    .notNull()
    .references(() => usuarios.id),
  contenido: text('contenido').notNull(),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
});

export const historial = pgTable('historial', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticketId')
    .notNull()
    .references(() => tickets.id),
  usuarioId: uuid('usuarioId').references(() => usuarios.id),
  tipo: varchar('tipo', { length: 50 }).notNull(), // CREACION, ESTADO, ASIGNACION, COMENTARIO, PRIORIDAD
  valorAnterior: text('valorAnterior'),
  valorNuevo: text('valorNuevo'),
  descripcion: text('descripcion').notNull(),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
});

export const empresasRelations = relations(empresas, ({ many }) => ({
  usuarios: many(usuarios),
  tickets: many(tickets),
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [usuarios.empresaId],
    references: [empresas.id],
  }),
  ticketsCreados: many(tickets, { relationName: 'creador' }),
  ticketsAsignados: many(tickets, { relationName: 'tecnico' }),
}));

export const categoriasRelations = relations(categorias, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  usuario: one(usuarios, {
    fields: [tickets.usuarioId],
    references: [usuarios.id],
    relationName: 'creador',
  }),
  tecnicoAsignado: one(usuarios, {
    fields: [tickets.tecnicoAsignadoId],
    references: [usuarios.id],
    relationName: 'tecnico',
  }),
  categoria: one(categorias, {
    fields: [tickets.categoriaId],
    references: [categorias.id],
  }),
  empresa: one(empresas, {
    fields: [tickets.empresaId],
    references: [empresas.id],
  }),
  comentarios: many(comentarios),
  adjuntos: many(adjuntos),
  historiales: many(historial),
  mensajesChat: many(mensajesChat),
  // Ticket del que este es continuación, y los que continúan a este.
  ticketAnterior: one(tickets, {
    fields: [tickets.ticketAnteriorId],
    references: [tickets.id],
    relationName: 'continuacion',
  }),
  continuaciones: many(tickets, { relationName: 'continuacion' }),
  aprobaciones: many(aprobaciones),
}));

export const aprobacionesRelations = relations(aprobaciones, ({ one }) => ({
  ticket: one(tickets, { fields: [aprobaciones.ticketId], references: [tickets.id] }),
  registradoPor: one(usuarios, { fields: [aprobaciones.registradoPorId], references: [usuarios.id] }),
}));

export const mensajesChatRelations = relations(mensajesChat, ({ one }) => ({
  ticket: one(tickets, {
    fields: [mensajesChat.ticketId],
    references: [tickets.id],
  }),
  usuario: one(usuarios, {
    fields: [mensajesChat.usuarioId],
    references: [usuarios.id],
  }),
}));

export const comentariosRelations = relations(comentarios, ({ one }) => ({
  ticket: one(tickets, {
    fields: [comentarios.ticketId],
    references: [tickets.id],
  }),
  usuario: one(usuarios, {
    fields: [comentarios.usuarioId],
    references: [usuarios.id],
  }),
}));

export const adjuntosRelations = relations(adjuntos, ({ one }) => ({
  ticket: one(tickets, {
    fields: [adjuntos.ticketId],
    references: [tickets.id],
  }),
}));

export const historialRelations = relations(historial, ({ one }) => ({
  ticket: one(tickets, {
    fields: [historial.ticketId],
    references: [tickets.id],
  }),
  usuario: one(usuarios, {
    fields: [historial.usuarioId],
    references: [usuarios.id],
  }),
}));
