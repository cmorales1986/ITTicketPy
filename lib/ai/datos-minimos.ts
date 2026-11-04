// Datos mínimos de un reporte por WhatsApp (PR-INF-03, P3): además de la
// descripción, el bot necesita saber qué sistema o servicio está afectado y
// qué tan urgente es para el usuario. Acá vive la parte que no depende de la
// IA: normalizar lo que ella devuelve, detectar palabras clave como red de
// seguridad, y armar la pregunta de lo que falte. Puro, sin red ni base.

import { SISTEMAS_AFECTADOS } from '@/lib/tickets/estados';

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const SIN_DATO = new Set(['', 'null', 'ninguno', 'ninguna', 'desconocido', 'no especificado', 'no indicado', 'n/a']);

// Lleva lo que devuelve la IA a un valor válido de la lista cerrada de
// sistemas; algo que no está en la lista se guarda como "Otro: detalle".
export function normalizarSistema(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.trim();
  if (SIN_DATO.has(sinAcentos(v).toLowerCase())) return null;

  const clave = sinAcentos(v).toLowerCase();
  const exacto = SISTEMAS_AFECTADOS.find((s) => sinAcentos(s).toLowerCase() === clave);
  if (exacto) return exacto;

  if (clave.startsWith('otro')) {
    const detalle = v.replace(/^otro\s*[:\-–]?\s*/i, '').trim();
    return detalle ? `Otro: ${detalle.slice(0, 100)}` : 'Otro';
  }
  return `Otro: ${v.slice(0, 100)}`;
}

export function normalizarUrgencia(valor: unknown): number | null {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
}

// Red de seguridad cuando la IA no devuelve el sistema (o no está disponible):
// busca nombres de sistemas y palabras típicas. Los nombres propios van primero
// ("no entro al SAP desde mi compu" es SAP, no Equipos).
export function detectarSistema(texto: string): string | null {
  const t = sinAcentos(texto).toLowerCase();
  if (/\bsap\b|\bb1\b/.test(t)) return 'SAP';
  if (/pygs/.test(t)) return 'Pygs System';
  if (/agriness/.test(t)) return 'Agriness';
  if (/correo|\b(e-?)?mails?\b|outlook|gmail/.test(t)) return 'Correo electrónico';
  if (/\bred\b|internet|wi-?fi|conexion/.test(t)) return 'Red e internet';
  if (/servidor|back ?up|respaldo/.test(t)) return 'Servidores y back up';
  if (/\b(pc|compu|computadora|notebook|laptop|impresora|monitor|mouse|teclado|equipo)\b/.test(t)) return 'Equipos';
  return null;
}

// Solo si el cliente lo dijo con palabras: la urgencia no se deduce del tipo
// de problema. 1 baja, 2 media, 3 alta, 4 crítica. Se prueba de la más grave
// a la más leve, salvo "no es urgente", que va antes que "urgente".
export function detectarUrgencia(texto: string): number | null {
  const t = sinAcentos(texto).toLowerCase();
  if (/critic[ao]|emergencia|urgentisimo|no puedo (trabajar|operar)|todo parado/.test(t)) return 4;
  if (/no es urgente|poco urgente|sin apuro|cuando puedan|cuando puedas|urgencia baja|\bbaja\b/.test(t)) return 1;
  if (/urgente|urgencia alta|\balta\b|lo antes posible|cuanto antes|importante/.test(t)) return 3;
  if (/urgencia media|\bmedia\b|\bnormal\b|moderad/.test(t)) return 2;
  return null;
}

// Pregunta por lo que falte, en un solo mensaje. Si no falta nada, null.
export function preguntaDatosFaltantes(faltaSistema: boolean, faltaUrgencia: boolean): string | null {
  const partes: string[] = [];
  if (faltaSistema) {
    partes.push(
      `¿Qué sistema o servicio está afectado? Por ejemplo: ${SISTEMAS_AFECTADOS.slice(0, -1).join(', ')} u otro.`,
    );
  }
  if (faltaUrgencia) {
    partes.push('¿Qué tan urgente es para vos? Baja, Media, Alta o Crítica (por ejemplo, si no podés trabajar).');
  }
  return partes.length > 0 ? partes.join('\n\n') : null;
}
