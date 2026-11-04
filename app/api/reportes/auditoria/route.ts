import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guard';
import { findTicketsRecibidosEnPeriodo } from '@/lib/tickets/service';
import { armarReporteAuditoria } from '@/lib/reportes/auditoria';
import { TIPO_LABELS } from '@/lib/tickets/estados';
import { ESTADO_LABELS } from '@/types';

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// Reportes de auditoría de PR-INF-03 sobre los tickets recibidos en un mes:
// cumplimiento de plazos por prioridad, tickets por tipo, estado y sistema, y
// los Críticos con su análisis de causa. Solo admins.
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const mes = mesSchema.safeParse(request.nextUrl.searchParams.get('mes'));
  if (!mes.success) {
    return NextResponse.json({ message: 'Indicá el mes (AAAA-MM)' }, { status: 400 });
  }

  const [anio, m] = mes.data.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const tickets = await findTicketsRecibidosEnPeriodo(
    `${mes.data}-01`,
    `${mes.data}-${String(ultimoDia).padStart(2, '0')}`,
  );

  return NextResponse.json({
    mes: mes.data,
    ...armarReporteAuditoria(tickets, { tipo: TIPO_LABELS, estado: ESTADO_LABELS }),
  });
}
