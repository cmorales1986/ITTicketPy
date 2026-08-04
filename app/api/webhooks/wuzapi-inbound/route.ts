import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { put } from '@vercel/blob';
import {
  createTicket,
  findOpenTicketForUsuario,
  findTicketPendienteEncuesta,
  guardarEncuesta,
  agregarMensajeChat,
  agregarAdjunto,
} from '@/lib/tickets/service';
import {
  findOrCreateUsuarioByWhatsapp,
  findUsuarioByWhatsapp,
  obtenerBorradorVigente,
  guardarBorrador,
  limpiarBorrador,
} from '@/lib/usuarios/find-or-create';
import { esSolicitudDeSoporte } from '@/lib/ai/clasificar-mensaje';
import { generarSugerencia } from '@/lib/ai/sugerir-solucion';
import { analizarTicket } from '@/lib/ai/analizar-ticket';
import { notificarBienvenida, notificarEncuestaRecibida, notificarPreguntaAdicional } from '@/lib/notifications/whatsapp';

export const runtime = 'nodejs';

interface WuzapiMessageInfo {
  Sender: string;
  SenderAlt?: string;
  Chat: string;
  IsFromMe: boolean;
  IsGroup: boolean;
  PushName: string;
}

interface WuzapiMediaMessage {
  URL?: string;
  directPath?: string;
  mediaKey?: string; // base64
  mimetype?: string;
  fileSHA256?: string; // base64
  fileEncSHA256?: string; // base64
  fileLength?: number;
  caption?: string;
  fileName?: string; // solo documentMessage
  title?: string; // solo documentMessage
}

interface WuzapiMessageContent {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: WuzapiMediaMessage;
  documentMessage?: WuzapiMediaMessage;
}

interface WuzapiWebhookPayload {
  type: string;
  event?: {
    Info?: WuzapiMessageInfo;
    Message?: WuzapiMessageContent;
  };
}

function verifyHmac(rawBody: string, signature: string | null, key: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

function phoneFromJid(jid: string): string {
  return jid.split('@')[0].split(':')[0].split('.')[0];
}

// WhatsApp's newer "LID" addressing hides the real number behind an opaque
// id (Sender/Chat end in "@lid"); the actual phone JID is in SenderAlt.
function extractPhone(info: WuzapiMessageInfo): string {
  const primary = info.Sender || info.Chat;
  if (primary.endsWith('@lid') && info.SenderAlt) {
    return phoneFromJid(info.SenderAlt);
  }
  return phoneFromJid(primary);
}

// Interpreta una respuesta corta de la encuesta de satisfacción ("5",
// "4 muy bien", "3, tardaron bastante"). Si el mensaje es largo o no
// arranca con un número del 1 al 5, no lo tomamos como respuesta.
function parseCalificacion(texto: string): number | null {
  if (texto.length > 40) return null;
  const match = texto.match(/^([1-5])\b/);
  return match ? Number(match[1]) : null;
}

// Le pide a wuzapi que descargue (y decodifique) la imagen/documento de un
// mensaje entrante — el webhook solo trae la referencia cifrada, no el
// archivo en sí.
async function descargarMediaWuzapi(
  media: WuzapiMediaMessage,
  tipo: 'image' | 'document',
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  const url = process.env.WUZAPI_URL;
  const token = process.env.WUZAPI_TOKEN;
  if (!url || !token) return null;
  const base = url.replace(/\/$/, '');
  const endpoint = tipo === 'image' ? '/chat/downloadimage' : '/chat/downloaddocument';

  try {
    const res = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: token },
      body: JSON.stringify({
        Url: media.URL,
        DirectPath: media.directPath,
        MediaKey: media.mediaKey,
        Mimetype: media.mimetype,
        FileSHA256: media.fileSHA256,
        FileEncSHA256: media.fileEncSHA256,
        FileLength: media.fileLength,
      }),
    });
    const json = await res.json();
    const dataUrl: string | undefined = json?.data?.Data;
    if (!dataUrl || !dataUrl.includes(',')) return null;

    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return {
      buffer: Buffer.from(base64, 'base64'),
      mimetype: json?.data?.Mimetype || media.mimetype || 'application/octet-stream',
    };
  } catch (err) {
    console.error('Error descargando media de wuzapi:', err);
    return null;
  }
}

