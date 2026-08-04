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

export async function findUsuarioByWhatsapp(numero: string) {
  return db.query.usuarios.findFirst({
    where: eq(usuarios.numeroWhatsApp, numero),
  });
}

export async function findOrCreateUsuarioByWhatsapp(numero: string, nombre?: string) {
  const existing = await findUsuarioByWhatsapp(numero);
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

// Cuánto tiempo dejamos un borrador de ticket "abierto" esperando la
// respuesta del cliente a nuestra pregunta de más detalle. Pasado esto, el
// próximo mensaje se trata como un pedido nuevo en vez de sumarse al viejo.
const BORRADOR_TTL_MS = 30 * 60 * 1000;

// Si le preguntamos al cliente por más detalle y todavía está dentro de la
// ventana de espera, devuelve el texto acumulado hasta ahora; si no, null
// (borrador vencido o inexistente).
export function obtenerBorradorVigente(usuario: {
  borradorTicket: string | null;
  borradorFecha: Date | null;
}): string | null {
  if (!usuario.borradorTicket || !usuario.borradorFecha) return null;
  if (Date.now() - new Date(usuario.borradorFecha).getTime() > BORRADOR_TTL_MS) return null;
  return usuario.borradorTicket;
}

export async function guardarBorrador(usuarioId: string, texto: string) {
  await db
    .update(usuarios)
    .set({ borradorTicket: texto.slice(0, 4000), borradorFecha: new Date() })
    .where(eq(usuarios.id, usuarioId));
}

export async function limpiarBorrador(usuarioId: string) {
  await db
    .update(usuarios)
    .set({ borradorTicket: null, borradorFecha: null })
    .where(eq(usuarios.id, usuarioId));
}
