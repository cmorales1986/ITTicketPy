import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createTicket } from '@/lib/tickets/service';
import { findOrCreateUsuarioByWhatsapp } from '@/lib/usuarios/find-or-create';

export const runtime = 'nodejs';

interface WuzapiMessageInfo {
  Sender: string;
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

// JIDs look like "5491155554444:12@s.whatsapp.net" or "5491155554444@s.whatsapp.net"
function phoneFromJid(jid: string): string {
  return jid.split('@')[0].split(':')[0].split('.')[0];
}

async function sendWuzapiReply(phone: string, body: string) {
  const url = process.env.WUZAPI_URL;
  const token = process.env.WUZAPI_TOKEN;
  if (!url || !token) return;
  await fetch(`${url.replace(/\/$/, '')}/chat/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Token: token },
    body: JSON.stringify({ Phone: phone, Body: body }),
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const hmacKey = process.env.WUZAPI_HMAC_KEY;
  if (hmacKey) {
    const signature = request.headers.get('x-hmac-signature');
    if (!verifyHmac(rawBody, signature, hmacKey)) {
      return NextResponse.json({ message: 'Firma inválida' }, { status: 403 });
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

  const phone = phoneFromJid(info.Sender || info.Chat);
  const usuario = await findOrCreateUsuarioByWhatsapp(phone, info.PushName);
  const ticket = await createTicket(
    { titulo: text.slice(0, 80), descripcion: text, prioridad: 2 },
    usuario.id,
  );

  await sendWuzapiReply(phone, `Gracias, creamos tu ticket ${ticket.numero}. Te contactaremos pronto.`);

  return NextResponse.json({ ok: true });
}
