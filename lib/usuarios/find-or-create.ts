import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';

async function unusablePasswordHash() {
  return hashPassword(randomBytes(32).toString('hex'));
}

export async function findOrCreateUsuarioByEmail(email: string, nombre?: string) {
  const existing = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, email),
  });
  if (existing) return existing;

  const [usuario] = await db
    .insert(usuarios)
    .values({
      email,
      nombre: nombre?.trim() || email.split('@')[0],
      passwordHash: await unusablePasswordHash(),
      rol: 0,
    })
    .returning();
  return usuario;
}

export async function findOrCreateUsuarioByWhatsapp(numero: string, nombre?: string) {
  const existing = await db.query.usuarios.findFirst({
    where: eq(usuarios.numeroWhatsApp, numero),
  });
  if (existing) return existing;

  const digits = numero.replace(/[^0-9]/g, '');
  const [usuario] = await db
    .insert(usuarios)
    .values({
      email: `whatsapp-${digits}@placeholder.itticketpy.local`,
      numeroWhatsApp: numero,
      nombre: nombre?.trim() || numero,
      passwordHash: await unusablePasswordHash(),
      rol: 0,
    })
    .returning();
  return usuario;
}
