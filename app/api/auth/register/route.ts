import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { toPublicUsuario } from '@/lib/auth/serialize';
import { optionalUuid } from '@/lib/validation';

const registerSchema = z.object({
  nombre: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  numeroWhatsApp: z.string().optional(),
  rol: z.number().min(0).max(3).optional(),
  empresaId: optionalUuid,
});

// Esto es lo que usa el panel de Admin para dar de alta un usuario a mano —
// NO es el registro público (para eso está /api/auth/registro-publico).
// Solo un admin puede elegir el rol de otra cuenta, así que esto tiene que
// estar atrás de sesión + chequeo de rol; antes no lo estaba, y cualquiera
// (autenticado o no) podía crearse una cuenta Admin mandando rol:2.
export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session.rol !== 2 && session.rol !== 3) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 });
  }

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
      empresaId: dto.empresaId,
      registrado: true,
    })
    .returning();

  return NextResponse.json(toPublicUsuario(usuario), { status: 201 });
}
