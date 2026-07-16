import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { toPublicUsuario } from '@/lib/auth/serialize';

const registerSchema = z.object({
  nombre: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  numeroWhatsApp: z.string().optional(),
  rol: z.number().min(0).max(3).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = registerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }
  const dto = parsed.data;

  const existe = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, dto.email),
  });
  if (existe) {
    return NextResponse.json({ message: 'El email ya está registrado' }, { status: 409 });
  }

  const passwordHash = await hashPassword(dto.password);

  const [usuario] = await db
    .insert(usuarios)
    .values({
      nombre: dto.nombre,
      email: dto.email,
      passwordHash,
      numeroWhatsApp: dto.numeroWhatsApp,
      rol: dto.rol,
    })
    .returning();

  return NextResponse.json(toPublicUsuario(usuario), { status: 201 });
}
