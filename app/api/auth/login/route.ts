import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { comparePassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, email),
  });
  if (!usuario) {
    return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
  }

  const valid = await comparePassword(password, usuario.passwordHash);
  if (!valid) {
    return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
  }

  const response = NextResponse.json({
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
  });

  return setSessionCookie(response, {
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  });
}
