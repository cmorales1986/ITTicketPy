import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { empresas, usuarios } from '@/lib/db/schema';

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

// No repetimos el saludo si le acabamos de escribir hace poco — en un ida y
// vuelta seguido (ej. le preguntamos algo y contesta al toque) sonaría
// robótico abrir cada mensaje con "Buenas tardes".
const SALUDO_INTERVALO_MS = 10 * 60 * 1000;

async function conSaludoSiCorresponde(numero: string, cuerpo: string): Promise<string> {
  try {
    const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.numeroWhatsApp, numero) });
    const reciente =
      usuario?.ultimoMensajeWhatsApp &&
      Date.now() - new Date(usuario.ultimoMensajeWhatsApp).getTime() < SALUDO_INTERVALO_MS;

    if (usuario) {
      await db.update(usuarios).set({ ultimoMensajeWhatsApp: new Date() }).where(eq(usuarios.id, usuario.id));
    }

    return reciente ? cuerpo : `${saludo()}. ${cuerpo}`;
  } catch (err) {
    console.error('Error chequeando el último contacto por WhatsApp:', err);
    // Fail open: preferimos saludar de más a que el mensaje salga raro.
    return `${saludo()}. ${cuerpo}`;
  }
}

function sendWhatsappConSaludoDeferred(numero: string, cuerpo: string) {
  after(async () => {
    const body = await conSaludoSiCorresponde(numero, cuerpo);
    await sendWhatsapp(numero, body);
  });
}

export async function notificarBienvenida(numero: string, nombre?: string) {
  const cuerpo = `Bienvenido/a al sistema de soporte técnico${nombre ? ` *${nombre}*` : ''}. Contanos brevemente cuál es el problema o qué necesitás, y te creamos un ticket enseguida.`;
  sendWhatsappConSaludoDeferred(numero, cuerpo);
}

// Respuesta a un saludo suelto ("hola"): invita a contar el problema sin crear
// un ticket vacío.
export async function notificarRespuestaSaludo(numero: string, nombre?: string) {
  const cuerpo = `¿Cómo estás${nombre ? ` *${nombre}*` : ''}? Soy el asistente de soporte técnico. ¿Tenés algún problema o necesitás algo? Contanos brevemente (qué sistema es y qué te pasa) y te creamos un ticket enseguida.`;
  sendWhatsappConSaludoDeferred(numero, cuerpo);
}

export async function notificarTicketCreado(
  numero: string,
  ticketNumero: string,
  nombre: string,
  link: string,
  sugerencia?: string | null,
) {
  let cuerpo = `Gracias por contactarnos *${nombre}*. Creamos tu ticket ${ticketNumero}. Te contactaremos pronto.`;
  if (sugerencia) {
    cuerpo += `\n\nMientras tanto, esto te puede ayudar: ${sugerencia}\n\n(De todas formas, un técnico va a revisar tu caso)`;
  }
  cuerpo += `\n\nPodés seguir el estado de tu ticket acá: ${link}`;
  sendWhatsappConSaludoDeferred(numero, cuerpo);
}

export async function notificarTicketAsignado(numero: string, ticketNumero: string, tecnicoNombre: string) {
  sendWhatsappConSaludoDeferred(numero, `Tu ticket ${ticketNumero} fue asignado a ${tecnicoNombre} y está en revisión.`);
}

// Único aviso de cambio de estado que mandamos por WhatsApp — "En Progreso" /
// "Resuelto" ya no notifican, para no saturar al cliente. Incluye la
// pregunta de la encuesta en el mismo mensaje (evita mandar dos seguidos).
export async function notificarTicketCerrado(numero: string, ticketNumero: string) {
  sendWhatsappDeferred(
    numero,
    `Tu ticket ${ticketNumero} ya fue solucionado y cambió el estado a Cerrado. Muchas gracias por contactarnos, estamos aquí para lo que necesites.\n\n¿Cómo calificarías la atención que recibiste? Respondé con un número del 1 (mala) al 5 (excelente) — nos ayuda mucho a mejorar.`,
  );
}

// Al pasar a Resuelto el bot le informa la solución al usuario, por el mismo
// canal por el que reportó, y le pide conformidad (PR-INF-03). Su respuesta
// (1 o 2) la interpreta el webhook.
export async function notificarTicketResuelto(numero: string, ticketNumero: string, solucion: string) {
  const cuerpo = `Tu ticket ${ticketNumero} fue resuelto.\n\nSolución aplicada: ${solucion}\n\n¿Estás conforme con la solución?\n\n1️⃣ Sí, quedó resuelto\n2️⃣ No, sigue el problema (contanos qué pasa)`;
  sendWhatsappConSaludoDeferred(numero, cuerpo);
}

