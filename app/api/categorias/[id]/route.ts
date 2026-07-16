import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { categorias } from '@/lib/db/schema';

const updateCategoriaSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  activa: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const parsed = updateCategoriaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  await db.update(categorias).set(parsed.data).where(eq(categorias.id, id));

  const categoria = await db.query.categorias.findFirst({ where: eq(categorias.id, id) });
  if (!categoria) {
    return NextResponse.json({ message: 'Categoría no encontrada' }, { status: 404 });
  }
  return NextResponse.json(categoria);
}
