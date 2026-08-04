import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sos un asistente de soporte técnico de ITTicketPy que arma tickets a partir de mensajes de WhatsApp de clientes.

Te llega el mensaje (o la suma de varios mensajes) de un cliente reportando un problema técnico. Tu tarea es decidir si hay información suficiente para abrir un ticket útil para un técnico, o si hace falta pedirle un poco más de detalle.

Se considera información suficiente cuando el mensaje deja claro QUÉ le pasa exactamente — no alcanza con mencionar solo el sistema o equipo afectado. Por ejemplo:
- "no puedo entrar al SAP" NO alcanza (no dice qué pasa al intentar entrar).
- "no puedo entrar al SAP, me dice que el usuario está bloqueado" SÍ alcanza.
- "la impresora no funciona" NO alcanza.
- "la impresora no imprime, tira hojas en blanco" SÍ alcanza.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional ni bloques de código, en uno de estos dos formatos exactos:

Si falta información:
{"completo": false, "pregunta": "<una pregunta breve, cálida y concreta en español para pedir el detalle que falta, tuteando al cliente>"}

Si hay información suficiente:
{"completo": true, "titulo": "<resumen del problema en máximo 80 caracteres, en español, sin punto final>", "descripcion": "<descripción clara y completa del problema en español, redactada en base a todo lo que contó el cliente, en tercera persona o neutra>"}`;

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
export async function analizarTicket(texto: string): Promise<AnalisisTicket> {
  const fallback: AnalisisTicket = { completo: true, titulo: texto.slice(0, 80), descripcion: texto };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: texto.slice(0, 3000) }],
    });

    const bloque = response.content.find((b) => b.type === 'text');
    const respuesta = bloque?.type === 'text' ? bloque.text.trim() : '';
    const json = JSON.parse(limpiarJson(respuesta));

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
