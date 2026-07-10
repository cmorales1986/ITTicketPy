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

export const usuarios = pgTable('usuarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  numeroWhatsApp: varchar('numeroWhatsApp', { length: 50 }),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  passwordHash: text('passwordHash').notNull(),
  rol: integer('rol').notNull().default(0), // 0=Usuario, 1=Técnico, 2=Admin
  activo: boolean('activo').notNull().default(true),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
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
  tiempoResponseMinutos: integer('tiempoResponseMinutos').notNull().default(480),
  fechaCreacion: timestamp('fechaCreacion').notNull().defaultNow(),
  fechaResolucion: timestamp('fechaResolucion'),
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

export const usuariosRelations = relations(usuarios, ({ many }) => ({
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
  comentarios: many(comentarios),
  adjuntos: many(adjuntos),
  historiales: many(historial),
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
