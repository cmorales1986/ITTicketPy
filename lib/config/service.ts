import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracion, feriados } from '@/lib/db/schema';
import { HORARIO_GRANJA_POR_DEFECTO, HORARIO_POR_DEFECTO, type Horario } from '@/lib/tickets/horario';
import {
  PARAMETROS_CIERRE_POR_DEFECTO,
  plazosPorDefecto,
  type Cantidad,
  type ConfigPlazos,
  type PlazoPrioridad,
  type ParametrosCierre,
  type PlazosPorPrioridad,
} from '@/lib/tickets/plazos';

const CLAVE_HORARIO = 'horario';
const CLAVE_HORARIO_GRANJA = 'horarioGranja';
const CLAVE_PLAZOS = 'plazos';
const CLAVE_CIERRE = 'cierre';

async function leer<T>(clave: string): Promise<T | null> {
  const fila = await db.query.configuracion.findFirst({ where: eq(configuracion.clave, clave) });
  if (!fila) return null;
  try {
    return JSON.parse(fila.valor) as T;
  } catch {
    return null;
  }
}

async function guardar(clave: string, valor: unknown) {
  const texto = JSON.stringify(valor);
  await db
    .insert(configuracion)
    .values({ clave, valor: texto })
    .onConflictDoUpdate({ target: configuracion.clave, set: { valor: texto, fechaActualizacion: new Date() } });
}

export async function obtenerHorario(): Promise<Horario> {
  return (await leer<Horario>(CLAVE_HORARIO)) ?? HORARIO_POR_DEFECTO;
}

export async function obtenerHorarioGranja(): Promise<Horario> {
  return (await leer<Horario>(CLAVE_HORARIO_GRANJA)) ?? HORARIO_GRANJA_POR_DEFECTO;
}

// La primera versión guardaba los plazos en minutos ({primeraMin,
// resolucionMin}); se convierten a horas para no perder lo que ya se haya
// configurado.
type PlazoGuardado = PlazoPrioridad | { primeraMin: number; resolucionMin: number };

function normalizarPlazo(p: PlazoGuardado | undefined, porDefecto: PlazoPrioridad): PlazoPrioridad {
  if (!p) return porDefecto;
  if ('primera' in p) return p;
  const aHoras = (min: number): Cantidad => ({ valor: Math.round((min / 60) * 100) / 100, unidad: 'h' });
  return { primera: aHoras(p.primeraMin), resolucion: aHoras(p.resolucionMin) };
}

export async function obtenerPlazos(): Promise<PlazosPorPrioridad> {
  const defecto = plazosPorDefecto();
  const guardados = (await leer<Record<number, PlazoGuardado>>(CLAVE_PLAZOS)) ?? {};
  return Object.fromEntries(
    [1, 2, 3, 4].map((p) => [p, normalizarPlazo(guardados[p], defecto[p])]),
  ) as PlazosPorPrioridad;
}

export async function obtenerParametrosCierre(): Promise<ParametrosCierre> {
  return { ...PARAMETROS_CIERRE_POR_DEFECTO, ...((await leer<ParametrosCierre>(CLAVE_CIERRE)) ?? {}) };
}

export async function guardarParametrosCierre(p: ParametrosCierre) {
  await guardar(CLAVE_CIERRE, p);
}

export async function listarFeriados() {
  const filas = await db.select().from(feriados).orderBy(feriados.fecha);
  // Siempre "YYYY-MM-DD", aunque el driver devuelva un Date: el cálculo de
  // horas hábiles compara contra esa forma exacta.
  return filas.map((f) => ({
    ...f,
    fecha: (typeof f.fecha === 'string' ? f.fecha : new Date(f.fecha).toISOString()).slice(0, 10),
  }));
}

export async function obtenerConfigPlazos(): Promise<ConfigPlazos> {
  try {
    const [horario, horarioGranja, plazos, lista, cierre] = await Promise.all([
      obtenerHorario(),
      obtenerHorarioGranja(),
      obtenerPlazos(),
      listarFeriados(),
      obtenerParametrosCierre(),
    ]);
    return { horario, horarioGranja, plazos, feriados: new Set(lista.map((f) => f.fecha)), cierre };
  } catch (err) {
    // Si todavía no existen las tablas de configuración, seguimos con los
    // valores por defecto en vez de romper el listado de tickets.
    console.error('No se pudo leer la configuración de plazos, uso valores por defecto:', err);
    return {
      horario: HORARIO_POR_DEFECTO,
      horarioGranja: HORARIO_GRANJA_POR_DEFECTO,
      plazos: plazosPorDefecto(),
      feriados: new Set(),
      cierre: PARAMETROS_CIERRE_POR_DEFECTO,
    };
  }
}

export async function guardarHorario(h: Horario) {
  await guardar(CLAVE_HORARIO, h);
}

export async function guardarHorarioGranja(h: Horario) {
  await guardar(CLAVE_HORARIO_GRANJA, h);
}

export async function guardarPlazos(p: PlazosPorPrioridad) {
  await guardar(CLAVE_PLAZOS, p);
}

export async function agregarFeriado(fecha: string, nombre: string) {
  await db
    .insert(feriados)
    .values({ fecha, nombre })
    .onConflictDoUpdate({ target: feriados.fecha, set: { nombre } });
}

export async function quitarFeriado(fecha: string) {
  await db.delete(feriados).where(eq(feriados.fecha, fecha));
}
