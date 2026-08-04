import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { put } from '@vercel/blob';
import {
  createTicket,
  findOpenTicketForUsuario,
  findTicketPendienteEncuesta,
  findTicketById,
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
  obtenerConfirmacionVigente,
  guardarConfirmacionPendiente,
  limpiarConfirmacionPendiente,
} from '@/lib/usuarios/find-or-create';
import { esSolicitudDeSoporte } from '@/lib/ai/clasificar-mensaje';
import { generarSugerencia } from '@/lib/ai/sugerir-solucion';
import { analizarTicket } from '@/lib/ai/analizar-ticket';
import { esMismoProblema } from '@/lib/ai/es-mismo-problema';
import {
  notificarBienvenida,
  notificarEncuestaRecibida,
  notificarPreguntaAdicional,
  notificarConfirmarContexto,
} from '@/lib/notifications/whatsapp';

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

// Interpreta la respuesta a "¿es lo mismo o es un problema nuevo?" — acepta
// el número (1/2) o algunas palabras clave típicas, para no obligar al
// cliente a responder con el formato exacto.
function interpretarConfirmacion(texto: string): 'mismo' | 'nuevo' | null {
  const t = texto.trim().toLowerCase();
  if (/^1\b/.test(t) || /\b(mismo|misma|sigue|contin[uú]a)\b/.test(t)) return 'mismo';
  if (/^2\b/.test(t) || /\b(nuevo|nueva|otro|otra|distinto|diferente)\b/.test(t)) return 'nuevo';
  return null;
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

// Punto único donde se decide si un texto (mensaje nuevo, o la suma de un
// borrador + la respuesta a la repregunta) alcanza para crear el ticket, o
// si todavía falta detalle y hay que volver a preguntar. Se usa tanto para
// mensajes frescos como para las dos ramas que retoman una conversación
// pendiente (confirmación de contexto y borrador esperando más info).
async function intentarCrearTicket(
  usuarioId: string,
  phone: string,
  texto: string,
  mediaMessage: WuzapiMediaMessage | undefined,
  message: WuzapiMessageContent | undefined,
): Promise<void> {
  const analisis = await analizarTicket(texto);

  if (!analisis.completo) {
    await guardarBorrador(usuarioId, texto);
    await notificarPreguntaAdicional(phone, analisis.pregunta!);
    return;
  }

  await limpiarBorrador(usuarioId);
  const sugerencia = await generarSugerencia(texto);
  const nuevoTicket = await createTicket(
    { titulo: analisis.titulo!, descripcion: analisis.descripcion!, prioridad: 2 },
    usuarioId,
    sugerencia,
  );
  if (mediaMessage && message) {
    await adjuntarMediaWuzapi(nuevoTicket.id, usuarioId, message);
  }
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

  // Le habíamos preguntado si un mensaje anterior era parte de su ticket
  // abierto o un problema nuevo — este mensaje es la respuesta a esa
  // pregunta, la interpretamos antes que cualquier otra cosa.
  const confirmacionPendiente = obtenerConfirmacionVigente(usuarioExistente);
  if (confirmacionPendiente && textoEfectivo) {
    const decision = interpretarConfirmacion(textoEfectivo);

    if (decision === 'mismo') {
      await limpiarConfirmacionPendiente(usuarioExistente.id);
      await agregarMensajeChat(confirmacionPendiente.ticketId, usuarioExistente.id, confirmacionPendiente.texto);
      if (mediaMessage && message) {
        await adjuntarMediaWuzapi(confirmacionPendiente.ticketId, usuarioExistente.id, message);
      }
      return NextResponse.json({ ok: true });
    }

    if (decision === 'nuevo') {
      await limpiarConfirmacionPendiente(usuarioExistente.id);
      await intentarCrearTicket(usuarioExistente.id, phone, confirmacionPendiente.texto, mediaMessage, message);
      return NextResponse.json({ ok: true });
    }

    // No reconocimos 1/2 ni una palabra clave clara: repetimos la pregunta
    // en vez de adivinar (mejor una repregunta que mezclar temas por error).
    const ticketPendiente = await findTicketById(confirmacionPendiente.ticketId);
    if (ticketPendiente) {
      await notificarConfirmarContexto(phone, ticketPendiente.numero, ticketPendiente.titulo);
    }
    return NextResponse.json({ ok: true });
  }

  // Le habíamos pedido más detalle sobre un problema y estamos esperando
  // esa respuesta — la chequeamos ANTES de mirar si hay un ticket abierto:
  // este flujo puede dispararse mientras el ticket viejo sigue abierto (ej.
  // el cliente dijo que era "un problema nuevo"), y si mirásemos el ticket
  // abierto primero, esta respuesta se perdería ahí adentro sin completar
  // nunca el ticket nuevo.
  const borradorPrevio = obtenerBorradorVigente(usuarioExistente);
  if (borradorPrevio && textoEfectivo) {
    await intentarCrearTicket(usuarioExistente.id, phone, `${borradorPrevio}\n${textoEfectivo}`, mediaMessage, message);
    return NextResponse.json({ ok: true });
  }

  // Si ya tiene un ticket abierto, chequeamos que el mensaje siga siendo
  // sobre ese problema antes de sumarlo al chat — un cliente con "mil
  // problemas" el mismo día puede mandar algo totalmente distinto sin
  // avisar, y eso merece su propio ticket en vez de mezclarse con el otro.
  const abierto = await findOpenTicketForUsuario(usuarioExistente.id);
  if (abierto) {
    if (textoEfectivo) {
      const relacionado = await esMismoProblema(abierto.titulo, abierto.descripcion, textoEfectivo);
      if (!relacionado) {
        await guardarConfirmacionPendiente(usuarioExistente.id, abierto.id, textoEfectivo);
        await notificarConfirmarContexto(phone, abierto.numero, abierto.titulo);
        // La foto/documento de este mensaje (si la hay) queda sin adjuntar
        // hasta que se confirme a qué ticket termina perteneciendo.
        return NextResponse.json({ ok: true });
      }
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

  // Mensaje fresco (no es continuación de nada pendiente): clasificamos
  // antes de avanzar, porque también puede estar saludando u otra consulta
  // ajena a soporte.
  const esSoporte = await esSolicitudDeSoporte(textoEfectivo);
  if (!esSoporte) {
    return NextResponse.json({ ok: true });
  }

  await intentarCrearTicket(usuarioExistente.id, phone, textoEfectivo, mediaMessage, message);
  return NextResponse.json({ ok: true });
}
