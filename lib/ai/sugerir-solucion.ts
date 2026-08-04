import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sos un asistente de soporte técnico de ITTicketPy. Te llega la descripción de un problema reportado por WhatsApp. Tu tarea es decidir si es un problema simple y común con una solución rápida y conocida (reiniciar un equipo, revisar un cable, un ajuste básico de configuración, un error típico) y, si es así, escribir UNA sugerencia breve (2-3 líneas máximo) en tono cálido y humilde que el cliente pueda probar mientras se le asigna un técnico.

Reglas importantes:
- Nunca suene a que estás descartando el problema o dando el ticket por resuelto — el técnico lo va a revisar de todas formas, tu sugerencia es solo algo para probar mientras tanto.
- Si el problema no es simple (requiere acceso al sistema, revisar un servidor, algo específico de la empresa, o no tenés información suficiente para sugerir algo útil), respondé exactamente "NINGUNA" y nada más.
- No sugieras pasos riesgosos o irreversibles (no reinstalar sistemas operativos, no borrar datos, no resetear de fábrica).
- No uses jerga técnica que una persona no técnica no entendería.
- Respondé en español, tono amable y cercano, sin emojis de más.`;

// Genera un tip corto para problemas simples/comunes, o null si el problema
// no es trivial (o si no hay clasificador configurado / falla la llamada).
export async function generarSugerencia(texto: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: texto.slice(0, 2000) }],
    });

    const bloque = response.content.find((b) => b.type === 'text');
    const respuesta = bloque?.type === 'text' ? bloque.text.trim() : '';
    if (!respuesta || respuesta.toUpperCase().startsWith('NINGUNA')) return null;
    return respuesta;
  } catch (err) {
    console.error('Error generando sugerencia de soporte:', err);
    // Fail silent: sin sugerencia, pero no rompe la creación del ticket.
    return null;
  }
}
