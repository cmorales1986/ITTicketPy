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

// Tipos de PR-INF-03. Los valores 1 a 3 se conservan de la primera versión
// (los tickets históricos quedaron en 1, que ahora se llama solo "Incidente").
export const TIPO = {
  INCIDENTE: 1,
  DESARROLLO: 2,
  MEJORA: 3,
  SOPORTE: 4,
  SOLICITUD_USUARIO: 5, // alta, baja o modificación de usuarios (PR-INF-02)
} as const;

export const TIPO_LABELS: Record<number, string> = {
  1: 'Incidente',
  2: 'Solicitud de desarrollo',
  3: 'Mejora',
  4: 'Soporte',
  5: 'Solicitud de usuario',
};

// Orden en que se muestran en los selectores.
export const TIPOS_ORDEN: number[] = [1, 4, 5, 2, 3];

// Desarrollo y mejora no usan el plazo de resolución de la tabla: su plazo se
// define en la evaluación. La primera respuesta sí aplica a todos.
export const TIPOS_SIN_PLAZO_RESOLUCION: number[] = [TIPO.DESARROLLO, TIPO.MEJORA];

// Lugar de origen del reporte: define el horario con el que se cuentan los
// plazos (oficina de Asunción o granja).
export const LUGAR = {
  OFICINA: 'OFICINA',
  GRANJA: 'GRANJA',
} as const;

export type Lugar = (typeof LUGAR)[keyof typeof LUGAR];

export const LUGAR_LABELS: Record<string, string> = {
  OFICINA: 'Oficina',
  GRANJA: 'Granja',
};

// Sistema o servicio afectado (lista cerrada de PR-INF-03). "Otro" admite un
// detalle libre, que se guarda como "Otro: detalle".
export const SISTEMAS_AFECTADOS = [
  'SAP',
  'Pygs System',
  'Agriness',
  'Correo electrónico',
  'Red e internet',
  'Equipos',
  'Servidores y back up',
  'Otro',
] as const;

export function sistemaAfectadoValido(valor: string): boolean {
  return (
    (SISTEMAS_AFECTADOS as readonly string[]).includes(valor) ||
    (valor.startsWith('Otro: ') && valor.length > 'Otro: '.length)
  );
}

// --- P2: desarrollo y mejora ---

export const RESULTADOS_PRUEBAS: Record<string, string> = {
  APROBADAS: 'Aprobadas',
  CON_OBSERVACIONES: 'Con observaciones',
  RECHAZADAS: 'Rechazadas',
};

// Aprobaciones: quién valida cada cosa.
export const APROBACION_TIPOS = ['AREA', 'TI', 'GG'] as const;
export type AprobacionTipo = (typeof APROBACION_TIPOS)[number];

export const APROBACION_LABELS: Record<AprobacionTipo, { titulo: string; detalle: string }> = {
  AREA: { titulo: 'Gerente del área solicitante', detalle: 'Valida la necesidad' },
  TI: { titulo: 'Gerente de TI', detalle: 'Aprueba alcance, prioridad y puesta en producción' },
  GG: { titulo: 'Gerencia General', detalle: 'Solo si hay costo' },
};

// Evaluación, aprobaciones, pruebas y puesta en producción solo aplican a
// solicitudes de desarrollo y mejora.
export function esDesarrolloOMejora(tipo: number): boolean {
  return TIPOS_SIN_PLAZO_RESOLUCION.includes(tipo);
}

// Canales por los que el equipo registra la conformidad del usuario.
export const CANALES_CONFORMIDAD = ['WHATSAPP', 'WHATSAPP_PERSONAL', 'WHATSAPP_TECNICO', 'CORREO', 'LLAMADA'] as const;

export const CANAL = {
  WHATSAPP: 'WHATSAPP',
  CORREO: 'CORREO',
  LLAMADA: 'LLAMADA',
  // Cargados a mano: el usuario escribió al WhatsApp personal del Gerente de TI
  // o al WhatsApp técnico (no al bot, que es el canal WHATSAPP).
  WHATSAPP_PERSONAL: 'WHATSAPP_PERSONAL',
  WHATSAPP_TECNICO: 'WHATSAPP_TECNICO',
  // Un cliente que carga su propio ticket desde el portal. No es uno de los
  // canales del procedimiento: se registra aparte para no mentir el canal.
  PORTAL: 'PORTAL',
} as const;

export type Canal = (typeof CANAL)[keyof typeof CANAL];

export const CANAL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  WHATSAPP_PERSONAL: 'WhatsApp personal',
  WHATSAPP_TECNICO: 'WhatsApp técnico',
  CORREO: 'Correo electrónico',
  LLAMADA: 'Llamada',
  PORTAL: 'Portal (cargado por el usuario)',
};

// Canales que se cargan a mano en el portal (el de WhatsApp lo carga el bot).
export const CANALES_MANUALES: Canal[] = [CANAL.CORREO, CANAL.LLAMADA, CANAL.WHATSAPP_PERSONAL, CANAL.WHATSAPP_TECNICO];

// Urgencia percibida por el usuario que reporta (misma escala que prioridad,
// pero es lo que el usuario siente, no lo que el Gerente de TI decide).
export const URGENCIA_LABELS: Record<number, string> = {
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Crítica',
};
