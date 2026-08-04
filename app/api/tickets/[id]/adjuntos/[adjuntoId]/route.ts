import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { requireSession } from '@/lib/auth/guard';
import { eliminarAdjunto } from '@/lib/tickets/service';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; adjuntoId: string }> },
) {
  const { error } = await requireSession();
  if (error) return error;

  const { adjuntoId } = await params;
  const adjunto = await eliminarAdjunto(adjuntoId);
  if (!adjunto) {
    return NextResponse.json({ message: 'Adjunto no encontrado' }, { status: 404 });
  }

  await del(adjunto.rutaArchivo).catch(() => {
    // El registro ya se borró de la base; si el blob no existe más (o ya
    // se había borrado) no bloqueamos la respuesta por eso.
  });

  return NextResponse.json({ ok: true });
}
