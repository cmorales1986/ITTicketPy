import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guard';
import { agregarFeriado, quitarFeriado } from '@/lib/config/service';

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const postSchema = z.object({
  fecha: fechaSchema,
  nombre: z.string().min(1).max(255),
});

// Agrega (o renombra) un feriado, p. ej. uno extraordinario decretado.
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }
  await agregarFeriado(parsed.data.fecha, parsed.data.nombre);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const fecha = fechaSchema.safeParse(request.nextUrl.searchParams.get('fecha'));
  if (!fecha.success) {
    return NextResponse.json({ message: 'Fecha inválida' }, { status: 400 });
  }
  await quitarFeriado(fecha.data);
  return NextResponse.json({ ok: true });
}
