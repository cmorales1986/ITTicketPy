import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireSession } from '@/lib/auth/guard';
import { agregarAdjunto } from '@/lib/tickets/service';

// Mismo límite que el body de una función serverless de Vercel (~4.5MB) —
// si algún día hace falta más, hay que pasar a subida directa desde el
// cliente con @vercel/blob/client en vez de por esta ruta.
const MAX_BYTES = 4 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'Falta el archivo' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: 'El archivo supera el límite de 4MB' }, { status: 413 });
  }

  if (file.type && !TIPOS_PERMITIDOS.includes(file.type)) {
    return NextResponse.json(
      { message: 'Tipo de archivo no permitido (imágenes, PDF, Excel, Word o CSV)' },
      { status: 400 },
    );
  }

  const blob = await put(`tickets/${id}/${Date.now()}-${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
  });

  const adjunto = await agregarAdjunto(id, session.sub, file.name, blob.url, file.size);
  return NextResponse.json(adjunto, { status: 201 });
}
