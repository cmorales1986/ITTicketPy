import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guard';
import { findTicketsDelPeriodo } from '@/lib/tickets/service';
import { construirExcel, nombreArchivoExportacion } from '@/lib/reportes/excel';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rango = z.object({ desde: fecha, hasta: fecha });

// Listado de tickets del período en Excel (PR-INF-03). Solo admins.
export async function GET(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = rango.safeParse({
    desde: request.nextUrl.searchParams.get('desde'),
    hasta: request.nextUrl.searchParams.get('hasta'),
  });
  if (!parsed.success || parsed.data.desde > parsed.data.hasta) {
    return NextResponse.json({ message: 'Indicá un rango de fechas válido (desde y hasta)' }, { status: 400 });
  }
  const { desde, hasta } = parsed.data;

  const [tickets, usuario] = await Promise.all([
    findTicketsDelPeriodo(desde, hasta),
    db.query.usuarios.findFirst({ where: eq(usuarios.id, session.sub) }),
  ]);

  const buffer = await construirExcel({
    desde,
    hasta,
    tickets,
    generadoPor: usuario?.nombre ?? session.email,
    generadoEn: new Date(),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivoExportacion(desde, hasta)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
