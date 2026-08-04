import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';

const registroSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email(),
  password: z.string().min(6),
  numeroWhatsApp: z.string().optional(),
});

// Registro público (sin sesión previa) para que un usuario final se cree su
// propia cuenta del portal — siempre con rol 0 (Usuario), nunca configurable
// desde acá. Si ya escribió antes por WhatsApp, ese contacto ya generó una
// cuenta con contraseña inusable (ver lib/usuarios/find-or-create.ts); acá
// la "reclama" en vez de duplicarla, para no perder sus tickets anteriores.
export async function POST(request: NextRequest) {
  const parsed = registroSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }
  const dto = parsed.data;
  const numeroNormalizado = dto.numeroWhatsApp?.replace(/[^0-9]/g, '') || undefined;

  const porWhatsapp = numeroNormalizado
    ? await db.query.usuarios.findFirst({ where: eq(usuarios.numeroWhatsApp, numeroNormalizado) })
    : undefined;

  let usuario;

  if (porWhatsapp) {
    if (porWhatsapp.registrado) {
      return NextResponse.json(
        { message: 'Ese número de WhatsApp ya tiene una cuenta registrada. Iniciá sesión en vez de registrarte.' },
        { status: 409 },
      );
    }
    // Cuenta auto-creada por WhatsApp, todavía sin reclamar: el nuevo email
    // no puede pisar el de otra cuenta ya existente.
    const emailEnUso = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, dto.email),
    });
    if (emailEnUso && emailEnUso.id !== porWhatsapp.id) {
      return NextResponse.json({ message: 'El email ya está registrado' }, { status: 409 });
    }

    const passwordHash = await hashPassword(dto.password);
    [usuario] = await db
      .update(usuarios)
      .set({ nombre: dto.nombre, email: dto.email, passwordHash, registrado: true })
      .where(eq(usuarios.id, porWhatsapp.id))
      .returning();
  } else {
    const existente = await db.query.usuarios.findFirst({ where: eq(usuarios.email, dto.email) });
    if (existente) {
      return NextResponse.json(
        { message: 'El email ya está registrado. Iniciá sesión en vez de registrarte.' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(dto.password);
    [usuario] = await db
      .insert(usuarios)
      .values({
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        numeroWhatsApp: numeroNormalizado,
        rol: 0,
        registrado: true,
      })
      .returning();
  }

  const response = NextResponse.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
  return setSessionCookie(response, { sub: usuario.id, email: usuario.email, rol: usuario.rol });
}
