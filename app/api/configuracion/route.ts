import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guard';
import {
  guardarHorario,
  guardarPlazos,
  listarFeriados,
  obtenerHorario,
  obtenerPlazos,
} from '@/lib/config/service';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const plazoSchema = z.object({
  primeraMin: z.number().int().min(1).max(60 * 24 * 30),
  resolucionMin: z.number().int().min(1).max(60 * 24 * 365),
});

const putSchema = z.object({
  horario: z
    .object({
      dias: z.array(z.number().int().min(0).max(6)).min(1),
      desde: hhmm,
      hasta: hhmm,
    })
    .refine((h) => h.hasta > h.desde, { message: 'La hora de cierre debe ser posterior a la de apertura' })
    .optional(),
  plazos: z.record(z.enum(['1', '2', '3', '4']), plazoSchema).optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const horario = await obtenerHorario();
  const [plazos, feriados] = await Promise.all([obtenerPlazos(horario), listarFeriados()]);
  return NextResponse.json({ horario, plazos, feriados });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }

  if (parsed.data.horario) await guardarHorario(parsed.data.horario);
  if (parsed.data.plazos) {
    const actuales = await obtenerPlazos();
    await guardarPlazos({
      ...actuales,
      ...Object.fromEntries(Object.entries(parsed.data.plazos).map(([k, v]) => [Number(k), v])),
    });
  }
  return NextResponse.json({ ok: true });
}
