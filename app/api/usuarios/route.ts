import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { db } from '@/lib/db';

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
    },
  });
  return NextResponse.json(result);
}
