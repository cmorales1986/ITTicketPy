import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracion, feriados } from '@/lib/db/schema';
import { HORARIO_POR_DEFECTO, type Horario } from '@/lib/tickets/horario';
import { plazosPorDefecto, type ConfigPlazos, type PlazosPorPrioridad } from '@/lib/tickets/plazos';

const CLAVE_HORARIO = 'horario';
const CLAVE_PLAZOS = 'plazos';

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

export async function obtenerPlazos(horario?: Horario): Promise<PlazosPorPrioridad> {
  const h = horario ?? (await obtenerHorario());
  return { ...plazosPorDefecto(h), ...((await leer<PlazosPorPrioridad>(CLAVE_PLAZOS)) ?? {}) };
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
    const horario = await obtenerHorario();
    const [plazos, lista] = await Promise.all([obtenerPlazos(horario), listarFeriados()]);
    return { horario, plazos, feriados: new Set(lista.map((f) => f.fecha)) };
  } catch (err) {
    // Si todavía no existen las tablas de configuración, seguimos con los
    // valores por defecto en vez de romper el listado de tickets.
    console.error('No se pudo leer la configuración de plazos, uso valores por defecto:', err);
    return { horario: HORARIO_POR_DEFECTO, plazos: plazosPorDefecto(), feriados: new Set() };
  }
}

export async function guardarHorario(h: Horario) {
  await guardar(CLAVE_HORARIO, h);
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
