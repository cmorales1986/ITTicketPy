// Estados, tipos y canales definidos por PR-INF-03. Compartido entre el
// servidor (validación) y el cliente (qué botones mostrar), sin imports de
// base de datos para poder usarlo en componentes 'use client'.

export const ESTADO = {
  NUEVO: 1, // se guardaba como "Abierto"; mismo valor numérico, nuevo nombre
  EN_PROCESO: 2,
  RESUELTO: 3,
  CERRADO: 4,
  CANCELADO: 5,
} as const;

// Estados finales: el ticket ya no se atiende (ver conservación, PR-INF-03).
export const ESTADOS_FINALES: number[] = [ESTADO.CERRADO, ESTADO.CANCELADO];

// Años que se conservan los tickets cerrados o cancelados (PR-INF-03). La
// base lo hace cumplir con triggers (drizzle/0004); la app solo lo usa para
// avisar con un mensaje claro antes de intentar borrar.
export const ANIOS_CONSERVACION = 3;

// Transiciones permitidas. Cualquier otra se bloquea.
//  Nuevo -> En Proceso -> Resuelto -> Cerrado
//  Resuelto -> En Proceso (el usuario objeta)
//  Cerrado -> En Proceso (reapertura)
//  Nuevo / En Proceso -> Cancelado
export const TRANSICIONES: Record<number, number[]> = {
  [ESTADO.NUEVO]: [ESTADO.EN_PROCESO, ESTADO.CANCELADO],
  [ESTADO.EN_PROCESO]: [ESTADO.RESUELTO, ESTADO.CANCELADO],
  [ESTADO.RESUELTO]: [ESTADO.CERRADO, ESTADO.EN_PROCESO],
  [ESTADO.CERRADO]: [ESTADO.EN_PROCESO],
  [ESTADO.CANCELADO]: [],
};

export function transicionPermitida(desde: number, hacia: number): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

export const TIPO = {
  INCIDENTE: 1,
  DESARROLLO: 2,
  MEJORA: 3,
} as const;

export const TIPO_LABELS: Record<number, string> = {
  1: 'Incidente / Soporte',
  2: 'Solicitud de desarrollo',
  3: 'Mejora',
};

export const CANAL = {
  WHATSAPP: 'WHATSAPP',
  CORREO: 'CORREO',
  LLAMADA: 'LLAMADA',
  // Un cliente que carga su propio ticket desde el portal. No es uno de los
  // canales del procedimiento: se registra aparte para no mentir el canal.
  PORTAL: 'PORTAL',
} as const;

export type Canal = (typeof CANAL)[keyof typeof CANAL];

export const CANAL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  CORREO: 'Correo electrónico',
  LLAMADA: 'Llamada',
  PORTAL: 'Portal (cargado por el usuario)',
};

// Canales que se cargan a mano en el portal (el de WhatsApp lo carga el bot).
export const CANALES_MANUALES: Canal[] = [CANAL.CORREO, CANAL.LLAMADA];

// Urgencia percibida por el usuario que reporta (misma escala que prioridad,
// pero es lo que el usuario siente, no lo que el Gerente de TI decide).
export const URGENCIA_LABELS: Record<number, string> = {
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Crítica',
};
