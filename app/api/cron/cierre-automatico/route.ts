import { NextRequest, NextResponse } from 'next/server';
import { cerrarResueltosSinRespuesta } from '@/lib/tickets/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Tarea diaria de PR-INF-03: cierra los tickets Resueltos cuyo usuario no
// respondió en N días hábiles, dejando constancia en el historial.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }
  }

  try {
    return NextResponse.json(await cerrarResueltosSinRespuesta());
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 },
    );
  }
}
