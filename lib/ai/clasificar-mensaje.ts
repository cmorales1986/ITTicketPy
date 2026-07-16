import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Analizás mensajes de WhatsApp recibidos en el canal de soporte técnico de la empresa ITTicketPy. Tu única tarea es decidir si el mensaje amerita crear un ticket de soporte técnico.

Respondé exactamente "SI" si el mensaje reporta un problema técnico, una falla, o pide ayuda/consulta técnica.
Respondé exactamente "NO" si el mensaje es un saludo, agradecimiento, mensaje de otra índole, número equivocado, spam, o cualquier cosa que no sea un pedido de soporte técnico.

Respondé solo con SI o NO, sin explicaciones ni puntuación adicional.`;

// Filtra los mensajes entrantes de WhatsApp para que solo los que realmente
// reportan un problema técnico generen un ticket — el número también lo
// usan clientes para saludos, consultas ajenas a soporte, etc.
export async function esSolicitudDeSoporte(texto: string): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Sin clasificador configurado, no bloqueamos la creación de tickets.
    return true;
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 5,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: texto.slice(0, 2000) }],
    });

    const bloque = response.content.find((b) => b.type === 'text');
    const respuesta = bloque?.type === 'text' ? bloque.text.trim().toUpperCase() : '';
    return respuesta.startsWith('SI');
  } catch (err) {
    console.error('Error clasificando mensaje de WhatsApp:', err);
    // Fail open: ante un error del clasificador preferimos crear el ticket
    // a arriesgarnos a perder un problema real.
    return true;
  }
}