// Descarga la imagen/documento adjunto al mensaje (si hay) y lo sube como
// adjunto del ticket correspondiente.
async function adjuntarMediaWuzapi(
  ticketId: string,
  usuarioId: string,
  message: WuzapiMessageContent,
): Promise<void> {
  const esImagen = !!message.imageMessage;
  const media = message.imageMessage || message.documentMessage;
  if (!media) return;

  const descarga = await descargarMediaWuzapi(media, esImagen ? 'image' : 'document');
  if (!descarga) return;

  const extension = (descarga.mimetype.split('/')[1] || 'bin').split(';')[0];
  const nombreArchivo =
    message.documentMessage?.fileName ||
    message.documentMessage?.title ||
    `imagen-${Date.now()}.${extension}`;

  const blob = await put(`tickets/${ticketId}/${Date.now()}-${nombreArchivo}`, descarga.buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: descarga.mimetype,
  });

  await agregarAdjunto(ticketId, usuarioId, nombreArchivo, blob.url, descarga.buffer.length);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const hmacKey = process.env.WUZAPI_HMAC_KEY;
  if (hmacKey) {
    const signature = request.headers.get('x-hmac-signature');
    const expected = crypto.createHmac('sha256', hmacKey).update(rawBody).digest('hex');
    if (!verifyHmac(rawBody, signature, hmacKey)) {
      console.warn('[wuzapi-hmac-mismatch]', {
        receivedSig: signature,
        expectedSig: expected,
        bodyLen: rawBody.length,
      });
    }
  }

  let payload: WuzapiWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  // We only care about incoming text/media messages; ignore everything else
  // (receipts, presence, our own outgoing messages, group chats).
  const info = payload.type === 'Message' ? payload.event?.Info : undefined;
  if (!info || info.IsFromMe || info.IsGroup) {
    return NextResponse.json({ ok: true });
  }

  const message = payload.event?.Message;
  const text = (message?.conversation || message?.extendedTextMessage?.text || '').trim();
  const mediaMessage = message?.imageMessage || message?.documentMessage;
  // Texto del mensaje, o el pie de foto/documento si no hay texto suelto.
  const textoEfectivo = text || mediaMessage?.caption?.trim() || '';

  if (!textoEfectivo && !mediaMessage) {
    return NextResponse.json({ ok: true });
  }

  const phone = extractPhone(info);
  const usuarioExistente = await findUsuarioByWhatsapp(phone);

  // Primer contacto de este número: lo registramos y respondemos con la
  // bienvenida, sin crear ticket todavía — recién su próximo mensaje se
  // clasifica y (si corresponde) genera el ticket. Si mandó una imagen sin
  // ticket todavía, no hay dónde adjuntarla — se pierde en este primer paso.
  if (!usuarioExistente) {
    await findOrCreateUsuarioByWhatsapp(phone, info.PushName);
    await notificarBienvenida(phone, info.PushName);
    return NextResponse.json({ ok: true });
  }

  // Si ya tiene un ticket abierto, el mensaje es parte del chat de esa
  // conversación en curso — no hace falta clasificarlo. Los adjuntos van
  // directo al ticket.
  const abierto = await findOpenTicketForUsuario(usuarioExistente.id);
  if (abierto) {
    if (textoEfectivo) {
      await agregarMensajeChat(abierto.id, usuarioExistente.id, textoEfectivo);
    }
    if (mediaMessage && message) {
      await adjuntarMediaWuzapi(abierto.id, usuarioExistente.id, message);
    }
    return NextResponse.json({ ok: true });
  }

  // Sin ticket abierto: si su último ticket se cerró y todavía no respondió
  // la encuesta, y este mensaje parece esa respuesta (corto, arranca con
  // 1-5), la guardamos en vez de clasificar el mensaje como algo nuevo.
  const pendienteEncuesta = await findTicketPendienteEncuesta(usuarioExistente.id);
  if (pendienteEncuesta) {
    const calificacion = parseCalificacion(text);
    if (calificacion !== null) {
      await guardarEncuesta(pendienteEncuesta.id, calificacion, text);
      await notificarEncuestaRecibida(phone);
      return NextResponse.json({ ok: true });
    }
  }

  // Una imagen/documento sin ningún texto y sin ticket abierto no se puede
  // clasificar — no hacemos nada con ese mensaje.
  if (!textoEfectivo) {
    return NextResponse.json({ ok: true });
  }

  // Si le habíamos pedido más detalle sobre un problema, este mensaje es
  // la respuesta a esa pregunta — lo sumamos al borrador en vez de
  // clasificarlo de nuevo (clasificar de nuevo podría descartarlo si la
  // respuesta, sola, no suena a pedido de soporte, ej: "sí" o "error 500").
  const borradorPrevio = obtenerBorradorVigente(usuarioExistente);
  const textoAcumulado = borradorPrevio ? `${borradorPrevio}\n${textoEfectivo}` : textoEfectivo;

  if (!borradorPrevio) {
    // Mensaje nuevo: clasificamos antes de avanzar, porque también puede
    // estar saludando u otra consulta ajena a soporte.
    const esSoporte = await esSolicitudDeSoporte(textoEfectivo);
    if (!esSoporte) {
      return NextResponse.json({ ok: true });
    }
  }

  // Con el pedido ya confirmado como soporte, vemos si hay detalle
  // suficiente para armar un ticket útil o si conviene repreguntar.
  const analisis = await analizarTicket(textoAcumulado);

  if (!analisis.completo) {
    await guardarBorrador(usuarioExistente.id, textoAcumulado);
    await notificarPreguntaAdicional(phone, analisis.pregunta!);
    return NextResponse.json({ ok: true });
  }

  await limpiarBorrador(usuarioExistente.id);

  const sugerencia = await generarSugerencia(textoAcumulado);
  const nuevoTicket = await createTicket(
    { titulo: analisis.titulo!, descripcion: analisis.descripcion!, prioridad: 2 },
    usuarioExistente.id,
    sugerencia,
  );

  if (mediaMessage && message) {
    await adjuntarMediaWuzapi(nuevoTicket.id, usuarioExistente.id, message);
  }

  return NextResponse.json({ ok: true });
}
