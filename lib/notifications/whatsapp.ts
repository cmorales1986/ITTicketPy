import { after } from 'next/server';

async function sendWhatsapp(numero: string, body: string) {
  const url = process.env.WUZAPI_URL;
  const token = process.env.WUZAPI_TOKEN;
  if (!url || !token) return;
  const base = url.replace(/\/$/, '');

  try {
    // Show "escribiendo..." and wait a beat before answering — replying
    // instantly reads as a bot and raises the risk of WhatsApp banning the
    // number, so we imitate a human response cadence.
    await fetch(`${base}/chat/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: token },
      body: JSON.stringify({ Phone: numero, State: 'composing' }),
    });

    const delayMs = 2500 + Math.random() * 2500; // 2.5–5s
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    await fetch(`${base}/chat/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: token },
      body: JSON.stringify({ Phone: numero, Body: body }),
    });
  } catch (err) {
    console.error(`Error enviando WhatsApp a ${numero}:`, err);
  }
}

// Schedules the send for after the HTTP response is already on its way back
// to the caller (dashboard action, webhook ack, etc.) so the artificial delay
// above never makes an admin action or the webhook feel slow.
function sendWhatsappDeferred(numero: string, body: string) {
  after(() => sendWhatsapp(numero, body));
}

// "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora en Paraguay,
// sin importar en qué región corra el servidor.
function saludo(): string {
  const hora = Number(
    new Intl.DateTimeFormat('es-PY', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Asuncion',
    }).format(new Date()),
  );
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export async function notificarTicketCreado(numero: string, ticketNumero: string, nombre: string) {
  sendWhatsappDeferred(
    numero,
    `${saludo()}. Gracias por contactarnos *${nombre}*. Creamos tu ticket ${ticketNumero}. Te contactaremos pronto.`,
  );
}

export async function notificarTicketAsignado(numero: string, ticketNumero: string, tecnicoNombre: string) {
  sendWhatsappDeferred(
    numero,
    `${saludo()}. Tu ticket ${ticketNumero} fue asignado a ${tecnicoNombre} y está en revisión.`,
  );
}

export async function notificarCambioEstado(numero: string, ticketNumero: string, estadoNuevo: string) {
  if (estadoNuevo === 'Cerrado') {
    sendWhatsappDeferred(
      numero,
      `Tu ticket ${ticketNumero} ya fue solucionado y cambió el estado a Cerrado. Muchas gracias por contactarnos, estamos aquí para lo que necesites.`,
    );
    return;
  }
  sendWhatsappDeferred(numero, `${saludo()}. Tu ticket ${ticketNumero} cambió de estado a ${estadoNuevo}.`);
}

export async function notificarNuevoComentario(
  numero: string,
  ticketNumero: string,
  autorNombre: string,
  contenido: string,
) {
  sendWhatsappDeferred(numero, `${saludo()}. ${autorNombre} respondió tu ticket ${ticketNumero}: ${contenido}`);
}