// El usuario objetó la solución: el ticket vuelve a En Proceso.
export async function notificarObjecionRecibida(numero: string, ticketNumero: string) {
  sendWhatsappDeferred(
    numero,
    `Gracias por avisarnos. Reabrimos tu ticket ${ticketNumero} y el equipo lo vuelve a revisar con lo que nos contaste.`,
  );
}

// El usuario dio su conformidad pero el ticket no se pudo cerrar solo (por
// ejemplo, falta completar algo en el equipo): se le agradece igual.
export async function notificarConformidadRegistrada(numero: string, ticketNumero: string) {
  sendWhatsappDeferred(
    numero,
    `¡Gracias! Registramos tu conformidad con el ticket ${ticketNumero}. El equipo lo da por cerrado en breve.`,
  );
}

export async function notificarEncuestaRecibida(numero: string) {
  sendWhatsappDeferred(numero, '¡Gracias por tu respuesta! La tenemos en cuenta para seguir mejorando. 🙌');
}

// El problema reportado no traía suficiente detalle para armar un ticket
// útil — le repreguntamos al cliente antes de crearlo.
export async function notificarPreguntaAdicional(numero: string, pregunta: string) {
  sendWhatsappConSaludoDeferred(numero, pregunta);
}

// El cliente ya tiene un ticket abierto y este mensaje no suena a que sea
// sobre lo mismo — le preguntamos si seguir sumándolo a ese ticket o si es
// un problema nuevo, antes de decidir por nuestra cuenta.
export async function notificarConfirmarContexto(numero: string, ticketNumero: string, ticketTitulo: string) {
  const cuerpo = `Todavía tenés abierto el ticket ${ticketNumero} (${ticketTitulo}). ¿Este mensaje es parte de ese mismo problema o es algo nuevo?\n\n1️⃣ Es lo mismo\n2️⃣ Es un problema nuevo`;
  sendWhatsappConSaludoDeferred(numero, cuerpo);
}

export async function notificarNuevoMensajeChat(
  numero: string,
  ticketNumero: string,
  autorNombre: string,
  contenido: string,
) {
  sendWhatsappConSaludoDeferred(numero, `${autorNombre} respondió tu ticket ${ticketNumero}: ${contenido}`);
}

const PRIORIDAD_AVISO: Record<number, string> = { 1: 'Baja', 2: 'Media', 3: 'Alta', 4: 'Crítica' };

// Número que recibe el aviso de ticket nuevo. Se puede cambiar (o agregar más,
// separados por coma) con AVISO_TICKET_NUEVO_NUMEROS en Vercel.
const AVISO_NUMEROS_POR_DEFECTO = '595981392354';

function numerosDeAviso(): string[] {
  return (process.env.AVISO_TICKET_NUEVO_NUMEROS || AVISO_NUMEROS_POR_DEFECTO)
    .split(',')
    .map((n) => n.replace(/\D/g, ''))
    .filter(Boolean);
}

// Avisa por WhatsApp que entró un ticket nuevo, solo a los números definidos
// arriba. `excluirNumero` evita avisarle a quien lo cargó a mano desde el
// portal, que ya lo sabe.
export async function notificarEquipoTicketNuevo(
  ticket: { id: string; numero: string; titulo: string; prioridad: number; empresaId: string | null },
  solicitanteNombre: string,
  excluirUsuarioId?: string,
) {
  try {
    let destinatarios = numerosDeAviso();
    if (excluirUsuarioId) {
      const actor = await db.query.usuarios.findFirst({ where: eq(usuarios.id, excluirUsuarioId) });
      const numeroActor = actor?.numeroWhatsApp?.replace(/\D/g, '');
      destinatarios = destinatarios.filter((n) => n !== numeroActor);
    }
    if (destinatarios.length === 0) return;

    const empresa = ticket.empresaId
      ? await db.query.empresas.findFirst({ where: eq(empresas.id, ticket.empresaId) })
      : null;
    const quien = empresa ? `${solicitanteNombre} (${empresa.nombre})` : solicitanteNombre;
    const cuerpo =
      `🆕 Nuevo ticket ${ticket.numero} de ${quien}\n` +
      `${ticket.titulo}\n` +
      `Prioridad: ${PRIORIDAD_AVISO[ticket.prioridad] ?? 'Media'}\n\n` +
      `${process.env.APP_URL}/tickets/${ticket.id}`;

    for (const numero of destinatarios) sendWhatsappDeferred(numero, cuerpo);
  } catch (err) {
    console.error('Error avisando del ticket nuevo:', err);
  }
}
