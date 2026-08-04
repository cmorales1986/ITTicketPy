import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  bigint,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const empresas = pgTable('empresas', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  activa: boolean('activa').notNull().default(true),
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
  // Borrador de un ticket por WhatsApp esperando más detalle del cliente
  // (le preguntamos algo como "¿qué mensaje te da?" y todavía no respondió).
  // Se descarta solo si pasó demasiado tiempo — ver BORRADOR_TTL_MS.
  borradorTicket: text('borradorTicket'),
  borradorFecha: timestamp('borradorFecha'),
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
  estado: integer('estado').notNull().default(1), // 1=Abierto,2=En Progreso,3=Resuelto,4=Cerrado
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
