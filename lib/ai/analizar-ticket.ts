import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sos un asistente de soporte técnico de ITTicketPy que arma tickets a partir de mensajes de WhatsApp de clientes.

Te llega el mensaje (o la suma de varios mensajes) de un cliente. El pedido puede ser un problema técnico (algo que falla) O una solicitud (automatizar un proceso, un desarrollo, un acceso nuevo, un cambio en un sistema) — no asumas que siempre es una falla, y no le preguntes por síntomas de error a algo que no es un error.

Tu tarea es decidir si hay información suficiente para abrir un ticket útil para el equipo, o si hace falta pedirle un poco más de detalle. No hace falta el detalle perfecto — alcanza con una idea general de qué necesita y en qué sistema/proceso; el equipo coordina el resto directamente con el cliente.

Ejemplos con problemas técnicos:
- "no puedo entrar al SAP" NO alcanza (no dice qué pasa al intentar entrar).
- "no puedo entrar al SAP, me dice que el usuario está bloqueado" SÍ alcanza.
- "la impresora no funciona" NO alcanza.
- "la impresora no imprime, tira hojas en blanco" SÍ alcanza.

Ejemplos con solicitudes (no son errores, no les preguntes por síntomas):
- "quiero automatizar el tarifario de OCHSI" NO alcanza (no dice qué parte del proceso automatizar).
- "quiero automatizar la carga de precios del tarifario de OCHSI, hoy la hacemos a mano en Excel" SÍ alcanza.
- "necesito acceso al sistema de compras" NO alcanza (no dice para qué ni con qué permiso).
- "necesito acceso al sistema de compras para cargar pedidos, como tiene Juan" SÍ alcanza.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional ni bloques de código, en uno de estos dos formatos exactos:

Si falta información:
{"completo": false, "pregunta": "<una pregunta breve, cálida y concreta en español para pedir el detalle que falta, tuteando al cliente>"}

Si hay información suficiente:
{"completo": true, "titulo": "<resumen del pedido en máximo 80 caracteres, en español, sin punto final>", "descripcion": "<descripción clara y completa del pedido en español, redactada en base a todo lo que contó el cliente, en tercera persona o neutra>"}`;

// Prompt para cuando ya le pedimos más detalle una vez: no hay que volver a
// preguntar (evita que el cliente sienta que "da vueltas"), armamos el
// ticket sí o sí con lo que haya, por vago que siga sonando.
const SYSTEM_PROMPT_RESUMEN = `Sos un asistente de soporte técnico de ITTicketPy. Te llega el historial de mensajes de un cliente sobre un pedido (puede ser un problema técnico o una solicitud de automatización/desarrollo/acceso/cambio) — ya se le pidió más detalle una vez, así que ahora hay que armar el ticket sí o sí con la información disponible, sin volver a preguntar nada.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional ni bloques de código, en este formato exacto:
{"titulo": "<resumen del pedido en máximo 80 caracteres, en español, sin punto final>", "descripcion": "<descripción clara del pedido en español, redactada en base a todo lo que contó el cliente>"}`;

export interface AnalisisTicket {
  completo: boolean;
  titulo?: string;
  descripcion?: string;
  pregunta?: string;
}

function limpiarJson(texto: string): string {
  return texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

// Decide si un mensaje (o la suma de varios) alcanza para abrir un ticket
// con título y descripción útiles, o si conviene pedirle más detalle al
// cliente antes de crearlo. Ante cualquier error, preferimos crear el
// ticket tal cual a dejar al cliente esperando una respuesta que no llega.
//
// forzarCompleto: para cuando ya le repreguntamos una vez — no dejamos que
// pida una segunda vuelta de detalle, se arma el ticket con lo que haya.
export async function analizarTicket(texto: string, forzarCompleto = false): Promise<AnalisisTicket> {
  const fallback: AnalisisTicket = { completo: true, titulo: texto.slice(0, 80), descripcion: texto };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: forzarCompleto ? SYSTEM_PROMPT_RESUMEN : SYSTEM_PROMPT,
      messages: [{ role: 'user', content: texto.slice(0, 3000) }],
    });

    const bloque = response.content.find((b) => b.type === 'text');
    const respuesta = bloque?.type === 'text' ? bloque.text.trim() : '';
    const json = JSON.parse(limpiarJson(respuesta));

    if (forzarCompleto) {
      const titulo = typeof json.titulo === 'string' ? json.titulo.trim().slice(0, 80) : '';
      const descripcion = typeof json.descripcion === 'string' ? json.descripcion.trim() : '';
      if (titulo && descripcion) return { completo: true, titulo, descripcion };
      return fallback;
    }

    if (json.completo === false && typeof json.pregunta === 'string' && json.pregunta.trim()) {
      return { completo: false, pregunta: json.pregunta.trim() };
    }
    if (json.completo === true && typeof json.titulo === 'string' && typeof json.descripcion === 'string') {
      const titulo = json.titulo.trim().slice(0, 80);
      const descripcion = json.descripcion.trim();
      if (titulo && descripcion) return { completo: true, titulo, descripcion };
    }
    return fallback;
  } catch (err) {
    console.error('Error analizando ticket de WhatsApp:', err);
    return fallback;
  }
}
