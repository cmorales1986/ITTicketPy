import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { categorias } from '@/lib/db/schema';

const createCategoriaSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
});

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await db.query.categorias.findMany({
    where: eq(categorias.activa, true),
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = createCategoriaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  const [categoria] = await db.insert(categorias).values(parsed.data).returning();
  return NextResponse.json(categoria, { status: 201 });
}
