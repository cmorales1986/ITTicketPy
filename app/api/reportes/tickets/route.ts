import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { findTicketsParaReporte } from '@/lib/tickets/service';

// Reporte simple de auditoría — solo admins (rol 2) o admin+técnico (rol 3),
// igual que las páginas de Usuarios/Empresas.
export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session.rol !== 2 && session.rol !== 3) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const empresaId = params.get('empresaId') || undefined;
  const estado = params.get('estado') ? Number(params.get('estado')) : undefined;
  const categoriaId = params.get('categoriaId') || undefined;

  const tickets = await findTicketsParaReporte({
    desde: desde ? new Date(`${desde}T00:00:00`) : undefined,
    // Fin del día para que "hasta" incluya todo ese día, no solo su 00:00.
    hasta: hasta ? new Date(`${hasta}T23:59:59.999`) : undefined,
    empresaId,
    estado,
    categoriaId,
  });

  return NextResponse.json(tickets);
}
