// Aritmética de horas hábiles (PR-INF-03): cuenta solo los minutos que caen
// dentro del horario laboral, en días laborales y que no sean feriado. Todo
// se calcula en la zona horaria de Paraguay, sin importar dónde corra el
// servidor. Sin imports de base de datos: se usa también desde el cliente.

export const ZONA_HORARIA = 'America/Asuncion';

export interface Horario {
  dias: number[]; // días laborales: 0=domingo ... 6=sábado
  desde: string; // "HH:MM"
  hasta: string; // "HH:MM"
}

export interface ConfigHorario {
  horario: Horario;
  feriados: Set<string>; // "YYYY-MM-DD", fecha local
}

export const HORARIO_POR_DEFECTO: Horario = {
  dias: [1, 2, 3, 4, 5],
  desde: '07:30',
  hasta: '17:30',
};

const MAX_DIAS = 3660; // tope de seguridad para los bucles (10 años)
const MS_DIA = 24 * 60 * 60 * 1000;

const formateador = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface Local {
  fecha: string; // YYYY-MM-DD
  minutos: number; // minutos desde las 00:00 locales
  dia: number; // 0..6
}

function aLocal(d: Date): Local {
  const p: Record<string, string> = {};
  for (const parte of formateador.formatToParts(d)) p[parte.type] = parte.value;
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return {
    fecha,
    minutos: Number(p.hour) * 60 + Number(p.minute),
    dia: new Date(`${fecha}T00:00:00Z`).getUTCDay(),
  };
}

// Desfase de la zona respecto de UTC (minutos) en un instante dado.
function desfase(d: Date): number {
  const l = aLocal(d);
  const comoUtc = Date.parse(`${l.fecha}T00:00:00Z`) + l.minutos * 60000;
  return Math.round((comoUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

function deLocal(fecha: string, minutos: number): Date {
  const base = Date.parse(`${fecha}T00:00:00Z`) + minutos * 60000;
  let d = new Date(base - desfase(new Date(base)) * 60000);
  d = new Date(base - desfase(d) * 60000); // segunda pasada por si cambió el desfase
  return d;
}

function sumarDias(fecha: string, n: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + n * MS_DIA).toISOString().slice(0, 10);
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function esLaboral(fecha: string, dia: number, cfg: ConfigHorario): boolean {
  return cfg.horario.dias.includes(dia) && !cfg.feriados.has(fecha);
}

export function jornadaMinutos(h: Horario): number {
  return aMinutos(h.hasta) - aMinutos(h.desde);
}

// Minutos hábiles transcurridos entre dos instantes.
export function minutosHabilesEntre(desde: Date, hasta: Date, cfg: ConfigHorario): number {
  if (hasta.getTime() <= desde.getTime()) return 0;
  const ini = aMinutos(cfg.horario.desde);
  const fin = aMinutos(cfg.horario.hasta);
  if (fin <= ini) return 0;

  const a = aLocal(desde);
  const b = aLocal(hasta);
  let total = 0;
  let fecha = a.fecha;

  for (let i = 0; i < MAX_DIAS; i++) {
    const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    if (esLaboral(fecha, dia, cfg)) {
      const desdeMin = fecha === a.fecha ? Math.max(ini, a.minutos) : ini;
      const hastaMin = fecha === b.fecha ? Math.min(fin, b.minutos) : fin;
      total += Math.max(0, hastaMin - desdeMin);
    }
    if (fecha === b.fecha) break;
    fecha = sumarDias(fecha, 1);
  }
  return total;
}

// Instante en que se cumplen `minutos` hábiles contados desde `inicio`.
// Si el ticket se registra fuera de horario, el reloj arranca en la próxima
// apertura. Devuelve null si el horario no tiene ningún día laboral.
export function sumarMinutosHabiles(inicio: Date, minutos: number, cfg: ConfigHorario): Date | null {
  const ini = aMinutos(cfg.horario.desde);
  const fin = aMinutos(cfg.horario.hasta);
  if (fin <= ini || cfg.horario.dias.length === 0) return null;

  const a = aLocal(inicio);
  let fecha = a.fecha;
  let cursor = a.minutos;
  let restante = minutos;

  for (let i = 0; i < MAX_DIAS; i++) {
    const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    if (esLaboral(fecha, dia, cfg)) {
      const desdeMin = Math.max(ini, cursor);
      const disponible = fin - desdeMin;
      if (disponible > 0) {
        if (restante <= disponible) return deLocal(fecha, desdeMin + restante);
        restante -= disponible;
      }
    }
    fecha = sumarDias(fecha, 1);
    cursor = 0;
  }
  return null;
}
