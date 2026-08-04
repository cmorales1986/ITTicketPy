import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { empresas } from '@/lib/db/schema';

const updateEmpresaSchema = z.object({
  nombre: z.string().min(1).optional(),
  activa: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const parsed = updateEmpresaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  await db.update(empresas).set(parsed.data).where(eq(empresas.id, id));

  const empresa = await db.query.empresas.findFirst({ where: eq(empresas.id, id) });
  if (!empresa) {
    return NextResponse.json({ message: 'Empresa no encontrada' }, { status: 404 });
  }
  return NextResponse.json(empresa);
}
