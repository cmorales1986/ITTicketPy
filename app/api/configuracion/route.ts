import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guard';
import {
  guardarHorario,
  guardarHorarioGranja,
  guardarParametrosCierre,
  guardarPlazos,
  listarFeriados,
  obtenerHorario,
  obtenerHorarioGranja,
  obtenerParametrosCierre,
  obtenerPlazos,
} from '@/lib/config/service';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const horarioSchema = z
  .object({
    dias: z.array(z.number().int().min(0).max(6)).min(1),
    desde: hhmm,
    hasta: hhmm,
  })
  .refine((h) => h.hasta > h.desde, { message: 'La hora de cierre debe ser posterior a la de apertura' });

const cantidadSchema = z.object({
  valor: z.number().min(0.25).max(365),
  unidad: z.enum(['h', 'd']),
});

const plazoSchema = z.object({
  primera: cantidadSchema,
  resolucion: cantidadSchema,
});

const putSchema = z.object({
  horario: horarioSchema.optional(), // oficina
  horarioGranja: horarioSchema.optional(),
  plazos: z.record(z.enum(['1', '2', '3', '4']), plazoSchema).optional(),
  cierre: z
    .object({
      diasCierre: z.number().int().min(1).max(60),
      diasReapertura: z.number().int().min(1).max(60),
    })
    .optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [horario, horarioGranja, plazos, feriados, cierre] = await Promise.all([
    obtenerHorario(),
    obtenerHorarioGranja(),
    obtenerPlazos(),
    listarFeriados(),
    obtenerParametrosCierre(),
  ]);
  return NextResponse.json({ horario, horarioGranja, plazos, feriados, cierre });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }

  if (parsed.data.horario) await guardarHorario(parsed.data.horario);
  if (parsed.data.horarioGranja) await guardarHorarioGranja(parsed.data.horarioGranja);
  if (parsed.data.cierre) await guardarParametrosCierre(parsed.data.cierre);
  if (parsed.data.plazos) {
    const actuales = await obtenerPlazos();
    await guardarPlazos({
      ...actuales,
      ...Object.fromEntries(Object.entries(parsed.data.plazos).map(([k, v]) => [Number(k), v])),
    });
  }
  return NextResponse.json({ ok: true });
}
