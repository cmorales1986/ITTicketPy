import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createTicket, findOpenTicketForUsuario, agregarComentario } from '@/lib/tickets/service';
import { findOrCreateUsuarioByWhatsapp, findUsuarioByWhatsapp } from '@/lib/usuarios/find-or-create';
import { esSolicitudDeSoporte } from '@/lib/ai/clasificar-mensaje';
import { notificarCanalNoEsTicket } from '@/lib/notifications/whatsapp';

export const runtime = 'nodejs';

interface WuzapiMessageInfo {
  Sender: string;
  SenderAlt?: string;
  Chat: string;
  IsFromMe: boolean;
  IsGroup: boolean;
  PushName: string;
}

interface WuzapiMessageContent {
  conversation?: string;
  extendedTextMessage?: { text?: string };
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

  // We only care about incoming text messages; ignore everything else
  // (receipts, presence, our own outgoing messages, group chats).
  const info = payload.type === 'Message' ? payload.event?.Info : undefined;
  if (!info || info.IsFromMe || info.IsGroup) {
    return NextResponse.json({ ok: true });
  }

  const message = payload.event?.Message;
  const text = (message?.conversation || message?.extendedTextMessage?.text || '').trim();
  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const phone = extractPhone(info);
  const usuarioExistente = await findUsuarioByWhatsapp(phone);

  // Si ya tiene un ticket abierto, el mensaje es un comentario de esa
  // conversación en curso — no hace falta clasificarlo.
  if (usuarioExistente) {
    const abierto = await findOpenTicketForUsuario(usuarioExistente.id);
    if (abierto) {
      await agregarComentario(abierto.id, usuarioExistente.id, text);
      return NextResponse.json({ ok: true });
    }
  }

  // Sin conversación abierta: el número también lo usan clientes para
  // saludos u otras consultas, así que clasificamos antes de crear un
  // ticket nuevo (y de crear el usuario, si todavía no existía).
  const esSoporte = await esSolicitudDeSoporte(text);
  if (!esSoporte) {
    await notificarCanalNoEsTicket(phone, info.PushName);
    return NextResponse.json({ ok: true });
  }

  const usuario = usuarioExistente ?? (await findOrCreateUsuarioByWhatsapp(phone, info.PushName));
  await createTicket({ titulo: text.slice(0, 80), descripcion: text, prioridad: 2 }, usuario.id);

  return NextResponse.json({ ok: true });
}
