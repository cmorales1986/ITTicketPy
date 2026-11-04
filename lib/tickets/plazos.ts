// Plazos objetivo de PR-INF-03 y su medición. Los valores salen de la
// configuración (tabla `configuracion`), no están fijos en el código: lo de
// acá abajo son solo los valores por defecto propuestos por el procedimiento.
// Sin imports de base de datos.

import {
  type ConfigHorario,
  type Horario,
  jornadaMinutos,
  minutosHabilesEntre,
  sumarMinutosHabiles,
} from './horario';
import { TIPOS_SIN_PLAZO_RESOLUCION } from './estados';

// Un plazo se expresa en horas hábiles ('h') o en días hábiles ('d'). Un día
// hábil es una jornada completa del horario del lugar de origen del ticket
// (10 h en la oficina, 11 h en la granja), por eso se guarda la unidad y no
// los minutos.
export interface Cantidad {
  valor: number;
  unidad: 'h' | 'd';
}

export interface PlazoPrioridad {
  primera: Cantidad; // primera respuesta
  resolucion: Cantidad; // resolución objetivo
}

export type PlazosPorPrioridad = Record<number, PlazoPrioridad>;

export function plazosPorDefecto(): PlazosPorPrioridad {
  return {
    4: { primera: { valor: 1, unidad: 'h' }, resolucion: { valor: 4, unidad: 'h' } }, // Crítica
    3: { primera: { valor: 2, unidad: 'h' }, resolucion: { valor: 1, unidad: 'd' } }, // Alta
    2: { primera: { valor: 4, unidad: 'h' }, resolucion: { valor: 3, unidad: 'd' } }, // Media
    1: { primera: { valor: 1, unidad: 'd' }, resolucion: { valor: 5, unidad: 'd' } }, // Baja
  };
}

export function cantidadEnMinutos(c: Cantidad, horario: Horario): number {
  return c.unidad === 'h' ? c.valor * 60 : c.valor * jornadaMinutos(horario);
}

// Cierre sin respuesta del usuario y ventana de reapertura, en días hábiles.
export interface ParametrosCierre {
  diasCierre: number; // Resuelto sin respuesta -> Cerrado
  diasReapertura: number; // plazo para reabrir el mismo ticket tras el cierre
}

export const PARAMETROS_CIERRE_POR_DEFECTO: ParametrosCierre = { diasCierre: 3, diasReapertura: 5 };

// `horario` es el de la oficina (Asunción); `horarioGranja` el de la granja.
// Los feriados son una sola lista para ambos.
export interface ConfigPlazos extends ConfigHorario {
  horarioGranja: Horario;
  plazos: PlazosPorPrioridad;
  cierre: ParametrosCierre;
}

// Horario con el que se cuentan los plazos de un ticket según su lugar de
// origen. Si no tiene lugar registrado (tickets históricos, bot de WhatsApp)
// se usa el de la oficina.
export function horarioDe(lugarOrigen: string | null | undefined, cfg: ConfigPlazos): ConfigHorario {
  return {
    horario: lugarOrigen === 'GRANJA' ? cfg.horarioGranja : cfg.horario,
    feriados: cfg.feriados,
  };
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
  // Cuándo se recibió el reporte, si difiere de cuándo se cargó el ticket
  // (correo o llamada cargados después). Desde acá corren los plazos.
  fechaRecepcion?: Date | string | null;
  lugarOrigen?: string | null;
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

export function calcularSla(t: TicketParaSla, cfgPlazos: ConfigPlazos, ahora: Date = new Date()): Sla {
  // Los plazos corren desde la recepción del reporte y con el horario del
  // lugar de origen.
  const creacion = new Date(t.fechaRecepcion ?? t.fechaCreacion);
  const cfg = horarioDe(t.lugarOrigen, cfgPlazos);
  const plazo = cfgPlazos.plazos[t.prioridad] ?? cfgPlazos.plazos[2];
  const primeraMin = cantidadEnMinutos(plazo.primera, cfg.horario);
  const resolucionMin = cantidadEnMinutos(plazo.resolucion, cfg.horario);
  const cancelado = t.estado === 5;
  const resuelto = t.estado === 3 || t.estado === 4;

  // Primera respuesta: aplica a todos los tipos. Un ticket histórico ya
  // resuelto/cerrado sin fecha registrada no se puede medir (no se inventa).
  const respuesta = cancelado && !t.fechaPrimeraRespuesta
    ? NO_APLICA
    : medir(
        creacion,
        primeraMin,
        t.fechaPrimeraRespuesta ? new Date(t.fechaPrimeraRespuesta) : null,
        ahora,
        cfg,
        resuelto,
      );

  // Resolución: no aplica a desarrollo ni mejora, que tienen un plazo propio
  // definido en la evaluación (P2).
  const resolucion =
    cancelado || TIPOS_SIN_PLAZO_RESOLUCION.includes(t.tipo)
      ? NO_APLICA
      : medir(
          creacion,
          resolucionMin,
          resuelto && t.fechaResolucion ? new Date(t.fechaResolucion) : null,
          ahora,
          cfg,
        );

  const resumen =
    ORDEN_RESUMEN.find((e) => respuesta.estado === e || resolucion.estado === e) ?? 'no_aplica';

  return { respuesta, resolucion, resumen };
}

export interface Reapertura {
  permitida: boolean;
  limite: string | null; // hasta cuándo se puede reabrir
}

// ¿Se puede reabrir este ticket Cerrado? Solo dentro de N días hábiles
// posteriores al cierre; pasado ese plazo hay que crear un ticket nuevo
// vinculado.
export function calcularReapertura(
  t: {
    estado: number;
    lugarOrigen?: string | null;
    fechaCierre?: Date | string | null;
    fechaResolucion?: Date | string | null;
  },
  cfgPlazos: ConfigPlazos,
  ahora: Date = new Date(),
): Reapertura | null {
  if (t.estado !== 4) return null;
  const base = t.fechaCierre ?? t.fechaResolucion;
  if (!base) return { permitida: false, limite: null };
  const cfg = horarioDe(t.lugarOrigen, cfgPlazos);
  const maxMin = cfgPlazos.cierre.diasReapertura * jornadaMinutos(cfg.horario);
  const limite = sumarMinutosHabiles(new Date(base), maxMin, cfg);
  return {
    permitida: minutosHabilesEntre(new Date(base), ahora, cfg) <= maxMin,
    limite: limite?.toISOString() ?? null,
  };
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
