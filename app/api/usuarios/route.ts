import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession, requireTecnicoOAdmin } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { optionalUuid } from '@/lib/validation';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await db.query.usuarios.findMany({
    columns: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      numeroWhatsApp: true,
      empresaId: true,
    },
    with: { empresa: true },
  });
  return NextResponse.json(result);
}

const contactoSchema = z.object({
  nombre: z.string().trim().min(2),
  empresaId: optionalUuid,
  numeroWhatsApp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

// Alta rápida de un contacto (alguien que reporta por teléfono o correo y
// todavía no tiene cuenta) desde el formulario de nuevo ticket. Queda sin
// contraseña usable: si después se registra en el portal, reclama esta cuenta.
export async function POST(request: NextRequest) {
  const { error } = await requireTecnicoOAdmin();
  if (error) return error;

  const parsed = contactoSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 });
  }
  const dto = parsed.data;

  const numero = dto.numeroWhatsApp?.replace(/\D/g, '') || undefined;
  if (numero) {
    const existente = await db.query.usuarios.findFirst({ where: eq(usuarios.numeroWhatsApp, numero) });
    if (existente) {
      return NextResponse.json({ message: `Ese WhatsApp ya pertenece a ${existente.nombre}` }, { status: 409 });
    }
  }
  const email = dto.email?.trim() || `contacto-${randomUUID()}@placeholder.itticketpy.local`;
  if (dto.email?.trim()) {
    const existente = await db.query.usuarios.findFirst({ where: eq(usuarios.email, email) });
    if (existente) {
      return NextResponse.json({ message: `Ese email ya pertenece a ${existente.nombre}` }, { status: 409 });
    }
  }

  const [usuario] = await db
    .insert(usuarios)
    .values({
      nombre: dto.nombre,
      email,
      numeroWhatsApp: numero,
      empresaId: dto.empresaId,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      rol: 0,
      registrado: false,
    })
    .returning();

  return NextResponse.json(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, activo: usuario.activo },
    { status: 201 },
  );
}
