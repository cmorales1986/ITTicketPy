import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { empresas } from '@/lib/db/schema';

const createEmpresaSchema = z.object({
  nombre: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const incluirInactivas = request.nextUrl.searchParams.get('all') === '1';

  const result = await db.query.empresas.findMany({
    where: incluirInactivas ? undefined : eq(empresas.activa, true),
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const parsed = createEmpresaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }

  const [empresa] = await db.insert(empresas).values(parsed.data).returning();
  return NextResponse.json(empresa, { status: 201 });
}
