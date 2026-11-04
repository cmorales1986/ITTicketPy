// Reportes de auditoría de PR-INF-03: cumplimiento de plazos por prioridad,
// tickets por tipo, estado y sistema afectado, y lista de Críticos con su
// análisis de causa. Puro: recibe tickets ya medidos (con `sla`) y arma las
// tablas, sin tocar la base de datos.

import type { EstadoPlazo } from '@/lib/tickets/plazos';

export interface TicketParaAuditoria {
  id: string;
  numero: string;
  titulo: string;
  prioridad: number;
  tipo: number;
  estado: number;
  sistemaModulo: string | null;
  analisisCausa: string | null;
  motivoDesvio: string | null;
  fechaCreacion: Date | string;
  fechaRecepcion: Date | string | null;
  sla?: { respuesta: { estado: EstadoPlazo }; resolucion: { estado: EstadoPlazo } };
}

export interface Cumplimiento {
  medidos: number; // plazos ya determinados (cumplidos o incumplidos)
  enPlazo: number;
  porcentaje: number | null; // null si no hay nada medido
}

export interface FilaCumplimiento {
  prioridad: number;
  total: number;
  primeraRespuesta: Cumplimiento;
  resolucion: Cumplimiento;
}

export interface Conteo {
  clave: string;
  total: number;
}

export interface ReporteAuditoria {
  totalRecibidos: number;
  cumplimiento: FilaCumplimiento[]; // Crítica, Alta, Media, Baja y una fila total (prioridad 0)
  porTipo: Conteo[];
  porEstado: Conteo[];
  porSistema: Conteo[];
  criticos: {
    id: string;
    numero: string;
    titulo: string;
    estado: number;
    sistema: string;
    recepcion: Date | string;
    analisisCausa: string | null;
    motivoDesvio: string | null;
  }[];
}

// Un plazo cuenta para el porcentaje solo si ya está determinado: cumplido a
// tiempo, cumplido tarde, o vencido sin cumplirse. Los que siguen corriendo
// (en plazo, por vencer), los históricos sin dato y los que no aplican quedan
// afuera: no se sabe todavía si se cumplen.
function sumar(c: { medidos: number; enPlazo: number }, estado: EstadoPlazo | undefined) {
  if (estado === 'cumplido') {
    c.medidos += 1;
    c.enPlazo += 1;
  } else if (estado === 'cumplido_tarde' || estado === 'vencido') {
    c.medidos += 1;
  }
}

export function porcentaje(enPlazo: number, medidos: number): number | null {
  return medidos === 0 ? null : Math.round((enPlazo / medidos) * 100);
}

function aCumplimiento(c: { medidos: number; enPlazo: number }): Cumplimiento {
  return { ...c, porcentaje: porcentaje(c.enPlazo, c.medidos) };
}

// "Otro: impresora" cuenta como "Otro"; sin dato como "Sin indicar".
export function sistemaParaConteo(s: string | null): string {
  if (!s) return 'Sin indicar';
  return s.startsWith('Otro: ') ? 'Otro' : s;
}

function contar(claves: string[]): Conteo[] {
  const m = new Map<string, number>();
  for (const c of claves) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].map(([clave, total]) => ({ clave, total })).sort((a, b) => b.total - a.total);
}

export function armarReporteAuditoria(
  tickets: TicketParaAuditoria[],
  etiquetas: { tipo: Record<number, string>; estado: Record<number, string> },
): ReporteAuditoria {
  const filas = new Map<number, { total: number; r: { medidos: number; enPlazo: number }; z: { medidos: number; enPlazo: number } }>();
  for (const p of [4, 3, 2, 1, 0]) {
    filas.set(p, { total: 0, r: { medidos: 0, enPlazo: 0 }, z: { medidos: 0, enPlazo: 0 } });
  }

  for (const t of tickets) {
    for (const p of [t.prioridad, 0]) {
      const f = filas.get(p);
      if (!f) continue;
      f.total += 1;
      sumar(f.r, t.sla?.respuesta.estado);
      sumar(f.z, t.sla?.resolucion.estado);
    }
  }

  return {
    totalRecibidos: tickets.length,
    cumplimiento: [...filas.entries()].map(([prioridad, f]) => ({
      prioridad,
      total: f.total,
      primeraRespuesta: aCumplimiento(f.r),
      resolucion: aCumplimiento(f.z),
    })),
    porTipo: contar(tickets.map((t) => etiquetas.tipo[t.tipo] ?? `Tipo ${t.tipo}`)),
    porEstado: contar(tickets.map((t) => etiquetas.estado[t.estado] ?? `Estado ${t.estado}`)),
    porSistema: contar(tickets.map((t) => sistemaParaConteo(t.sistemaModulo))),
    criticos: tickets
      .filter((t) => t.prioridad === 4)
      .map((t) => ({
        id: t.id,
        numero: t.numero,
        titulo: t.titulo,
        estado: t.estado,
        sistema: sistemaParaConteo(t.sistemaModulo),
        recepcion: t.fechaRecepcion ?? t.fechaCreacion,
        analisisCausa: t.analisisCausa,
        motivoDesvio: t.motivoDesvio,
      })),
  };
}
