import { NextResponse } from 'next/server';
import { and, count, gte, isNotNull, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { tickets } from '@/lib/db/schema';

// Tickets por sistema o servicio afectado en los últimos 30 días. Tres o más
// del mismo sistema se consideran posible reincidencia (PR-INF-03). Es solo un
// conteo: la decisión de marcar un ticket como reincidente es manual.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const filas = await db
    .select({
      sistema: tickets.sistemaModulo,
      total: count(),
      numeros: sql<string[]>`array_agg(${tickets.numero} order by ${tickets.fechaCreacion})`,
    })
    .from(tickets)
    .where(and(isNotNull(tickets.sistemaModulo), gte(tickets.fechaCreacion, desde)))
    .groupBy(tickets.sistemaModulo)
    .orderBy(sql`count(*) desc`);

  return NextResponse.json({
    desde: desde.toISOString(),
    umbral: 3,
    sistemas: filas.map((f) => ({ sistema: f.sistema, total: Number(f.total), tickets: f.numeros })),
  });
}
