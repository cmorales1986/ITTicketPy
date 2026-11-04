// Plazos objetivo de PR-INF-03 y su medición. Los valores salen de la
// configuración (tabla `configuracion`), no están fijos en el código: lo de
// acá abajo son solo los valores por defecto propuestos por el procedimiento.
// Sin imports de base de datos.

import {
  type ConfigHorario,
  type Horario,
  HORARIO_POR_DEFECTO,
  jornadaMinutos,
  minutosHabilesEntre,
  sumarMinutosHabiles,
} from './horario';

export interface PlazoPrioridad {
  primeraMin: number; // primera respuesta, en minutos hábiles
  resolucionMin: number; // resolución objetivo, en minutos hábiles
}

export type PlazosPorPrioridad = Record<number, PlazoPrioridad>;

// Un "día hábil" es una jornada completa (7:30 a 17:30 = 600 min).
export function plazosPorDefecto(horario: Horario = HORARIO_POR_DEFECTO): PlazosPorPrioridad {
  const dia = jornadaMinutos(horario);
  return {
    4: { primeraMin: 60, resolucionMin: 240 }, // Crítica: 1 h / 4 h
    3: { primeraMin: 120, resolucionMin: dia }, // Alta: 2 h / 1 día hábil
    2: { primeraMin: 240, resolucionMin: dia * 3 }, // Media: 4 h / 3 días hábiles
    1: { primeraMin: dia, resolucionMin: dia * 5 }, // Baja: 1 día hábil / 5 días hábiles
  };
}

export interface ConfigPlazos extends ConfigHorario {
  plazos: PlazosPorPrioridad;
}

export type EstadoPlazo =
  | 'en_plazo'
  | 'por_vencer'
  | 'vencido'
  | 'cumplido'
  | 'cumplido_tarde'
  | 'sin_dato' // ticket histórico sin primera respuesta registrada
  | 'no_aplica';

export interface Medicion {
  estado: EstadoPlazo;
  limite: string | null; // ISO, cuándo vence
  usadosMin: number | null; // minutos hábiles consumidos
  plazoMin: number | null;
}

export interface Sla {
  respuesta: Medicion;
  resolucion: Medicion;
  resumen: EstadoPlazo;
}

export interface TicketParaSla {
  fechaCreacion: Date | string;
  prioridad: number;
  tipo: number;
  estado: number;
  fechaPrimeraRespuesta?: Date | string | null;
  fechaResolucion?: Date | string | null;
}

// Cuando queda menos de este porcentaje del plazo, el ticket está "por vencer".
const UMBRAL_POR_VENCER = 0.25;

const NO_APLICA: Medicion = { estado: 'no_aplica', limite: null, usadosMin: null, plazoMin: null };

function medir(
  creacion: Date,
  plazoMin: number,
  fin: Date | null,
  ahora: Date,
  cfg: ConfigHorario,
  sinDatoSiAbierto = false,
): Medicion {
  const limite = sumarMinutosHabiles(creacion, plazoMin, cfg)?.toISOString() ?? null;

  if (fin) {
    const usados = minutosHabilesEntre(creacion, fin, cfg);
    return {
      estado: usados <= plazoMin ? 'cumplido' : 'cumplido_tarde',
      limite,
      usadosMin: usados,
      plazoMin,
    };
  }
  if (sinDatoSiAbierto) return { estado: 'sin_dato', limite, usadosMin: null, plazoMin };

  const usados = minutosHabilesEntre(creacion, ahora, cfg);
  const estado: EstadoPlazo =
    usados > plazoMin ? 'vencido' : usados >= plazoMin * (1 - UMBRAL_POR_VENCER) ? 'por_vencer' : 'en_plazo';
  return { estado, limite, usadosMin: usados, plazoMin };
}

const ORDEN_RESUMEN: EstadoPlazo[] = [
  'vencido',
  'por_vencer',
  'cumplido_tarde',
  'en_plazo',
  'cumplido',
  'sin_dato',
  'no_aplica',
];

export function calcularSla(t: TicketParaSla, cfg: ConfigPlazos, ahora: Date = new Date()): Sla {
  const creacion = new Date(t.fechaCreacion);
  const plazo = cfg.plazos[t.prioridad] ?? cfg.plazos[2];
  const cancelado = t.estado === 5;
  const resuelto = t.estado === 3 || t.estado === 4;

  // Primera respuesta: aplica a todos los tipos. Un ticket histórico ya
  // resuelto/cerrado sin fecha registrada no se puede medir (no se inventa).
  const respuesta = cancelado && !t.fechaPrimeraRespuesta
    ? NO_APLICA
    : medir(
        creacion,
        plazo.primeraMin,
        t.fechaPrimeraRespuesta ? new Date(t.fechaPrimeraRespuesta) : null,
        ahora,
        cfg,
        resuelto,
      );

  // Resolución: solo incidentes. Desarrollo y mejora tienen un plazo propio
  // que se define en la evaluación (P2).
  const resolucion =
    cancelado || t.tipo !== 1
      ? NO_APLICA
      : medir(
          creacion,
          plazo.resolucionMin,
          resuelto && t.fechaResolucion ? new Date(t.fechaResolucion) : null,
          ahora,
          cfg,
        );

  const resumen =
    ORDEN_RESUMEN.find((e) => respuesta.estado === e || resolucion.estado === e) ?? 'no_aplica';

  return { respuesta, resolucion, resumen };
}

export const ESTADO_PLAZO_LABELS: Record<EstadoPlazo, string> = {
  en_plazo: 'En plazo',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  cumplido: 'Cumplido',
  cumplido_tarde: 'Cumplido fuera de plazo',
  sin_dato: 'Sin dato',
  no_aplica: 'No aplica',
};

export const ESTADO_PLAZO_COLORS: Record<EstadoPlazo, string> = {
  en_plazo: 'bg-green-500/10 text-green-400',
  por_vencer: 'bg-yellow-500/10 text-yellow-400',
  vencido: 'bg-red-500/10 text-red-400',
  cumplido: 'bg-green-500/10 text-green-400',
  cumplido_tarde: 'bg-orange-500/10 text-orange-400',
  sin_dato: 'bg-gray-500/10 text-gray-400',
  no_aplica: 'bg-gray-500/10 text-gray-400',
};

export function formatearMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
