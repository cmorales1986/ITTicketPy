// Respuesta del usuario a "¿quedó resuelto?" (PR-INF-03, P3): conforme, objeta
// o no se entiende. Puro y sin IA: solo reconoce respuestas claras (el 1 o el
// 2 que le pedimos, o palabras típicas). Cualquier otra cosa devuelve null y el
// mensaje sigue el camino normal (puede ser un problema nuevo).

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Mensajes más largos que esto casi siempre cuentan algo nuevo, no responden.
const MAX_LARGO_RESPUESTA = 120;

export function interpretarConformidad(texto: string): 'conforme' | 'objeta' | null {
  const t = normalizar(texto);
  if (!t || t.length > MAX_LARGO_RESPUESTA) return null;

  // "no hay problema, gracias" empieza con "no" pero es conforme.
  if (/^no (hay|tengo) (ningun )?(problema|drama|inconveniente)/.test(t)) return 'conforme';

  // Objeción primero: "no funciona" contiene "funciona" y "no, gracias" contiene "gracias".
  if (/^2\b/.test(t)) return 'objeta';
  if (/^no\b/.test(t)) return 'objeta';
  if (/\b(sigue|siguen|todavia|aun no|persiste|igual que antes|otra vez|de nuevo)\b/.test(t)) return 'objeta';
  if (/\bno (me )?(funciona|anda|sirve|se (soluciono|arreglo|resolvio)|resolvio|soluciono)\b/.test(t)) return 'objeta';

  if (/^1\b/.test(t)) return 'conforme';
  if (/^(si|ok|okey|okay|listo|perfecto|genial|excelente|bueno|dale|gracias|muchas gracias|conforme)\b/.test(t)) return 'conforme';
  if (/\b(ya (esta|funciona|anda|quedo|se (soluciono|arreglo|resolvio))|esta resuelto|quedo resuelto|funciona bien|anda bien|todo bien)\b/.test(t)) return 'conforme';

  return null;
}
