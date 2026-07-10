import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createTicket } from '@/lib/tickets/service';
import { findOrCreateUsuarioByEmail } from '@/lib/usuarios/find-or-create';

const MAX_PER_RUN = 20;

export interface CheckInboundEmailResult {
  processed: number;
  tickets: string[];
  errors: string[];
}

export async function checkInboundEmail(): Promise<CheckInboundEmailResult> {
  const user = process.env.EMAIL_INBOUND_USER;
  const pass = process.env.EMAIL_INBOUND_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('EMAIL_INBOUND_USER / EMAIL_INBOUND_APP_PASSWORD no configurados');
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const result: CheckInboundEmailResult = { processed: 0, tickets: [], errors: [] };

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      const pending = (uids || []).slice(0, MAX_PER_RUN);

      for await (const msg of client.fetch(pending, { source: true }, { uid: true })) {
        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const from = parsed.from?.value[0];
          const email = from?.address?.toLowerCase();

          if (!email || email === user.toLowerCase()) {
            await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
            continue;
          }

          const usuario = await findOrCreateUsuarioByEmail(email, from?.name);
          const ticket = await createTicket(
            {
              titulo: parsed.subject?.trim() || '(sin asunto)',
              descripcion: parsed.text?.trim() || '(sin contenido)',
              prioridad: 2,
            },
            usuario.id,
          );

          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
          result.processed += 1;
          result.tickets.push(ticket.numero);
        } catch (err) {
          result.errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return result;
}
