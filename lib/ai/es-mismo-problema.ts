import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Analizás mensajes de WhatsApp de un cliente que ya tiene un ticket de soporte técnico abierto. Tu tarea es decidir si su nuevo mensaje sigue hablando del mismo problema del ticket, o si está reportando algo distinto y nuevo.

Se considera que SIGUE siendo el mismo problema cuando el mensaje da más detalle, cuenta que probó algo, dice que sigue sin funcionar o que ya se solucionó, responde una pregunta, agradece, manda una foto/aclaración, o en general se refiere al mismo tema — aunque no repita las mismas palabras del ticket.

Se considera un problema NUEVO solo cuando el cliente menciona explícitamente otro equipo, sistema o situación que claramente no tiene relación con el ticket abierto (por ejemplo, el ticket es sobre una impresora y el cliente ahora dice que no le anda el correo).

Ante la duda, respondé que es el MISMO problema — un falso "nuevo" interrumpe al cliente sin necesidad.

Respondé exactamente "MISMO" o "NUEVO", sin explicaciones ni puntuación adicional.`;

// Antes de sumar un mensaje al chat de un ticket abierto, chequea si
// realmente sigue siendo sobre ese problema o si el cliente cambió de tema
// sin avisar (típico cuando tuvo un mal día y tiene varios problemas
// distintos mientras el primer ticket todavía no se cerró).
export async function esMismoProblema(
  ticketTitulo: string,
  ticketDescripcion: string,
  mensajeNuevo: string,
): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return true;

  try {
    const client = new Anthropic();
    const contenido = `Ticket abierto:\nTítulo: ${ticketTitulo}\nDescripción: ${ticketDescripcion}\n\nNuevo mensaje del cliente:\n${mensajeNuevo}`;
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 5,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contenido.slice(0, 3000) }],
    });

    const bloque = response.content.find((b) => b.type === 'text');
    const respuesta = bloque?.type === 'text' ? bloque.text.trim().toUpperCase() : '';
    return !respuesta.startsWith('NUEVO');
  } catch (err) {
    console.error('Error comparando mensaje con ticket abierto:', err);
    // Fail open: si el clasificador falla, seguimos tratándolo como parte
    // del mismo ticket en vez de interrumpir al cliente por un error nuestro.
    return true;
  }
}
